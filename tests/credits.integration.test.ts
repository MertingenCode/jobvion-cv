import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const database = process.env.JOBVION_TEST_DB_URL;
const endpoint = database ? new URL(database) : undefined;
if (endpoint && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) {
  throw new Error("Credit tests require a local disposable database");
}

describe.runIf(Boolean(endpoint))("credit database", () => {
  const users: string[] = [];
  let pool: Pool;
  const packageId = randomUUID();
  const priceId = "fixture-" + packageId;

  beforeAll(async () => {
    pool = new Pool({ connectionString: database, max: 20 });
    await pool.query(
      "insert into public.credit_packages (id, paddle_price_id, credits, base_price_cents) values ($1, $2, 15, 499)",
      [packageId, priceId],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from public.credit_ledger where user_id = any($1::uuid[])", [users]);
    await pool.query("delete from public.purchases where user_id = any($1::uuid[])", [users]);
    await pool.query("delete from public.credit_packages where id = $1", [packageId]);
    await pool.query("delete from auth.users where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  async function user() {
    const id = randomUUID();
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, id + "@example.test"]);
    users.push(id);
    return id;
  }

  function spend(id: string, key = randomUUID()) {
    return pool.query<{ run: string | null }>("select public.spend_credits($1, $2) as run", [id, key])
      .then(({ rows }) => rows[0].run);
  }

  it("blocks cross-user reads and authenticated credit mutations", async () => {
    const [first, second] = await Promise.all([user(), user()]);
    await Promise.all([spend(first), spend(second)]);
    const connection = new Client({ connectionString: database });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [first]);
      for (const table of ["credit_accounts", "credit_ledger", "generation_runs", "purchases"] as const) {
        const result = await connection.query(`select user_id from public.${table} where user_id = $1`, [second]);
        expect(result.rowCount).toBe(0);
      }
      const own = await connection.query("select user_id from public.credit_accounts");
      expect(own.rows).toEqual([{ user_id: first }]);
      const privilege = await connection.query(
        "select has_function_privilege('public.spend_credits(uuid,uuid)', 'execute') as allowed",
      );
      expect(privilege.rows[0].allowed).toBe(false);
    } finally {
      await connection.query("rollback");
      await connection.end();
    }
  });

  it("never overdraws under parallel connections", async () => {
    const id = await user();
    const results = await Promise.all(Array.from({ length: 16 }, () => spend(id)));
    expect(results.filter(Boolean)).toHaveLength(3);
    const { rows } = await pool.query("select free_credits, paid_credits from public.credit_accounts where user_id = $1", [id]);
    expect(rows).toEqual([{ free_credits: 0, paid_credits: 0 }]);
  });

  it("spends a repeated key once, reverses once, and resets without rollover", async () => {
    const id = await user();
    const key = randomUUID();
    const runs = await Promise.all([spend(id, key), spend(id, key), spend(id, key)]);
    expect(new Set(runs).size).toBe(1);
    const reverse = () => pool.query("select public.reverse_spend($1, $2) as restored", [id, runs[0]]);
    const reversals = await Promise.all([reverse(), reverse()]);
    expect(reversals.map(({ rows }) => rows[0].restored)).toEqual([1, 1]);
    const { rows: ledger } = await pool.query("select reason, delta from public.credit_ledger where user_id = $1 order by delta", [id]);
    expect(ledger).toEqual([{ reason: "spend", delta: -1 }, { reason: "reversal", delta: 1 }]);

    await pool.query("update public.credit_accounts set free_month = free_month - 40, free_credits = 1 where user_id = $1", [id]);
    const { rows } = await pool.query("select free_credits from public.reset_free_credits($1)", [id]);
    expect(rows[0].free_credits).toBe(3);
  });

  it("grants purchases once, spends free first, and deducts only the refunded pack", async () => {
    const id = await user();
    const transaction = randomUUID();
    const otherTransaction = randomUUID();
    const grant = (txn: string) => pool.query("select public.grant_purchase($1, $2, $3, 'USD', 499) as id", [id, txn, priceId]);
    const grants = await Promise.all([grant(transaction), grant(transaction)]);
    expect(grants[0].rows).toEqual(grants[1].rows);
    await Promise.all(Array.from({ length: 4 }, () => spend(id)));
    await grant(otherTransaction);
    const adjustment = randomUUID();
    const partial = () => pool.query("select public.apply_refund($1, $2, 250) as deducted", [transaction, adjustment]);
    const deductions = await Promise.all([partial(), partial()]);
    expect(deductions.map(({ rows }) => rows[0].deducted)).toEqual([7, 7]);
    const final = await pool.query("select public.apply_refund($1, $2, 249) as deducted", [transaction, randomUUID()]);
    expect(final.rows[0].deducted).toBe(7);
    const { rows } = await pool.query("select free_credits, paid_credits, refund_count from public.credit_accounts where user_id = $1", [id]);
    expect(rows).toEqual([{ free_credits: 0, paid_credits: 15, refund_count: 2 }]);
  });
});
