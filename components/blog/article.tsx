import { articleParts } from "@/lib/blog/schema";

export function ArticleBody({ body }: { body: string }) {
  return <div className="article-copy">
    {articleParts(body).map((part, index) => {
      if (part.type === "heading") return <h2 key={index}>{part.text}</h2>;
      if (part.type === "list") return <ul key={index}>{part.items.map((item, key) => <li key={key}>{item}</li>)}</ul>;
      return <p key={index}>{part.text}</p>;
    })}
  </div>;
}
