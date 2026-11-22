export type PageLoadingVariant =
  | "activity"
  | "dashboard"
  | "detail"
  | "generic"
  | "organization"
  | "organization-settings"
  | "settings"
  | "overview"
  | "members"
  | "websites"
  | "leads"
  | "companies"
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
  if (variant === "dashboard") return <DashboardLoading label={label} />;
  if (variant === "overview") {
    return <DashboardLoading adminDashboard={false} label={label} />;
  }
  if (variant === "organization") return <OrganizationLoading label={label} />;
  if (variant === "settings") return <SettingsLoading label={label} />;
  if (variant === "organization-settings") {
    return <OrganizationSettingsLoading label={label} />;
  }
  if (variant === "members") return <MembersLoading label={label} />;
  if (variant === "websites") return <WebsitesLoading label={label} />;
  if (variant === "leads") {
    return <PipelineLoading isCompanies={false} label={label} />;
  }
  if (variant === "companies") {
    return <PipelineLoading isCompanies label={label} />;
  }

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

function DashboardLoading({
  label,
  adminDashboard = true,
}: {
  label: string;
  adminDashboard?: boolean;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className={`overview-redesign page-loading-dashboard${adminDashboard ? " is-admin-dashboard" : " is-personal-overview"}`}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <header
        className={`overview-header ${adminDashboard ? "page-loading-dashboard-banner" : "page-loading-overview-header"}`}
      >
        <div className="page-loading-dashboard-intro">
          <span className="overview-skeleton is-eyebrow" />
          <span className="overview-skeleton is-title" />
          <span className="overview-skeleton is-description" />
        </div>
        <div aria-hidden="true" className="page-loading-dashboard-controls">
          {adminDashboard ? (
            <span className="overview-skeleton is-onboarding-control" />
          ) : (
            <span className="overview-skeleton is-add-company-control" />
          )}
          <span className="overview-skeleton is-range-control" />
        </div>
      </header>

      <section aria-hidden="true" className="overview-kpi-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="overview-kpi-card" key={index}>
            <div className="overview-kpi-heading">
              <span className="overview-skeleton is-kpi-icon" />
              <span className="overview-skeleton overview-skeleton-line is-kpi-label" />
            </div>
            <span className="overview-skeleton overview-skeleton-value" />
            <span className="overview-skeleton overview-skeleton-line is-short" />
            <span className="overview-skeleton overview-skeleton-chart" />
          </article>
        ))}
      </section>

      <section aria-hidden="true" className="overview-main-grid">
        <article className="overview-panel page-loading-dashboard-panel">
          <DashboardPanelHeading />
          <div className="page-loading-funnel-rows">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="page-loading-funnel-row" key={index}>
                <span className="overview-skeleton is-funnel-index" />
                <span className="overview-skeleton overview-skeleton-line" />
                <span className="overview-skeleton is-funnel-count" />
                <span className="overview-skeleton overview-skeleton-line is-short" />
              </div>
            ))}
          </div>
        </article>
        <article className="overview-panel page-loading-dashboard-panel">
          <DashboardPanelHeading />
          <span className="overview-skeleton is-dashboard-chart" />
          <div className="page-loading-chart-legend">
            <span className="overview-skeleton overview-skeleton-line is-short" />
            <span className="overview-skeleton overview-skeleton-line is-short" />
          </div>
        </article>
      </section>

      <section aria-hidden="true" className="overview-insight-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <article
            className="overview-panel overview-insight-panel page-loading-dashboard-panel"
            key={index}
          >
            <DashboardPanelHeading />
            {index === 1 ? (
              <div className="page-loading-donut-layout">
                <span className="overview-skeleton is-dashboard-donut" />
                <div className="page-loading-insight-lines">
                  <span className="overview-skeleton overview-skeleton-line" />
                  <span className="overview-skeleton overview-skeleton-line is-short" />
                  <span className="overview-skeleton overview-skeleton-line" />
                </div>
              </div>
            ) : (
              <div className="page-loading-insight-lines">
                {Array.from({ length: 4 }, (_, row) => (
                  <span
                    className="overview-skeleton overview-skeleton-line"
                    key={row}
                  />
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      {adminDashboard && (
        <article
          aria-hidden="true"
          className="overview-panel overview-team-activity-panel page-loading-dashboard-panel"
        >
          <DashboardPanelHeading />
          <div className="page-loading-team-rows">
            {Array.from({ length: 1 }, (_, index) => (
              <div className="page-loading-team-row" key={index}>
                <span className="overview-skeleton overview-skeleton-line" />
                <span className="overview-skeleton is-team-bar" />
                <span className="overview-skeleton is-team-value" />
              </div>
            ))}
          </div>
        </article>
      )}

      <article
        aria-hidden="true"
        className="overview-panel overview-recent-panel page-loading-dashboard-panel"
      >
        <DashboardPanelHeading />
        <div className="overview-table-skeleton">
          <div className="page-loading-lead-row is-heading">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="overview-skeleton overview-skeleton-line" key={index} />
            ))}
          </div>
          {Array.from({ length: 1 }, (_, row) => (
            <div className="page-loading-lead-row" key={row}>
              {Array.from({ length: 4 }, (_, column) => (
                <span
                  className={`overview-skeleton overview-skeleton-line${column === 1 ? " is-short" : ""}`}
                  key={column}
                />
              ))}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function DashboardPanelHeading() {
  return (
    <div className="overview-section-heading">
      <div className="page-loading-dashboard-panel-heading">
        <span className="overview-skeleton is-panel-eyebrow" />
        <span className="overview-skeleton is-panel-title" />
      </div>
      <span className="overview-skeleton is-panel-action" />
    </div>
  );
}

function OrganizationLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="organization-page page-loading-organization"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <section aria-hidden="true" className="organization-hero">
        <div className="organization-hero-background">
          <div className="organization-hero-placeholder" />
          <div className="organization-hero-scrim" />
        </div>
        <div className="organization-hero-content">
          <div className="organization-hero-main">
            <span className="organization-hero-logo" />
            <div className="organization-hero-copy">
              <span className="overview-skeleton is-organization-eyebrow" />
              <span className="overview-skeleton is-organization-title" />
              <span className="overview-skeleton is-organization-copy" />
            </div>
          </div>
          <span className="overview-skeleton is-organization-action" />
        </div>
      </section>
      <div aria-hidden="true" className="organization-member-count-card">
        <div className="organization-member-count-copy">
          <span className="overview-skeleton is-organization-copy" />
          <span className="overview-skeleton is-organization-count" />
        </div>
        <span className="overview-skeleton is-organization-action" />
      </div>
    </section>
  );
}

function SettingsLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="page-loading-settings-page"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <header className="page-heading settings-heading">
        <div>
          <span className="overview-skeleton is-settings-title" />
          <span className="overview-skeleton is-settings-copy" />
        </div>
        <div aria-hidden="true" className="settings-section-picker">
          <span className="overview-skeleton is-settings-label" />
          <span className="overview-skeleton is-settings-select" />
        </div>
      </header>
      <section aria-hidden="true" className="panel settings-panel">
        <div className="settings-section-heading">
          <div className="page-loading-settings-section-heading">
            <span className="overview-skeleton is-settings-title" />
            <span className="overview-skeleton is-settings-copy" />
          </div>
        </div>
        <div className="page-loading-settings-fields">
          <span className="overview-skeleton is-settings-label" />
          <span className="overview-skeleton is-settings-input" />
          <span className="overview-skeleton is-settings-label" />
          <span className="overview-skeleton is-settings-input is-short" />
          <span className="overview-skeleton is-settings-button" />
        </div>
      </section>
    </section>
  );
}

function OrganizationSettingsLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="organization-settings-page page-loading-organization-settings"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <header className="organization-settings-heading">
        <span className="overview-skeleton is-settings-label" />
        <span className="overview-skeleton is-settings-title" />
        <span className="overview-skeleton is-settings-copy" />
      </header>
      <section aria-hidden="true" className="panel organization-settings-panel">
        <header className="organization-settings-section-heading">
          <div className="page-loading-settings-section-heading">
            <span className="overview-skeleton is-settings-title" />
            <span className="overview-skeleton is-settings-copy" />
          </div>
        </header>
        <span className="overview-skeleton is-organization-banner" />
        <div className="page-loading-organization-logo-row">
          <span className="overview-skeleton is-organization-logo" />
          <div className="page-loading-settings-fields">
            <span className="overview-skeleton is-settings-label" />
            <span className="overview-skeleton is-settings-input" />
          </div>
        </div>
      </section>
    </section>
  );
}

function MembersLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="page-loading-members"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <header className="organization-members-page-heading">
        <span className="overview-skeleton is-members-title" />
        <span className="overview-skeleton is-members-count" />
      </header>
      <section aria-hidden="true" className="panel organization-member-list-panel">
        <div className="organization-section-heading">
          <span className="overview-skeleton is-members-section-title" />
          <span className="overview-skeleton is-members-action" />
        </div>
        <div className="page-loading-members-filters">
          <span className="overview-skeleton is-members-search" />
          <span className="overview-skeleton is-members-filter" />
          <span className="overview-skeleton is-members-filter" />
        </div>
        <div aria-hidden="true" className="table-loading">
          <div className="table-loading-head">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="page-loading-block is-copy" key={index} />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div className="table-loading-row" key={index}>
              <span className="page-loading-block is-avatar" />
              <span className="page-loading-block is-copy" />
              <span className="page-loading-block is-copy is-short" />
              <span className="page-loading-block is-pill" />
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function WebsitesLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="website-registry-panel page-loading-websites"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="website-registry-toolbar">
        <div className="filter-input page-loading-websites-search">
          <span className="page-loading-block is-search-icon" />
          <span className="page-loading-block is-copy" />
        </div>
        <span className="page-loading-block is-websites-filter-button" />
        <div className="website-registry-actions">
          <span className="page-loading-block is-websites-action" />
          <span className="page-loading-block is-websites-refresh" />
        </div>
      </div>
      <div aria-hidden="true" className="page-loading-websites-table-wrap">
        <div className="page-loading-websites-table">
          <div className="page-loading-websites-table-head">
            {Array.from({ length: 7 }, (_, index) => (
              <span className="page-loading-block is-copy" key={index} />
            ))}
          </div>
          {Array.from({ length: 6 }, (_, row) => (
            <div className="page-loading-websites-table-row" key={row}>
              {Array.from({ length: 7 }, (_, column) => (
                <span
                  className={`page-loading-block${column === 1 ? " is-copy" : " is-table-cell"}`}
                  key={column}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PipelineLoading({
  isCompanies,
  label,
}: {
  isCompanies: boolean;
  label: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="panel pipeline-panel leads-panel page-loading-pipeline"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="leads-filter-section">
        <div className="leads-filter-heading">
          <div className="page-loading-pipeline-heading">
            <span className="page-loading-block is-title" />
            <span className="page-loading-block is-copy" />
          </div>
          {!isCompanies && (
            <span className="page-loading-block is-pipeline-action" />
          )}
        </div>
        <div className="pipeline-tools leads-filter-controls">
          <span className="filter-input page-loading-pipeline-search">
            <span className="page-loading-block is-copy" />
          </span>
          {Array.from({ length: isCompanies ? 2 : 3 }, (_, index) => (
            <span className="page-loading-block is-pipeline-filter" key={index} />
          ))}
          <span className="page-loading-block is-pipeline-refresh" />
        </div>
        {!isCompanies && (
          <div className="lead-campaign-toolbar">
            <div className="page-loading-block is-campaign-copy" />
            <span className="page-loading-block is-campaign-action" />
          </div>
        )}
      </div>
      <div aria-hidden="true" className="page-loading-pipeline-table">
        <TableLoading label={label} rows={6} />
      </div>
    </section>
  );
}
