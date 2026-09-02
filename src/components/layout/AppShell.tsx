"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { APP_CONFIG } from "@/lib/config";
import { motion } from "framer-motion";

import { InvestigationNav } from "@/components/investigation/InvestigationNav";

const NAV_ITEMS = [
  { href: "/investigations", label: "Investigations" },
  { href: "/security", label: "Security" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const investigationMatch = pathname.match(/\/investigations\/([^/]+)/);
  const investigationId = investigationMatch?.[1];

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      <header className="border-b border-border bg-surface-elevated sticky top-0 z-30" suppressHydrationWarning>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4" suppressHydrationWarning>
          <Link href="/investigations" className="flex items-center gap-3.5 group shrink-0">
            <Image
              src={APP_CONFIG.logo}
              alt={`${APP_CONFIG.name} Logo`}
              width={56}
              height={56}
              priority
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.25em] text-foreground group-hover:text-accent transition-colors leading-none">
                  {APP_CONFIG.name}
                </span>
                {/* <span className="text-[10px] sm:text-xs font-sans tracking-wider uppercase text-[#8b6914] px-1.5 py-0.5 border border-[#8b6914]/40 rounded-sm font-semibold leading-none shrink-0">
                  {APP_CONFIG.version}
                </span> */}
              </div>
              <span className="hidden sm:block text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-text-muted font-sans font-medium mt-1">
                {APP_CONFIG.tagline}
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-1 relative shrink-0" suppressHydrationWarning>
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
        {investigationId && (
          <InvestigationNav investigationId={investigationId} />
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
