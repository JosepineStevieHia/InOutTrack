import type { ReactNode } from "react";

export type SummaryCardVariant = "default" | "inbound" | "outbound" | "admin";

export type SummaryCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  badgeText?: string;
  icon?: ReactNode;
  variant?: SummaryCardVariant;
  isLoading?: boolean;
};

const ICON_VARIANT_STYLES: Record<SummaryCardVariant, string> = {
  default: "bg-blue-50 text-blue-700 ring-blue-100",
  inbound: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  outbound: "bg-amber-50 text-amber-700 ring-amber-100",
  admin: "bg-indigo-50 text-indigo-700 ring-indigo-100",
};

const BADGE_VARIANT_STYLES: Record<SummaryCardVariant, string> = {
  default: "bg-blue-50 text-blue-700",
  inbound: "bg-emerald-50 text-emerald-700",
  outbound: "bg-amber-50 text-amber-700",
  admin: "bg-indigo-50 text-indigo-700",
};

export function SummaryCard({
  title,
  value,
  subtitle,
  badgeText,
  icon,
  variant = "default",
  isLoading = false,
}: SummaryCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
        aria-busy="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {title}
            </p>
            {badgeText && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_VARIANT_STYLES[variant]}`}
              >
                {badgeText}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 line-clamp-2">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${ICON_VARIANT_STYLES[variant]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </article>
  );
}
