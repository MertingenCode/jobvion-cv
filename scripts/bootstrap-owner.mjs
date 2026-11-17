import { createClient } from "@supabase/supabase-js";

async function main() {
  const [flag, id, confirmation, ...extra] = process.argv.slice(2);
  if (flag !== "--user" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id ?? "") || confirmation !== "--confirm" || extra.length) {
    throw new Error("Usage: npm run admin:bootstrap -- --user <confirmed-auth-user-uuid> --confirm");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure the Supabase URL and server service key in .env.local.");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: account, error: accountError } = await db.auth.admin.getUserById(id);
  if (accountError || !account.user?.email_confirmed_at) throw new Error("The owner must be a confirmed user.");
  const { data: owner, error } = await db.from("admin_memberships").select("user_id").eq("role", "owner").maybeSingle();
  if (error) throw new Error("Could not check the owner. Apply the admin migration first.");
  if (owner?.user_id === id) {
    console.log("This account is already the owner.");
    return;
  }
  if (owner) throw new Error("An owner already exists.");
  const inserted = await db.from("admin_memberships").insert({ user_id: id, role: "owner" });
  if (inserted.error) throw new Error("Could not create the owner. Verify the account and migrations.");
  console.log("Owner assigned. Sign in and open /en/admin to enroll an authenticator.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
