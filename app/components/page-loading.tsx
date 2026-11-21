export type PageLoadingVariant =
  | "activity"
  | "dashboard"
  | "detail"
  | "generic"
  | "organization"
  | "settings"
  | "table";

export function TableLoading({
  label,
  rows = 5,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="table-loading"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="table-loading-head">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="page-loading-block is-copy" key={index} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div aria-hidden="true" className="table-loading-row" key={index}>
          <span className="page-loading-block is-avatar" />
          <span className="page-loading-block is-copy" />
          <span className="page-loading-block is-copy is-short" />
          <span className="page-loading-block is-pill" />
        </div>
      ))}
    </div>
  );
}

export function PageLoading({
  label,
  variant = "generic",
}: {
  label: string;
  variant?: PageLoadingVariant;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className={`page-loading is-${variant}`}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="page-loading-content">
        <div className="page-loading-heading">
          <div className="page-loading-heading-copy">
            <span className="page-loading-block is-eyebrow" />
            <span className="page-loading-block is-title" />
            <span className="page-loading-block is-copy" />
          </div>
          <span className="page-loading-block is-action" />
        </div>
        {variant === "dashboard" && (
          <>
            <div className="page-loading-kpis">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="page-loading-card" key={index}>
                  <span className="page-loading-block is-copy" />
                  <span className="page-loading-block is-value" />
                  <span className="page-loading-block is-short" />
                </div>
              ))}
            </div>
            <div className="page-loading-panels">
              {Array.from({ length: 2 }, (_, index) => (
                <div className="page-loading-card is-chart" key={index}>
                  <span className="page-loading-block is-copy" />
                  <span className="page-loading-block is-chart-area" />
                </div>
              ))}
            </div>
          </>
        )}
        {variant === "organization" && (
          <>
            <span className="page-loading-block is-hero" />
            <span className="page-loading-block is-member-card" />
          </>
        )}
        {variant === "settings" && (
          <div className="page-loading-settings">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="page-loading-card" key={index}>
                <span className="page-loading-block is-copy" />
                <span className="page-loading-block is-setting" />
                <span className="page-loading-block is-setting is-short" />
              </div>
            ))}
          </div>
        )}
        {variant === "activity" && (
          <>
            <div className="page-loading-kpis">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="page-loading-card" key={index}>
                  <span className="page-loading-block is-copy" />
                  <span className="page-loading-block is-value" />
                </div>
              ))}
            </div>
            <div className="page-loading-card is-chart">
              <span className="page-loading-block is-copy" />
              <span className="page-loading-block is-chart-area" />
            </div>
          </>
        )}
        {variant === "table" && (
          <div className="page-loading-card is-table">
            <div className="page-loading-table-header">
              {Array.from({ length: 4 }, (_, index) => (
                <span className="page-loading-block is-copy" key={index} />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, index) => (
              <div className="page-loading-table-row" key={index}>
                <span className="page-loading-block is-avatar" />
                <span className="page-loading-block is-copy" />
                <span className="page-loading-block is-copy is-short" />
                <span className="page-loading-block is-pill" />
              </div>
            ))}
          </div>
        )}
        {variant === "detail" && (
          <>
            <span className="page-loading-block is-hero" />
            <div className="page-loading-panels">
              {Array.from({ length: 2 }, (_, index) => (
                <div className="page-loading-card" key={index}>
                  <span className="page-loading-block is-copy" />
                  <span className="page-loading-block is-setting" />
                  <span className="page-loading-block is-setting is-short" />
                </div>
              ))}
            </div>
          </>
        )}
        {variant === "generic" && (
          <div className="page-loading-card">
            <span className="page-loading-block is-setting" />
            <span className="page-loading-block is-setting" />
            <span className="page-loading-block is-setting is-short" />
          </div>
        )}
      </div>
    </section>
  );
}
