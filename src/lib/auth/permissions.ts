import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "../db";

export type Permission =
  | "investigation:read"
  | "investigation:write"
  | "evidence:read"
  | "evidence:write"
  | "evidence:upload"
  | "relationship:read"
  | "relationship:write"
  | "relationship:verify"
  | "ai:query"
  | "audit:read"
  | "admin:all";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ANALYST: [
    "investigation:read",
    "evidence:read",
    "evidence:upload",
    "relationship:read",
    "ai:query",
  ],
  INVESTIGATOR: [
    "investigation:read",
    "investigation:write",
    "evidence:read",
    "evidence:write",
    "evidence:upload",
    "relationship:read",
    "relationship:write",
    "relationship:verify",
    "ai:query",
  ],
  SUPERVISOR: [
    "investigation:read",
    "investigation:write",
    "evidence:read",
    "evidence:write",
    "evidence:upload",
    "relationship:read",
    "relationship:write",
    "relationship:verify",
    "ai:query",
    "audit:read",
  ],
  ADMIN: ["admin:all"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes("admin:all") || perms.includes(permission);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }
  return db.user.findFirst({ where: { role: "INVESTIGATOR" } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AuthError("Insufficient permissions");
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
