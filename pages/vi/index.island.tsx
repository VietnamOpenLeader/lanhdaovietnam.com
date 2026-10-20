import type { Props } from "./index.server";

export default function HomePage({ title, description }: Props) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="mb-3 text-sm font-medium">Lãnh đạo Việt Nam</p>
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm">{description}</p>
    </main>
  );
}
