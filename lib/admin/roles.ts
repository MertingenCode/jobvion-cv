export const adminRoles = ["owner", "admin", "editor", "support", "analyst"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = {
  reports: ["owner", "admin", "analyst"],
  accounts: ["owner", "admin", "support"],
  audit: ["owner", "admin"],
  roles: ["owner"],
  write: ["owner", "admin", "editor"],
  publish: ["owner", "admin"],
} satisfies Record<string, AdminRole[]>;

export type AdminPermission = keyof typeof adminPermissions;

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && adminRoles.some((role) => role === value);
}

export function permitted(role: AdminRole, permission: AdminPermission) {
  return adminPermissions[permission].some((allowed) => role === allowed);
}
