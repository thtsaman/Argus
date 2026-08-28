"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/lib/config";

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
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface-elevated">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/investigations" className="font-serif text-xl font-semibold text-foreground hover:text-accent transition-colors">
              {APP_CONFIG.name}
            </Link>
            <p className="text-xs text-text-muted mt-0.5">{APP_CONFIG.tagline}</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  pathname.startsWith(item.href)
                    ? "bg-background text-foreground font-medium"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {investigationNav.length > 0 && (
          <div className="border-t border-border">
            <div className="max-w-[1400px] mx-auto px-6 py-2 flex gap-1 overflow-x-auto">
              {investigationNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1 text-sm whitespace-nowrap rounded transition-colors ${
                    pathname === item.href
                      ? "bg-background text-foreground font-medium"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
