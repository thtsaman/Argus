"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/lib/config";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/investigations", label: "Investigations" },
  { href: "/security", label: "Security" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const investigationMatch = pathname.match(/\/investigations\/([^/]+)/);
  const investigationId = investigationMatch?.[1];

  const investigationNav = investigationId
    ? [
      { href: `/investigations/${investigationId}`, label: "Overview" },
      { href: `/investigations/${investigationId}/evidence-space`, label: "Evidence Space" },
      { href: `/investigations/${investigationId}/bridge`, label: "Bridge View" },
      { href: `/investigations/${investigationId}/timeline`, label: "Timeline" },
      { href: `/investigations/${investigationId}/map`, label: "Geographic" },
      { href: `/investigations/${investigationId}/replay`, label: "Replay" },
      { href: `/investigations/${investigationId}/intake`, label: "Evidence Intake" },
      { href: `/investigations/${investigationId}/review`, label: "Review" },
      { href: `/investigations/${investigationId}/assistant`, label: "Assistant" },
    ]
    : [];

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      <header className="border-b border-border bg-surface-elevated sticky top-0 z-30" suppressHydrationWarning>
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <Link href="/investigations" className="font-serif text-xl font-semibold text-foreground hover:text-accent transition-colors">
              {APP_CONFIG.name}
            </Link>
            <p className="text-xs text-text-muted mt-0.5">{APP_CONFIG.tagline}</p>
          </div>
          <nav className="flex items-center gap-1 relative" suppressHydrationWarning>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 text-sm rounded transition-colors ${isActive
                      ? "text-foreground font-medium"
                      : "text-text-secondary hover:text-foreground"
                    }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="main-nav-pill"
                      className="absolute inset-0 bg-background rounded shadow-sm border border-border/50"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        {investigationNav.length > 0 && (
          <div className="border-t border-border" suppressHydrationWarning>
            <div className="max-w-[1400px] mx-auto px-6 py-2 flex gap-1 overflow-x-auto" suppressHydrationWarning>
              {investigationNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1 text-sm whitespace-nowrap rounded transition-colors ${isActive
                        ? "text-foreground font-medium"
                        : "text-text-secondary hover:text-foreground"
                      }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sub-nav-pill"
                        className="absolute inset-0 bg-background rounded shadow-sm border border-border/50"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>
      <motion.main
        key={pathname}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="flex-1 min-h-[calc(100vh-140px)]"
        suppressHydrationWarning
      >
        {children}
      </motion.main>
    </div>
  );
}
