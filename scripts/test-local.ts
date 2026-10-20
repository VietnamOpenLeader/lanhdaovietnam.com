import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratchRoot = join(sourceRoot, ".void", "test-projects");
const copyDirectories = [
  "db", "middleware", "pages", "public", "routes", "scripts", "src", "tests",
];
const rootConfigFiles = [
  ".gitignore", "package.json", "bun.lock", "tsconfig.json",
  "vite.config.mts", "void.config.ts",
];

async function getFreePort(): Promise<number> {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await new Promise<void>((resolveListen, reject) => {
    listener.once("listening", resolveListen);
    listener.once("error", reject);
  });
  const address = listener.address();
  listener.close();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate a loopback test port");
  }
  return address.port;
}

function copyProject(projectRoot: string): void {
  mkdirSync(projectRoot, { recursive: true });
  for (const directory of copyDirectories) {
    const source = join(sourceRoot, directory);
    try {
      cpSync(source, join(projectRoot, directory), {
        recursive: true,
        filter: (path) => {
          const relativePath = relative(sourceRoot, path);
          return relativePath !== "src/router.tsx" && relativePath !== "src/routes"
            && !relativePath.startsWith("src/routes/");
        },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const file of rootConfigFiles) {
    try {
      cpSync(join(sourceRoot, file), join(projectRoot, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  symlinkSync(join(sourceRoot, "node_modules"), join(projectRoot, "node_modules"));
}

function testEnvironment(baseURL: string, projectRoot: string): Record<string, string> {
  const environment: Record<string, string> = {
    TEST_BASE_URL: baseURL,
    TEST_PROJECT_DIR: projectRoot,
  };
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "SHELL", "LANG", "TERM"]) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

async function waitForServer(server: ReturnType<typeof spawn>, baseURL: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    }
    const ready = await fetch(baseURL).then(() => true, () => false);
    if (ready) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Vite did not become ready within 30 seconds");
}

async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (server.exitCode !== null) return;
  const closed = new Promise<void>((resolveClose) => server.once("close", resolveClose));
  server.kill("SIGTERM");
  await closed;
}

async function runSuite(projectRoot: string, baseURL: string, suite: string): Promise<number> {
  const testPath = {
    api: "tests/integration",
    cli: "tests/cli",
    e2e: "tests/e2e",
  }[suite];
  if (!testPath) throw new Error("Expected a test suite: api, cli, or e2e");
  const process = spawn(
    processExecPath(),
    ["test", testPath],
    {
      cwd: projectRoot,
      env: testEnvironment(baseURL, projectRoot),
      stdio: "inherit",
    },
  );
  return new Promise((resolveExit, reject) => {
    process.once("error", reject);
    process.once("close", (code) => resolveExit(code ?? 1));
  });
}

function processExecPath(): string {
  return process.execPath;
}

async function main(): Promise<void> {
  const suite = process.argv[2] ?? "";
  const projectRoot = join(scratchRoot, randomUUID());
  const port = await getFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  mkdirSync(scratchRoot, { recursive: true });
  copyProject(projectRoot);

  const server = spawn(
    join(projectRoot, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: projectRoot,
      env: testEnvironment(baseURL, projectRoot),
      stdio: "inherit",
    },
  );
  try {
    await waitForServer(server, baseURL);
    const exitCode = await runSuite(projectRoot, baseURL, suite);
    if (exitCode !== 0) throw new Error(`Test suite "${suite}" failed with exit code ${exitCode}`);
    await stopServer(server);
    rmSync(projectRoot, { recursive: true, force: true });
  } catch (error) {
    await stopServer(server);
    throw error;
  } finally {
    if (server.exitCode === null) {
      await new Promise<void>((resolveExit) => server.once("close", () => resolveExit()));
    }
  }
}

await main();
