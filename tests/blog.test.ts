import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { articleParts, utcSchedule } from "@/lib/blog/schema";
import { ArticleBody } from "@/components/blog/article";
import { permitted } from "@/lib/admin/roles";

describe("blog content and admin boundaries", () => {
  it("parses authored headings and lists without generating markup from user strings", () => {
    expect(articleParts("## A heading\r\n\r\n- One\r\n- Two")).toEqual([
      { type: "heading", text: "A heading" },
      { type: "list", items: ["One", "Two"] },
    ]);
    const content = renderToStaticMarkup(createElement(ArticleBody, {
      body: "<script>alert(1)</script>\n\n- [link](javascript:alert(1))",
    }));
    expect(content).toContain("&lt;script&gt;");
    expect(content).not.toContain("<script");
    expect(content).not.toContain("<a ");
  });

  it("accepts only valid UTC wall times", () => {
    expect(utcSchedule("2026-11-18T10:30")).toBe("2026-11-18T10:30:00.000Z");
    expect(utcSchedule("2026-02-31T10:30")).toBeNull();
    expect(utcSchedule("2026-11-18T10:30+03:00")).toBeNull();
  });

  it("separates editorial, publishing and support permissions", () => {
    expect(permitted("editor", "write")).toBe(true);
    expect(permitted("editor", "publish")).toBe(false);
    expect(permitted("admin", "roles")).toBe(false);
    expect(permitted("owner", "roles")).toBe(true);
    expect(permitted("analyst", "accounts")).toBe(false);
  });
});
