import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit/chain";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";

export async function GET() {
  try {
    const user = await requirePermission("audit:read");
    const result = await verifyAuditChain();

    await createAuditLog({
      userId: user.id,
      action: "AUDIT_CHAIN_VERIFIED",
      metadata: { valid: result.valid, totalRecords: result.totalRecords },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      const result = await verifyAuditChain();
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
