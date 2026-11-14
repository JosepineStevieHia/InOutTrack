import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
} from "./Icons";

export type AlertVariant = "success" | "error" | "warning" | "info";

export type AlertProps = {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
};

const ALERT_STYLES: Record<
  AlertVariant,
  { container: string; iconColor: string; titleColor: string }
> = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-900",
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-800",
    iconColor: "text-red-600",
    titleColor: "text-red-900",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-800",
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-800",
    iconColor: "text-blue-600",
    titleColor: "text-blue-900",
  },
};

const ALERT_ICONS: Record<AlertVariant, typeof InfoIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

export function Alert({
  variant = "info",
  title,
  children,
  className = "",
}: AlertProps) {
  const style = ALERT_STYLES[variant];
  const Icon = ALERT_ICONS[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${style.container} ${className}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && (
          <p className={`font-semibold ${style.titleColor}`}>{title}</p>
        )}
        <div className="text-xs leading-relaxed sm:text-sm">{children}</div>
      </div>
    </div>
  );
}
