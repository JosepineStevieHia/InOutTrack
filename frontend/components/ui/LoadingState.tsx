export function Spinner({
  size = "md",
  className = "",
  label = "Memuat...",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <span className="inline-flex items-center gap-2" role="status">
      <svg
        className={`animate-spin text-blue-600 ${sizeClass} ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoading({
  message = "Memuat data aplikasi...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <Spinner size="lg" label={message} />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
          aria-hidden="true"
        >
          <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, idx) => (
            <div
              key={idx}
              className="h-3.5 animate-pulse rounded bg-slate-200"
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="grid gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, cIdx) => (
              <div
                key={cIdx}
                className="h-4 animate-pulse rounded bg-slate-100"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
