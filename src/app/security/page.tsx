"use client";

import { useState, useEffect } from "react";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";

export default function SecurityPage() {
  const [auditResult, setAuditResult] = useState<{
    valid: boolean;
    totalRecords: number;
    message: string;
    brokenAt?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; role: string; email: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/users").then((r) => r.json()).then((d) => setUsers(d.users || []));
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setCurrentUser(d.userId || ""));
  }, []);

  const verifyChain = async () => {
    setLoading(true);
    const res = await fetch("/api/security/audit/verify");
    const data = await res.json();
    setAuditResult(data);
    setLoading(false);
  };

  const switchUser = async (userId: string) => {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setCurrentUser(userId);
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <PageHeader
        title="Security status"
        description="Practical security controls — RBAC, audit logging, and tamper-evident audit chain."
      />

      <div className="space-y-6">
        <div className="surface-elevated p-5">
          <SectionHeader title="Role-based access" subtitle="Switch demo user to test permissions" />
          <div className="space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  currentUser === u.id ? "border-accent bg-surface" : "border-border hover:border-border-strong"
                }`}
              >
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-text-muted">{u.role} — {u.email}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-elevated p-5">
          <SectionHeader title="Tamper-evident audit chain" subtitle="SHA-256 linked audit records" />
          <button
            onClick={verifyChain}
            disabled={loading}
            className="text-sm px-4 py-1.5 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify audit chain"}
          </button>
          {auditResult && (
            <div className={`mt-4 p-3 rounded border ${auditResult.valid ? "border-status-verified" : "border-status-rejected"}`}>
              <p className={`text-sm font-medium ${auditResult.valid ? "status-verified" : "status-rejected"}`}>
                {auditResult.valid ? "Chain valid" : "Chain compromised"}
              </p>
              <p className="text-xs text-text-muted mt-1">{auditResult.message}</p>
              <p className="text-xs text-text-muted">Total records: {auditResult.totalRecords}</p>
            </div>
          )}
        </div>

        <div className="surface p-5">
          <SectionHeader title="Security architecture" />
          <ul className="text-sm text-text-secondary space-y-1">
            <li>Server-side authorization on all protected operations</li>
            <li>Input validation via Zod schemas</li>
            <li>Prompt injection separation for evidence content</li>
            <li>Cryptographic audit chain (SHA-256, not blockchain)</li>
            <li>Evidence-grounded AI with limited context retrieval</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
