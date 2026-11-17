import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { initialProfile } from "@/lib/cv/model";
import { templates } from "@/lib/cv/templates";

const database = process.env.JOBVION_TEST_DB_URL;
if (database && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname)) {
  throw new Error("CV tests require a local disposable database");
}

async function withDatabase(run: (db: Client, owner: string, outsider: string) => Promise<void>) {
  const db = new Client({ connectionString: database });
  await db.connect();
  const owner = randomUUID();
  const outsider = randomUUID();
  try {
    await db.query("begin");
    for (const id of [owner, outsider]) {
      await db.query("insert into auth.users (id, email) values ($1,$2)", [id, id + "@example.test"]);
    }
    await run(db, owner, outsider);
  } finally {
    await db.query("rollback");
    await db.end();
  }
}

async function act(db: Client, user: string) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [user, JSON.stringify({ sub: user, aal: "aal1" })]);
  await db.query("set local role authenticated");
}

async function rejects(db: Client, operation: () => Promise<unknown>, code: string) {
  await db.query("savepoint expect_failure");
  try {
    await expect(operation()).rejects.toMatchObject({ code });
  } finally {
    await db.query("rollback to expect_failure");
    await db.query("release savepoint expect_failure");
  }
}

describe.runIf(Boolean(database))("CV data boundaries", () => {
  it("keeps the application and RLS template catalog in sync", () => withDatabase(async (db) => {
    const actual = await db.query("select id,tier,supports_photo from public.cv_templates order by id");
    expect(actual.rows).toEqual(templates.map(({ id, tier, supports_photo }) => ({ id, tier, supports_photo }))
      .sort((a,b) => a.id.localeCompare(b.id)));
  }));

  it("permits free templates, checks photo support and denies direct premium writes without entitlement", () => withDatabase(async (db, owner) => {
    function canUse(template: string, photo: boolean) {
      return db.query("select public.can_use_cv_template($1,$2) as allowed", [template, photo]).then(({ rows }) => rows[0].allowed);
    }
    function save(id: string, template: string, photo: boolean) {
      return db.query(`insert into public.cvs (id,user_id,template,cv_language,paper,photo_enabled,profile_snapshot)
        values ($1,$2,$3,'en','A4',$4,$5)`, [id, owner, template, photo, initialProfile]);
    }
    await act(db, owner);
    expect(await canUse("essential", false)).toBe(true);
    expect(await canUse("essential", true)).toBe(false);
    expect(await canUse("atlas", false)).toBe(false);
    await rejects(db, () => save(randomUUID(), "atlas", false), "42501");
    await save(randomUUID(), "essential", false);
    await db.query("reset role");
    await db.query("insert into public.cv_template_entitlements(user_id,granted_at,expires_at) values ($1,now()-interval '1 day',now()-interval '1 hour')", [owner]);
    await act(db, owner);
    expect(await canUse("atlas", true)).toBe(false);
    await db.query("reset role");
    await db.query("update public.cv_template_entitlements set expires_at=null where user_id=$1", [owner]);
    await act(db, owner);
    expect(await canUse("atlas", true)).toBe(true);
    await save(randomUUID(), "atlas", true);
  }));

  it("rejects stale drafts and isolates photos, profiles and saved CVs across accounts", () => withDatabase(async (db, owner, outsider) => {
    const doc = randomUUID();
    await db.query("insert into public.cv_profile_photos(user_id,jpeg_base64) values ($1,'/9j/')", [owner]);
    await act(db, owner);
    expect((await db.query("select public.save_cv_profile(0,$1) as revision", [initialProfile])).rows[0].revision).toBe(1);
    await rejects(db, () => db.query("select public.save_cv_profile(0,$1)", [initialProfile]), "40001");
    await db.query("select public.save_cv_profile(1,$1)", [{ ...initialProfile, name: "Synthetic User" }]);
    await db.query("insert into public.cvs(id,user_id,template,cv_language,paper,profile_snapshot) values ($1,$2,'compact','en','Letter',$3)",
      [doc, owner, initialProfile]);
    await rejects(db, () => db.query("update public.cv_profile_photos set jpeg_base64 = 'AAAA'"), "42501");
    await act(db, outsider);
    for (const table of ["profiles", "cv_profile_photos", "cvs"] as const) {
      expect((await db.query(`select user_id from public.${table} where user_id=$1`, [owner])).rowCount).toBe(0);
    }
    expect((await db.query("delete from public.cvs where id=$1", [doc])).rowCount).toBe(0);
  }));
});
