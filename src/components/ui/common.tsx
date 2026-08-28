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
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-lg font-medium text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="surface p-12 text-center">
      <p className="font-serif text-lg text-foreground">{title}</p>
      {description && <p className="text-sm text-text-muted mt-2">{description}</p>}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="surface p-12 text-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="surface p-12 text-center border-status-rejected">
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
