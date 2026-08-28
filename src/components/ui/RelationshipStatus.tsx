import { RelationshipStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  RelationshipStatus,
  { label: string; className: string; lineStyle: string }
> = {
  DIRECT: { label: "Direct", className: "status-direct", lineStyle: "solid" },
  VERIFIED: { label: "Verified", className: "status-verified", lineStyle: "solid" },
  UNDER_REVIEW: { label: "Under Review", className: "status-review", lineStyle: "dashed" },
  AI_SUGGESTED: { label: "AI Suggested", className: "status-ai", lineStyle: "dotted" },
  REJECTED: { label: "Rejected", className: "status-rejected", lineStyle: "dashed" },
};

export function RelationshipStatusBadge({ status }: { status: RelationshipStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border border-border ${config.className}`}
    >
      <span
        className="w-3 h-0 border-t-2"
        style={{ borderStyle: config.lineStyle as "solid" | "dashed" | "dotted" }}
      />
      {config.label}
    </span>
  );
}

export function getLinkStyle(status: RelationshipStatus): {
  color: string;
  dashArray: string | undefined;
  opacity: number;
} {
  const styles: Record<RelationshipStatus, { color: string; dashArray: string | undefined; opacity: number }> = {
    DIRECT: { color: "#3d5a6b", dashArray: undefined, opacity: 0.9 },
    VERIFIED: { color: "#4a6741", dashArray: undefined, opacity: 0.9 },
    UNDER_REVIEW: { color: "#8b6914", dashArray: "6,4", opacity: 0.7 },
    AI_SUGGESTED: { color: "#7a5c8a", dashArray: "2,4", opacity: 0.6 },
    REJECTED: { color: "#8b4444", dashArray: "4,4", opacity: 0.3 },
  };
  return styles[status];
}
