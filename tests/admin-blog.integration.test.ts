import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const database = process.env.JOBVION_TEST_DB_URL;
if (database && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname)) {
  throw new Error("Admin and blog tests require a local disposable database");
}

type Actor = "owner" | "editor" | "support" | "outsider" | "anon" | "service";

async function fixture(run: (fixture: {
  db: Client; setActor: (role: Actor, aal?: "aal1" | "aal2") => Promise<void>;
  ids: Record<"owner" | "editor" | "support" | "outsider", string>;
  content: Record<string, unknown>;
}) => Promise<void>) {
  const db = new Client({ connectionString: database });
  const ids = { owner: randomUUID(), editor: randomUUID(), support: randomUUID(), outsider: randomUUID() };
  await db.connect();
  try {
    await db.query("begin");
    for (const [role, id] of Object.entries(ids)) {
      await db.query("insert into auth.users (id, email) values ($1,$2)", [id, id + "@example.test"]);
      if (role !== "outsider") await db.query("insert into public.admin_memberships values ($1,$2,now())", [id, role]);
    }

    async function setActor(role: Actor, aal: "aal1" | "aal2" = "aal2") {
      await db.query("reset role");
      const authenticated = role !== "anon" && role !== "service";
      const id = authenticated ? ids[role] : "";
      await db.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
        [id, JSON.stringify({ sub: id, aal })]);
      await db.query(authenticated ? "set local role authenticated" : role === "anon" ? "set local role anon" : "set local role service_role");
    }

    await run({
      db, setActor, ids,
      content: {
        translation_group: null, locale: "en", slug: "fixture-" + randomUUID(),
        title: "Local editorial fixture", excerpt: "A useful excerpt.", body: "## Edit\n\nA test paragraph.",
        author: "Jobvion", category: "Tests", tags: ["Tests"], seo_title: "", seo_description: "",
      },
    });
  } finally {
    await db.query("rollback");
    await db.end();
  }
}

async function denied(db: Client, callback: () => Promise<unknown>, code: string) {
  await db.query("savepoint denied_call");
  try {
    await expect(callback()).rejects.toMatchObject({ code });
  } finally {
    await db.query("rollback to denied_call");
    await db.query("release savepoint denied_call");
  }
}

const change = "select public.change_blog_post($1,$2,$3,$4,$5,$6) as id";

describe.runIf(Boolean(database))("admin and blog database", () => {
  it("enforces roles and MFA at the data layer and keeps drafts private", () => fixture(async ({ db, setActor, content }) => {
    await setActor("editor", "aal1");
    await denied(db, () => db.query(change, [null,null,"save",content,null,null]), "42501");
    await setActor("editor");
    const { rows } = await db.query(change, [null,null,"save",content,null,null]);
    const id = rows[0].id;
    await db.query(change, [id,1,"review",null,null,null]);
    await denied(db, () => db.query(change, [id,2,"publish",null,null,null]), "42501");
    await setActor("anon");
    expect((await db.query("select id from public.blog_posts where id = $1", [id])).rowCount).toBe(0);
    await setActor("outsider");
    expect((await db.query("select id from public.blog_posts where id = $1", [id])).rowCount).toBe(0);
    await setActor("owner");
    await db.query(change, [id,2,"publish",null,null,null]);
    await setActor("anon");
    expect((await db.query("select status from public.blog_posts where id = $1", [id])).rows).toEqual([{ status: "published" }]);
    await setActor("owner");
    await db.query(change, [id,3,"unpublish",null,null,null]);
    await setActor("anon");
    expect((await db.query("select id from public.blog_posts where id = $1", [id])).rowCount).toBe(0);
  }));

  it("prevents lost edits, duplicate slugs, and writes outside the workflow", () => fixture(async ({ db, setActor, content }) => {
    await setActor("editor");
    const first = await db.query(change, [null,null,"save",content,null,null]);
    const id = first.rows[0].id;
    await db.query(change, [id,1,"save",{ ...content, title: "Revised" },null,null]);
    await denied(db, () => db.query(change, [id,1,"save",content,null,null]), "40001");
    await denied(db, () => db.query(change, [null,null,"save",content,null,null]), "23505");
    await denied(db, () => db.query("update public.blog_posts set status = 'published' where id=$1",[id]), "42501");
    await setActor("owner");
    await db.query(change, [id,2,"restore",null,null,1]);
    const post = await db.query("select title,revision,status from public.blog_posts where id=$1",[id]);
    expect(post.rows).toEqual([{ title: content.title, revision: 3, status: "draft" }]);
    const events = await db.query("select action from public.admin_audit where target_id=$1 order by id", [id]);
    expect(events.rows.map((row) => row.action)).toEqual(["blog.save","blog.save","blog.restore"]);
  }));

  it("publishes due articles exactly once through the service worker", () => fixture(async ({ db, setActor, content }) => {
    await setActor("owner");
    const { rows } = await db.query(change, [null,null,"save",content,null,null]);
    const id = rows[0].id;
    await db.query(change, [id,1,"review",null,null,null]);
    await db.query(change, [id,2,"schedule",null,new Date(Date.now() + 3600000),null]);
    await denied(db, () => db.query("select public.publish_due_blog_posts()"), "42501");
    await setActor("anon");
    expect((await db.query("select id from public.blog_posts where id=$1",[id])).rowCount).toBe(0);
    await setActor("service");
    expect((await db.query("select public.publish_due_blog_posts() as count")).rows[0].count).toBe(0);
    await db.query("reset role");
    await db.query("update public.blog_posts set scheduled_at=now()-interval '1 minute' where id=$1",[id]);
    await setActor("service");
    expect((await db.query("select public.publish_due_blog_posts() as count")).rows[0].count).toBe(1);
    expect((await db.query("select public.publish_due_blog_posts() as count")).rows[0].count).toBe(0);
    await setActor("owner");
    expect((await db.query("select action from public.admin_audit where target_id=$1 order by id desc limit 1",[id])).rows[0].action)
      .toBe("blog.scheduled_publish");
  }));

  it("limits account lookup, reporting, role assignment and audit access", () => fixture(async ({ db, setActor, ids }) => {
    await setActor("support");
    await denied(db, () => db.query("select public.admin_overview(7)"), "42501");
    await denied(db, () => db.query("select public.assign_admin_role($1,'analyst')", [ids.outsider]), "42501");
    const account = await db.query("select public.admin_lookup_account($1) as account", [ids.outsider + "@example.test"]);
    expect(Object.keys(account.rows[0].account).sort()).toEqual(["createdAt","free","id","paid","purchases"].sort());
    expect((await db.query("select * from public.admin_audit")).rowCount).toBe(0);
    await setActor("owner");
    const report = await db.query("select public.admin_overview(7) as report");
    expect(report.rows[0].report.newUsers).toBeGreaterThanOrEqual(4);
    await db.query("select public.assign_admin_role($1,'analyst')", [ids.outsider]);
    await setActor("outsider");
    expect((await db.query("select public.current_admin_role() as role")).rows[0].role).toBe("analyst");
    await denied(db, () => db.query("select public.admin_lookup_account($1)", [ids.owner + "@example.test"]), "42501");
  }));
});
