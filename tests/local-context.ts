const testBaseURL = process.env.TEST_BASE_URL;

if (!testBaseURL) {
  throw new Error("TEST_BASE_URL must be set by scripts/test-local.ts");
}

export const baseURL: string = testBaseURL;

const testAdminToken = process.env.TEST_ADMIN_TOKEN;

if (!testAdminToken) {
  throw new Error("TEST_ADMIN_TOKEN must be set by scripts/test-local.ts");
}

export const adminToken: string = testAdminToken;

const testContentCheckToken = process.env.TEST_CONTENT_CHECK_TOKEN;

if (!testContentCheckToken) {
  throw new Error("TEST_CONTENT_CHECK_TOKEN must be set by scripts/test-local.ts");
}

export const contentCheckToken: string = testContentCheckToken;
