"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface InvestigationNavProps {
  investigationId: string;
}

const EXPLORE_ITEMS = [
  {
    hrefSuffix: "/evidence-space",
    label: "Network",
    description: "Explore entities and relationships",
  },
  {
    hrefSuffix: "/bridge",
    label: "Connections",
    description: "Examine important connections between groups",
  },
  {
    hrefSuffix: "/timeline",
    label: "Timeline",
    description: "Understand events over time",
  },
  {
    hrefSuffix: "/map",
    label: "Map",
    description: "Explore geographic activity",
  },
  {
    hrefSuffix: "/replay",
    label: "Replay",
    description: "See how the investigation developed",
  },
];

const EVIDENCE_ITEMS = [
  {
    hrefSuffix: "/intake",
    label: "Evidence Library",
    description: "Browse and inspect evidence files",
  },
  {
    hrefSuffix: "/intake",
    label: "Evidence Intake",
    description: "Upload or paste new evidence",
  },
];

export function InvestigationNav({ investigationId }: InvestigationNavProps) {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<"explore" | "evidence" | null>(null);

  const exploreRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  const basePath = `/investigations/${investigationId}`;

  const isOverviewActive = pathname === basePath;
  const isExploreActive = EXPLORE_ITEMS.some((item) => pathname === `${basePath}${item.hrefSuffix}`);
  const isEvidenceActive = EVIDENCE_ITEMS.some((item) => pathname === `${basePath}${item.hrefSuffix}`);
  const isReviewActive = pathname === `${basePath}/review`;
  const isAssistantActive = pathname === `${basePath}/assistant`;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        openDropdown === "explore" &&
        exploreRef.current &&
        !exploreRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
      if (
        openDropdown === "evidence" &&
        evidenceRef.current &&
        !evidenceRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <div className="border-t border-border bg-surface-elevated" suppressHydrationWarning>
      <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center gap-1.5 overflow-x-visible relative" suppressHydrationWarning>
        {/* 1. Overview */}
        <Link
          href={basePath}
          className={`relative px-3.5 py-1.5 text-sm rounded transition-colors ${
            isOverviewActive
              ? "text-foreground font-medium"
              : "text-text-secondary hover:text-foreground"
          }`}
        >
          {isOverviewActive && (
            <motion.span
              layoutId="sub-nav-pill"
              className="absolute inset-0 bg-background rounded shadow-2xs border border-border/60"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative z-10">Overview</span>
        </Link>

        {/* 2. Explore (Dropdown) */}
        <div ref={exploreRef} className="relative">
          <button
            onClick={() => setOpenDropdown((prev) => (prev === "explore" ? null : "explore"))}
            className={`relative px-3.5 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
              isExploreActive
                ? "text-foreground font-medium"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {isExploreActive && (
              <motion.span
                layoutId="sub-nav-pill"
                className="absolute inset-0 bg-background rounded shadow-2xs border border-border/60"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">Explore</span>
            <span className="relative z-10 text-[10px] opacity-70">▼</span>
          </button>

          <AnimatePresence>
            {openDropdown === "explore" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 mt-1.5 w-64 bg-surface-elevated border border-border rounded-md shadow-md z-50 py-1"
              >
                {EXPLORE_ITEMS.map((item) => {
                  const href = `${basePath}${item.hrefSuffix}`;
                  const isSubActive = pathname === href;
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`block px-3.5 py-2 hover:bg-background transition-colors ${
                        isSubActive ? "bg-background font-medium text-foreground" : "text-text-secondary"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{item.label}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{item.description}</div>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. Evidence (Dropdown) */}
        <div ref={evidenceRef} className="relative">
          <button
            onClick={() => setOpenDropdown((prev) => (prev === "evidence" ? null : "evidence"))}
            className={`relative px-3.5 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
              isEvidenceActive
                ? "text-foreground font-medium"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {isEvidenceActive && (
              <motion.span
                layoutId="sub-nav-pill"
                className="absolute inset-0 bg-background rounded shadow-2xs border border-border/60"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">Evidence</span>
            <span className="relative z-10 text-[10px] opacity-70">▼</span>
          </button>

          <AnimatePresence>
            {openDropdown === "evidence" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 mt-1.5 w-60 bg-surface-elevated border border-border rounded-md shadow-md z-50 py-1"
              >
                {EVIDENCE_ITEMS.map((item) => {
                  const href = `${basePath}${item.hrefSuffix}`;
                  const isSubActive = pathname === href;
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`block px-3.5 py-2 hover:bg-background transition-colors ${
                        isSubActive ? "bg-background font-medium text-foreground" : "text-text-secondary"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{item.label}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{item.description}</div>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. Review */}
        <Link
          href={`${basePath}/review`}
          className={`relative px-3.5 py-1.5 text-sm rounded transition-colors ${
            isReviewActive
              ? "text-foreground font-medium"
              : "text-text-secondary hover:text-foreground"
          }`}
        >
          {isReviewActive && (
            <motion.span
              layoutId="sub-nav-pill"
              className="absolute inset-0 bg-background rounded shadow-2xs border border-border/60"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative z-10">Review</span>
        </Link>

        {/* 5. Assistant */}
        <Link
          href={`${basePath}/assistant`}
          className={`relative px-3.5 py-1.5 text-sm rounded transition-colors ${
            isAssistantActive
              ? "text-foreground font-medium"
              : "text-text-secondary hover:text-foreground"
          }`}
        >
          {isAssistantActive && (
            <motion.span
              layoutId="sub-nav-pill"
              className="absolute inset-0 bg-background rounded shadow-2xs border border-border/60"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative z-10">Assistant</span>
        </Link>
      </div>
    </div>
  );
}
