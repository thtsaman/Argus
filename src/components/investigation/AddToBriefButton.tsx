"use client";

import React, { useState } from "react";

interface AddToBriefButtonProps {
  itemType: "BRIDGE" | "FINANCIAL" | "TEMPORAL" | "GEOGRAPHIC" | "ANALYSIS" | "EVIDENCE";
  itemData: any;
  label?: string;
  className?: string;
}

export function AddToBriefButton({ itemType, itemData, label, className }: AddToBriefButtonProps) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdd = () => {
    setLoading(true);

    try {
      const storageKey = "argus_brief_custom_findings";
      const existingStr = localStorage.getItem(storageKey);
      const custom: any = existingStr
        ? JSON.parse(existingStr)
        : {
            bridgeFindings: [],
            financialFindings: [],
            temporalFindings: [],
            geographicFindings: [],
            argusAnalyses: [],
            addedEvidenceIds: [],
          };

      if (itemType === "BRIDGE") {
        if (!custom.bridgeFindings) custom.bridgeFindings = [];
        if (!custom.bridgeFindings.some((b: any) => b.entityId === itemData.entityId)) {
          custom.bridgeFindings.push({
            entityId: itemData.entityId || "BRIDGE-01",
            label: itemData.label || "Bridge Entity",
            communities: itemData.communities || ["Cluster A", "Cluster B"],
            structuralImpact: itemData.structuralImpact || "Key structural nexus connecting separate networks.",
            explanation: itemData.explanation || "Connects disparate clusters.",
          });
        }
      } else if (itemType === "FINANCIAL") {
        if (!custom.financialFindings) custom.financialFindings = [];
        custom.financialFindings.push({
          id: itemData.id || `FIN-${Date.now()}`,
          title: itemData.title || "Synthetic Money Movement",
          amount: itemData.amount,
          channel: itemData.channel,
          date: itemData.date,
          source: itemData.source,
          target: itemData.target,
          details: itemData.details || "Dispatched via high-velocity transactions.",
        });
      } else if (itemType === "TEMPORAL") {
        if (!custom.temporalFindings) custom.temporalFindings = [];
        custom.temporalFindings.push({
          id: itemData.id || `TEMP-${Date.now()}`,
          timeWindow: itemData.timeWindow || "Key Incident Window",
          title: itemData.title || "Temporal Event",
          details: itemData.details || "Significant chronological activity.",
        });
      } else if (itemType === "GEOGRAPHIC") {
        if (!custom.geographicFindings) custom.geographicFindings = [];
        custom.geographicFindings.push({
          id: itemData.id || `GEO-${Date.now()}`,
          locationName: itemData.locationName || "Tracked Site",
          eventTitle: itemData.eventTitle || "Geographic Activity",
          details: itemData.details || "Activity logged at geographic site.",
        });
      } else if (itemType === "ANALYSIS") {
        if (!custom.argusAnalyses) custom.argusAnalyses = [];
        custom.argusAnalyses.push({
          id: itemData.id || `ANALYSIS-${Date.now()}`,
          question: itemData.question || "Investigative Query",
          response: itemData.response || "ARGUS Analytical Response",
          contextLabel: itemData.contextLabel || "Contextual Analysis",
          generatedAt: new Date().toISOString(),
        });
      } else if (itemType === "EVIDENCE") {
        if (!custom.addedEvidenceIds) custom.addedEvidenceIds = [];
        if (itemData.id && !custom.addedEvidenceIds.includes(itemData.id)) {
          custom.addedEvidenceIds.push(itemData.id);
        }
      }

      localStorage.setItem(storageKey, JSON.stringify(custom));
      setAdded(true);
    } catch {
      console.error("Failed to add finding to brief");
    } finally {
      setLoading(false);
    }
  };

  const defaultText = label || `Add ${itemType.charAt(0) + itemType.slice(1).toLowerCase()} to Brief`;

  return (
    <button
      onClick={handleAdd}
      disabled={added || loading}
      className={
        className ||
        `px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-all ${
          added
            ? "bg-emerald-700 text-white border-emerald-800"
            : "bg-surface hover:bg-surface-elevated text-foreground border-border"
        }`
      }
    >
      {added ? "✓ Added to Brief" : loading ? "Adding..." : defaultText}
    </button>
  );
}
