import { beforeEach, describe, expect, it, vi } from "vitest";
import { otpAuth, socialAuth } from "@/lib/auth/actions";

const { auth, allow, reconcile, redirect, siteKey } = vi.hoisted(() => ({
  auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signInWithOAuth: vi.fn() },
  allow: vi.fn(), reconcile: vi.fn(), siteKey: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error("redirect " + url); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/rate-limit", () => ({ allowAuthAttempt: allow }));
vi.mock("@/lib/auth/turnstile", () => ({ signupSiteKey: siteKey, signupChallengeRequired: () => false }));
vi.mock("@/lib/auth/locale", () => ({ reconcileLocale: reconcile }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: async () => ({ auth }) }));
vi.mock("@/lib/env", () => ({ readEnv: () => ({ APP_ORIGIN: "http://localhost:3000" }) }));

function fields(data: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) form.set(key, value);
  return form;
}

describe("passwordless authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    allow.mockResolvedValue(true);
    auth.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("uses an email code, and keeps sign-in from creating a new account", async () => {
    const status = await otpAuth("tr", "login", "email", undefined, null, fields({ operation: "send", contact: " Deniz@Example.test " }));
    expect(status).toBe("sent");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "deniz@example.test",
      options: { shouldCreateUser: false, data: { jobvion_locale: "tr" }, emailRedirectTo: "http://localhost:3000/auth/callback?locale=tr" },
    });
    auth.signInWithOtp.mockResolvedValue({ error: { code: "otp_disabled" } });
    expect(await otpAuth("tr", "login", "email", undefined, null, fields({ operation: "send", contact: "absent@example.test" }))).toBe("sent");
  });

  it("normalizes international phone numbers and requires the configured challenge on send", async () => {
    siteKey.mockReturnValue("configured");
    const contact = { operation: "send", contact: "+90 (555) 010 0100" };
    expect(await otpAuth("tr", "signup", "sms", undefined, null, fields(contact))).toBe("challenge");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(await otpAuth("tr", "signup", "sms", undefined, null, fields({ ...contact, "cf-turnstile-response": "challenge-value" }))).toBe("sent");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+905550100100",
      options: { shouldCreateUser: true, data: { jobvion_locale: "tr" }, captchaToken: "challenge-value", channel: "sms" },
    });
  });

  it("verifies with the provider and enters the workspace only with a session", async () => {
    const request = fields({ operation: "verify", contact: "+905550100100", code: "012345" });
    auth.verifyOtp.mockResolvedValueOnce({ error: null, data: { user: {}, session: null } });
    expect(await otpAuth("tr", "login", "sms", undefined, null, request)).toBe("codeInvalid");
    auth.verifyOtp.mockResolvedValueOnce({ error: null, data: { user: { user_metadata: {} }, session: {} } });
    await expect(otpAuth("tr", "login", "sms", undefined, null, request)).rejects.toThrow("redirect /tr/app");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: "+905550100100", token: "012345", type: "sms" });
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it.each(["apple", "google"] as const)("starts %s OAuth with the localized callback", async (provider) => {
    auth.signInWithOAuth.mockResolvedValue({ error: null, data: { url: "https://example.test/authorize" } });
    await expect(socialAuth("tr", provider)).rejects.toThrow("redirect https://example.test/authorize");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider, options: { redirectTo: "http://localhost:3000/auth/callback?locale=tr" } });
  });
});
