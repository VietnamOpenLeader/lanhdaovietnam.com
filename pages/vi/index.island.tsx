import type { Props } from "./index.server";

export default function HomePage(props: Props) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="mb-3 text-sm font-medium">Lãnh đạo Việt Nam</p>
      <h1 className="text-4xl font-semibold">{props.title}</h1>
      <p className="mt-4 max-w-2xl text-sm">{props.description}</p>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        {props.articles.map((article) => (
          <article className="ring ring-kumo-line rounded-xl p-6" key={article.url}>
            <h2 className="text-lg font-semibold">{article.title}</h2>
            <p className="mt-2 text-sm">{article.description}</p>
            <a className="mt-4 inline-block text-sm font-medium" href={article.url}>
              Đọc bài viết
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
