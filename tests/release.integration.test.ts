import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const database = process.env.JOBVION_TEST_DB_URL;
if (database && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname)) {
  throw new Error("Release tests require a local disposable database");
}

async function fixture(run: (db: Client, user: string, owner: string) => Promise<void>) {
  const db = new Client({ connectionString: database });
  const user = randomUUID(), owner = randomUUID();
  await db.connect();
  try {
    await db.query("begin");
    await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [user,user+"@example.test",owner,owner+"@example.test"]);
    await db.query("insert into public.admin_memberships(user_id,role) values ($1,'owner')", [owner]);
    await run(db,user,owner);
  } finally {
    await db.query("rollback");
    await db.end();
  }
}

async function rejection(db: Client, sql: string, args: unknown[], code: string) {
  await db.query("savepoint bad");
  try { await expect(db.query(sql,args)).rejects.toMatchObject({code}); }
  finally { await db.query("rollback to bad"); }
}

describe.runIf(Boolean(database))("release database", () => {
  it("spends once, restores on failure, and enforces three regeneration attempts", () => fixture(async (db,user) => {
    const job = randomUUID();
    await db.query("insert into public.job_matches(id,user_id,profile,report) values ($1,$2,'{}','{}')", [job,user]);
    const start = async (key: string, regenerate = false) =>
      (await db.query("select public.start_application($1,$2,$3,$4) as result", [user,job,key,regenerate])).rows[0].result.state;
    const finish = (key: string, output: Record<string, unknown> | null) =>
      db.query("select public.finish_application($1,$2,$3,$4)", [user,job,key,output]);
    const first = randomUUID();
    expect(await start(first)).toBe("started");
    expect(await start(first)).toBe("running");
    await finish(first,null);
    await finish(first,null);
    expect(await start(first)).toBe("failed");
    expect((await db.query("select free_credits from public.credit_accounts where user_id=$1",[user])).rows[0].free_credits).toBe(3);
    const second = randomUUID();
    expect(await start(second)).toBe("started");
    await finish(second,{cover:"Draft"});
    expect(await start(second)).toBe("succeeded");
    expect((await db.query("select public.edit_application_letter($1,$2,$3) as saved",[user,job,"Edited"])).rows[0].saved).toBe(true);
    for (let i=0;i<3;i++) {
      const key = randomUUID();
      expect(await start(key,true)).toBe("started");
      await finish(key,{cover:"Updated"});
    }
    expect(await start(randomUUID(),true)).toBe("regenerationLimit");
    expect((await db.query("select free_credits from public.credit_accounts where user_id=$1",[user])).rows[0].free_credits).toBe(2);
    await db.query("select public.spend_credits($1,$2)",[user,randomUUID()]);
    await db.query("select public.spend_credits($1,$2)",[user,randomUUID()]);
    const another = randomUUID();
    await db.query("insert into public.job_matches(id,user_id,profile,report) values ($1,$2,'{}','{}')", [another,user]);
    expect((await db.query("select public.start_application($1,$2,$3,false) as result",[user,another,randomUUID()])).rows[0].result.state).toBe("noCredits");
  }));

  it("restricts the promo ledger to MFA admins and excludes grants from purchases", () => fixture(async (db,user,owner) => {
    const grant = randomUUID(), expire = randomUUID();
    const adjust = "select public.adjust_promo($1,$2,$3,$4,$5) as id";
    const act = async (actor: string, aal: string) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[actor,JSON.stringify({sub:actor,aal})]);
      await db.query("set local role authenticated");
    };
    await act(owner,"aal1");
    await rejection(db,adjust,[grant,user,null,3,"Customer support credit"],"42501");
    await act(user,"aal2");
    await rejection(db,adjust,[grant,user,null,3,"Customer support credit"],"42501");
    await act(owner,"aal2");
    for (let i=0;i<2;i++)
      expect((await db.query(adjust,[grant,user,null,3,"Customer support credit"])).rows[0].id).toBe(grant);
    await rejection(db,adjust,[randomUUID(),user,grant,-4,"Unspent promotional credit"],"22023");
    await db.query(adjust,[randomUUID(),user,grant,-1,"Unspent promotional credit"]);
    await db.query(adjust,[expire,user,null,2,"Expired fixture credits"]);
    const inventory = await db.query("select public.read_promo($1) as inventory",[user]);
    expect(inventory.rows[0].inventory).toMatchObject({free:3,paid:0,promo:4,refunds:0});
    await db.query("reset role");
    await db.query("update public.promo_grants set expires_at=now()-interval '1 day' where id=$1",[expire]);
    for (let i=0;i<3;i++) await db.query("select public.spend_credits($1,$2)",[user,randomUUID()]);
    const job = randomUUID(), key = randomUUID();
    await db.query("insert into public.job_matches(id,user_id,profile,report) values ($1,$2,'{}','{}')", [job,user]);
    expect((await db.query("select public.start_application($1,$2,$3,false) as result",[user,job,key])).rows[0].result.state).toBe("started");
    expect((await db.query("select remaining from public.promo_grants where id=$1",[grant])).rows[0].remaining).toBe(1);
    await db.query("select public.finish_application($1,$2,$3,null)",[user,job,key]);
    expect((await db.query("select remaining from public.promo_grants where id=$1",[grant])).rows[0].remaining).toBe(2);
    expect((await db.query("select 1 from public.purchases where user_id=$1",[user])).rowCount).toBe(0);
    expect((await db.query("select action from public.admin_audit where target_id=$1 order by id",[user])).rows.map(({action})=>action))
      .toEqual(["promo.grant","promo.revoke","promo.grant"]);
  }));

  it("deduplicates webhooks, reverses partially spent purchases, and anonymizes deletion", () => fixture(async (db,user) => {
    const price="release-"+randomUUID(),txn=randomUUID(),intent=randomUUID();
    await db.query("insert into public.credit_packages values ($1,$1,15,499)",[price]);
    await db.query("insert into public.checkout_intents(id,user_id,package_id,transaction_id) values($1,$2,$3,$4)",[intent,user,price,txn]);
    const event = async (id:string, kind:string, values:Record<string,unknown>) =>
      (await db.query("select public.process_credit_event($1,$2,$3) as result",[id,kind,values])).rows[0].result;
    await event(randomUUID(),"transaction.completed",{transaction:txn,intent,price:"wrong",currency:"USD",amount:499});
    expect((await db.query("select 1 from public.purchases where user_id=$1",[user])).rowCount).toBe(0);
    const funding=randomUUID();
    const data={transaction:txn,intent,price,currency:"USD",amount:499};
    expect(await event(funding,"transaction.completed",data)).toBe("processed");
    expect(await event(funding,"transaction.completed",data)).toBe("duplicate");
    for (let i=0;i<4;i++) await db.query("select public.spend_credits($1,$2)",[user,randomUUID()]);
    const partial = {transaction:txn,adjustment:randomUUID(),currency:"USD",amount:250};
    await event(randomUUID(),"adjustment.created",partial);
    await event(randomUUID(),"adjustment.updated",partial);
    await event(randomUUID(),"adjustment.updated",{...partial,adjustment:randomUUID(),amount:249});
    expect((await db.query("select paid_credits,refund_count from public.credit_accounts where user_id=$1",[user])).rows[0])
      .toEqual({paid_credits:0,refund_count:2});

    const profile = { schema_version: 1, name: "Deletion fixture" };
    await db.query("insert into public.profiles(user_id,data) values ($1,$2)",[user,profile]);
    await db.query("insert into public.cvs(id,user_id,template,cv_language,paper,profile_snapshot) values ($1,$2,'essential','en','A4',$3)", [randomUUID(),user,profile]);
    await db.query("insert into public.account_deletions(user_id,due_at) values ($1,now()-interval '1 hour')",[user]);
    expect((await db.query("select * from public.claim_account_deletions()")).rows).toContainEqual({claim_account_deletions:user});
    expect((await db.query("select * from public.claim_account_deletions()")).rows).not.toContainEqual({claim_account_deletions:user});
    await db.query("delete from auth.users where id=$1",[user]);
    expect((await db.query("select 1 from public.profiles where user_id=$1",[user])).rowCount).toBe(0);
    expect((await db.query("select 1 from public.cvs where user_id=$1",[user])).rowCount).toBe(0);
    expect((await db.query("select user_id,refunded_cents from public.purchases where transaction_id=$1",[txn])).rows)
      .toEqual([{user_id:null,refunded_cents:499}]);
  }));
});
