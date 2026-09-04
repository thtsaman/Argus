export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="font-serif text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0" suppressHydrationWarning>{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h2 className="font-serif text-lg font-medium text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="surface p-12 text-center" suppressHydrationWarning>
      <p className="font-serif text-lg text-foreground">{title}</p>
      {description && <p className="text-sm text-text-muted mt-2">{description}</p>}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="surface p-12 text-center flex flex-col items-center justify-center space-y-4" suppressHydrationWarning>
      <div className="relative flex items-center justify-center w-14 h-14">
        {/* Outer rotating loading ring */}
        <div className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        {/* Inner static ARGUS logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.svg"
          alt="ARGUS Logo"
          className="w-7 h-7 object-contain relative z-10"
        />
      </div>
      {message && <p className="text-xs text-text-muted font-medium">{message}</p>}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="surface p-12 text-center border-status-rejected" suppressHydrationWarning>
      <p className="font-serif text-lg text-status-rejected">{title}</p>
      {description && <p className="text-sm text-text-muted mt-2">{description}</p>}
    </div>
  );
}

export function ConfidenceIndicator({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <span className="text-xs text-text-muted">
      {pct}% confidence
    </span>
  );
}
