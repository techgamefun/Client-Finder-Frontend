"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Info,
  Mail,
  Minus,
  RefreshCw,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAdminOverview,
  getApplicationSettings,
  getAuthSession,
  getOverview,
  getTavilyUsage,
  type Company,
  type OverviewKpi,
  type OverviewRange,
  type OverviewResponse,
  type OverviewUserProgress,
} from "@/lib/api";
import { metrics, type OverviewMetricKey } from "@/lib/overview-metrics";

const rangeOptions: { value: OverviewRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const attentionPriority: Record<string, number> = {
  failed_jobs: 0,
  failed_campaign_sends: 1,
  paused_campaigns: 2,
  crawled_websites_not_added: 3,
  gmail_not_assigned: 4,
  leads_without_contact_details: 5,
  tavily_credits_low: 6,
};

const statusColors = [
  "var(--overview-accent)",
  "var(--overview-green)",
  "var(--overview-amber)",
  "var(--overview-blue)",
  "var(--overview-red)",
  "var(--overview-slate)",
];

type OverviewDashboardData = OverviewResponse & {
  user_progress?: OverviewUserProgress[];
};
type OverviewQuery = UseQueryResult<OverviewDashboardData, Error>;

type TeamActivityMetric =
  | "searches_run"
  | "websites_discovered"
  | "companies_created"
  | "leads_created"
  | "crawls_completed"
  | "emails_sent";

const teamActivityMetrics: {
  value: TeamActivityMetric;
  label: string;
}[] = [
  { value: "leads_created", label: "Leads created" },
  { value: "websites_discovered", label: "Websites discovered" },
  { value: "searches_run", label: "Searches run" },
  { value: "companies_created", label: "Companies created" },
  { value: "crawls_completed", label: "Crawls completed" },
  { value: "emails_sent", label: "Emails sent" },
];

export function OverviewPage({
  adminDashboard = false,
  children,
}: {
  adminDashboard?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRange = searchParams.get("range");
  const range = isOverviewRange(requestedRange) ? requestedRange : "30d";
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    enabled: adminDashboard,
    retry: false,
  });
  const overviewQuery = useQuery({
    queryKey: [
      "overview",
      adminDashboard ? "organization" : "user",
      range,
      timezone,
    ],
    queryFn: async (): Promise<OverviewDashboardData> =>
      adminDashboard
        ? getAdminOverview(range, timezone)
        : getOverview(range, timezone),
    enabled: !adminDashboard || sessionQuery.data?.user.role === "admin",
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    enabled: !adminDashboard,
    staleTime: 60_000,
    retry: false,
  });
  const tavilyUsageQuery = useQuery({
    queryKey: ["tavily-usage"],
    queryFn: getTavilyUsage,
    enabled:
      !adminDashboard && settingsQuery.data?.tavily_configured === true,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (
      adminDashboard &&
      sessionQuery.data &&
      sessionQuery.data.user.role !== "admin"
    ) {
      router.replace("/");
    }
  }, [adminDashboard, router, sessionQuery.data]);

  useEffect(() => {
    if (!requestedRange) {
      router.replace(`${adminDashboard ? "/organization/dashboard" : ""}?range=30d`, {
        scroll: false,
      });
    } else if (!isOverviewRange(requestedRange)) {
      router.replace(`${adminDashboard ? "/organization/dashboard" : ""}?range=30d`, {
        scroll: false,
      });
    }
  }, [adminDashboard, requestedRange, router]);

  const attention = useMemo(() => {
    const items = [...(overviewQuery.data?.attention ?? [])];
    const usage = tavilyUsageQuery.data?.key;
    if (
      usage?.limit !== null &&
      usage?.limit !== undefined &&
      usage.limit > 0 &&
      usage.usage / usage.limit >= 0.8
    ) {
      items.push({
        id: "tavily_credits_low",
        count: usage.usage,
        message: `Tavily has used ${formatCount(usage.usage)} of ${formatCount(usage.limit)} credits.`,
        href: "/settings",
        metric_key: "tavily_credits",
      });
    }
    return items
      .sort(
        (left, right) =>
          (attentionPriority[left.id] ?? Number.MAX_SAFE_INTEGER) -
          (attentionPriority[right.id] ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 4);
  }, [overviewQuery.data?.attention, tavilyUsageQuery.data]);

  function changeRange(nextRange: OverviewRange) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("range", nextRange);
    router.push(
      `${adminDashboard ? "/organization/dashboard" : "/"}?${query.toString()}`,
      {
        scroll: false,
      },
    );
  }

  const heading = (
    <div>
      {adminDashboard && (
        <p className="overview-dashboard-eyebrow">ORGANIZATION OVERVIEW</p>
      )}
      <h1>{adminDashboard ? "Organization dashboard" : "Overview"}</h1>
      <p>
        {adminDashboard
          ? "Organization-wide performance and team progress"
          : "Your pipeline performance and next steps"}
        <span className="overview-updated">
          {overviewQuery.dataUpdatedAt > 0 ? (
            <>
              Last updated{" "}
              <time
                dateTime={new Date(
                  overviewQuery.dataUpdatedAt,
                ).toISOString()}
                title={formatAbsoluteDate(
                  new Date(overviewQuery.dataUpdatedAt).toISOString(),
                )}
              >
                {formatClockTime(overviewQuery.dataUpdatedAt)}
              </time>
            </>
          ) : (
            "Last updated —"
          )}
        </span>
      </p>
    </div>
  );
  const headerActions = (
    <div className="overview-header-actions">
      <label className="overview-range-control">
        <select
          aria-label="Overview time range"
          onChange={(event) =>
            changeRange(event.target.value as OverviewRange)
          }
          value={range}
        >
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {adminDashboard && overviewQuery.data?.onboarding && (
        <OnboardingChecklist
          compact
          onboarding={overviewQuery.data.onboarding}
        />
      )}
      {!adminDashboard && (
        <Link className="button button-primary" href="/companies?add=1">
          Add a company
        </Link>
      )}
    </div>
  );

  if (adminDashboard && sessionQuery.isLoading) {
    return <div aria-busy="true" className="overview-page-loading" />;
  }
  if (adminDashboard && sessionQuery.isError) {
    return (
      <main className="overview-redesign">
        <WidgetError
          error={sessionQuery.error}
          onRetry={() => void sessionQuery.refetch()}
          title="your organization role"
        />
      </main>
    );
  }
  if (
    adminDashboard &&
    sessionQuery.data &&
    sessionQuery.data.user.role !== "admin"
  ) {
    return null;
  }

  return (
    <div
      className={`overview-redesign${adminDashboard ? " is-admin-dashboard" : ""}`}
    >
      <header className="overview-header">
        {heading}
        {headerActions}
      </header>

      {children}

      {!(adminDashboard && overviewQuery.data?.onboarding) && (
        <section aria-label="Attention and onboarding">
          {overviewQuery.isLoading ? (
            <section aria-busy="true" className="overview-attention-skeleton">
              <span className="overview-skeleton overview-skeleton-line" />
            </section>
          ) : overviewQuery.isError ? (
            <WidgetError
              error={overviewQuery.error}
              onRetry={() => void overviewQuery.refetch()}
              title="Attention"
            />
          ) : overviewQuery.data?.onboarding ? (
            <OnboardingChecklist onboarding={overviewQuery.data.onboarding} />
          ) : attention.length === 0 ? (
            <p className="overview-all-clear">
              <CheckCircle2 aria-hidden="true" size={18} />
              All clear. Nothing needs attention right now.
            </p>
          ) : (
            <section
              aria-labelledby="overview-attention-title"
              className="overview-attention"
            >
              <div className="overview-section-heading">
                <h2 id="overview-attention-title">Needs attention</h2>
              </div>
              <ul className="overview-attention-list">
                {attention.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>
                      <span className="overview-attention-count">
                        {formatCount(item.count)}
                      </span>
                      <span className="overview-attention-copy">
                        {item.message}
                      </span>
                      <OverviewMetricInfo metricKey={item.metric_key} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}

      <section aria-label="Pipeline performance" className="overview-kpi-grid">
        <MetricCard
          icon={Activity}
          label="Websites discovered"
          metric={overviewQuery.data?.kpis.websites_discovered}
          metricKey="websites_discovered"
          query={overviewQuery}
        />
        <MetricCard
          icon={Users}
          label="Leads created"
          metric={overviewQuery.data?.kpis.leads_created}
          metricKey="leads_created"
          query={overviewQuery}
        />
        <MetricCard
          icon={Mail}
          label="Reachable leads"
          metric={overviewQuery.data?.kpis.reachable_leads}
          metricKey="reachable_leads"
          query={overviewQuery}
        />
        <MetricCard
          icon={Check}
          label="Emails sent"
          metric={overviewQuery.data?.kpis.emails_sent}
          metricKey="emails_sent"
          query={overviewQuery}
        />
      </section>

      <section aria-label="Funnel and trend" className="overview-main-grid">
        <FunnelWidget query={overviewQuery} />
        <TrendWidget query={overviewQuery} timezone={timezone} />
      </section>

      <section aria-label="Pipeline insights" className="overview-insight-grid">
        <PipelineWidget query={overviewQuery} />
        <CoverageWidget query={overviewQuery} />
        <JobsWidget query={overviewQuery} />
      </section>

      {adminDashboard && (
        <TeamActivityWidget query={overviewQuery} range={range} />
      )}

      <RecentLeadsWidget query={overviewQuery} />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  metric,
  metricKey,
  query,
}: {
  icon: LucideIcon;
  label: string;
  metric: OverviewKpi | undefined;
  metricKey: OverviewMetricKey;
  query: OverviewQuery;
}) {
  if (query.isError) {
    return (
      <article className="overview-kpi-card">
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title={label}
        />
      </article>
    );
  }
  if (query.isLoading || !metric) {
    return <KpiSkeleton />;
  }
  return (
    <article className="overview-kpi-card">
      <div className="overview-kpi-heading">
        <span className="overview-kpi-icon">
          <Icon aria-hidden="true" size={18} />
        </span>
        <span>{label}</span>
        <OverviewMetricInfo metricKey={metricKey} />
      </div>
      <strong className="overview-kpi-value">
        {formatCount(metric.current)}
      </strong>
      <DeltaSummary
        metric={metric}
        previousRange={query.data?.previous_range}
      />
      {metricKey === "reachable_leads" && (
        <p className="overview-kpi-denominator">
          {metric.denominator
            ? `${formatCount(metric.current)} of ${formatCount(metric.denominator)} companies · ${formatPercentage(metric.percentage)}`
            : "No companies created in this period"}
        </p>
      )}
      <Sparkline values={metric.sparkline} label={label} />
    </article>
  );
}

function DeltaSummary({
  metric,
  previousRange,
}: {
  metric: OverviewKpi;
  previousRange?: OverviewResponse["previous_range"];
}) {
  const change = metric.absolute_change;
  const direction =
    change > 0 ? (
      <ArrowUpRight aria-hidden="true" size={16} />
    ) : change < 0 ? (
      <ArrowDownRight aria-hidden="true" size={16} />
    ) : (
      <Minus aria-hidden="true" size={16} />
    );
  const signedChange =
    change > 0
      ? `+${formatCount(change)}`
      : change < 0
        ? `−${formatCount(Math.abs(change))}`
        : "0";
  const delta =
    metric.previous === 0
      ? metric.current > 0
        ? `New · ${signedChange}`
        : "No previous activity"
      : `${signedChange} (${formatPercentage(Math.abs(metric.delta_percent ?? 0))}) vs previous`;
  return (
    <p
      className={`overview-delta ${change > 0 ? "is-up" : change < 0 ? "is-down" : ""}`}
      title={
        previousRange
          ? `Previous equal-length period: ${formatAbsoluteDate(previousRange.start)} to ${formatAbsoluteDate(previousRange.end)}`
          : undefined
      }
    >
      {direction}
      <span>{delta}</span>
    </p>
  );
}

function Sparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const width = 128;
  const height = 32;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const spread = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - 4 - ((value - min) / spread) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      aria-label={`${label}, daily values over the last 30 days`}
      className="overview-sparkline"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={points} />
    </svg>
  );
}

function FunnelWidget({ query }: { query: OverviewQuery }) {
  const data = query.data;
  return (
    <article className="overview-panel overview-funnel-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">LEAD JOURNEY</p>
          <h2>Conversion funnel</h2>
        </div>
        <OverviewMetricInfo metricKey="funnel_discovered" />
      </div>
      {query.isLoading ? (
        <PanelSkeleton rows={5} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Conversion funnel"
        />
      ) : data?.funnel.stages[0]?.count === 0 ? (
        <EmptyWidget
          actionHref="/discovery"
          actionLabel="Discover websites"
          message="No websites were discovered in this period."
        />
      ) : (
        <>
          <ol className="overview-funnel-list">
            {data?.funnel.stages.map((stage, index) => (
              <li key={stage.key}>
                <Link
                  aria-label={`${stage.label}: ${formatCount(stage.count)}. Open the related list.`}
                  className="overview-funnel-row"
                  href={funnelHref(stage.key)}
                >
                  <span className="overview-funnel-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="overview-funnel-label">
                    {stage.label}
                    <OverviewMetricInfo metricKey={`funnel_${stage.key}`} />
                  </span>
                  <strong>{formatCount(stage.count)}</strong>
                  <span className="overview-funnel-rate">
                    {index === 0
                      ? "Starting set"
                      : `${formatPercentage(stage.conversion_percent)} from prior`}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {data?.funnel.biggest_drop && (
            <p className="overview-funnel-insight">
              <Info aria-hidden="true" size={16} />
              {data.funnel.biggest_drop}
              <OverviewMetricInfo metricKey="funnel_discovered" />
            </p>
          )}
        </>
      )}
    </article>
  );
}

function TrendWidget({
  query,
  timezone,
}: {
  query: OverviewQuery;
  timezone: string;
}) {
  const data = query.data;
  const hasActivity = Boolean(
    data?.series.some(
      (point) => point.websites_discovered > 0 || point.leads_created > 0,
    ),
  );
  return (
    <article className="overview-panel overview-trend-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">DAILY ACTIVITY</p>
          <h2>Websites and leads</h2>
        </div>
        <OverviewMetricInfo metricKey="trend_websites" />
      </div>
      {query.isLoading ? (
        <PanelSkeleton rows={4} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Daily activity"
        />
      ) : !hasActivity ? (
        <EmptyWidget
          actionHref="/discovery"
          actionLabel="Start a search"
          message="No website discoveries or leads were created in this period."
        />
      ) : (
        <TrendChart series={data?.series ?? []} timezone={timezone} />
      )}
      <div className="overview-chart-legend">
        <span>
          <i className="overview-legend-dot is-websites" />
          <OverviewMetricInfo metricKey="trend_websites" />
          Websites discovered
        </span>
        <span>
          <i className="overview-legend-dot is-leads" />
          <OverviewMetricInfo metricKey="trend_leads" />
          Leads created
        </span>
      </div>
    </article>
  );
}

function TrendChart({
  series,
  timezone,
}: {
  series: OverviewResponse["series"];
  timezone: string;
}) {
  const width = 640;
  const height = 220;
  const left = 36;
  const right = 12;
  const top = 14;
  const bottom = 36;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const values = series.flatMap((point) => [
    point.websites_discovered,
    point.leads_created,
  ]);
  const maxValue = Math.max(1, ...values);
  const pointFor = (value: number, index: number) => {
    const x =
      left +
      (series.length <= 1 ? 0 : (index / (series.length - 1)) * chartWidth);
    const y = top + chartHeight - (value / maxValue) * chartHeight;
    return { x, y };
  };
  const pathFor = (key: "websites_discovered" | "leads_created") =>
    series
      .map((point, index) => {
        const { x, y } = pointFor(point[key], index);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  const tickIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  return (
    <>
      <svg
        aria-label={`Daily chart of websites discovered and leads created across ${series.length} local dates.`}
        className="overview-trend-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = top + chartHeight * fraction;
          return (
            <g key={fraction}>
              <line className="overview-chart-gridline" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="overview-chart-axis-label" x={left - 8} y={y + 4} textAnchor="end">
                {formatCount(Math.round(maxValue * (1 - fraction)))}
              </text>
            </g>
          );
        })}
        <path className="overview-chart-line is-websites" d={pathFor("websites_discovered")} />
        <path className="overview-chart-line is-leads" d={pathFor("leads_created")} />
        {series.map((point, index) => {
          const websitePoint = pointFor(point.websites_discovered, index);
          const leadPoint = pointFor(point.leads_created, index);
          const dateLabel = formatShortDate(point.date, timezone);
          return (
            <g key={point.date}>
              <circle
                className="overview-chart-point is-websites"
                cx={websitePoint.x}
                cy={websitePoint.y}
                r="3"
              >
                <title>{`${dateLabel}: ${formatCount(point.websites_discovered)} websites discovered`}</title>
              </circle>
              <circle
                className="overview-chart-point is-leads"
                cx={leadPoint.x}
                cy={leadPoint.y}
                r="3"
              >
                <title>{`${dateLabel}: ${formatCount(point.leads_created)} leads created`}</title>
              </circle>
            </g>
          );
        })}
        {tickIndexes.map((index) => {
          const point = series[index];
          if (!point) return null;
          const x =
            left +
            (series.length <= 1
              ? 0
              : (index / (series.length - 1)) * chartWidth);
          return (
            <text
              className="overview-chart-axis-label"
              key={point.date}
              textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
              x={x}
              y={height - 8}
            >
              {formatShortDate(point.date, timezone)}
            </text>
          );
        })}
      </svg>
      <div className="overview-visually-hidden">
        <table>
          <caption>Daily website and lead creation counts</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Websites discovered</th>
              <th>Leads created</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.date}>
                <td>{formatShortDate(point.date, timezone)}</td>
                <td>{point.websites_discovered}</td>
                <td>{point.leads_created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PipelineWidget({ query }: { query: OverviewQuery }) {
  const data = query.data;
  const statusBreakdown = data?.status_breakdown ?? [];
  const total = statusBreakdown.reduce((sum, item) => sum + item.count, 0);
  const circumference = 2 * Math.PI * 42;
  const statusSegments = statusBreakdown.map((item, index) => {
    const length = total > 0 ? (item.count / total) * circumference : 0;
    const precedingCount = statusBreakdown
      .slice(0, index)
      .reduce((sum, preceding) => sum + preceding.count, 0);
    return {
      ...item,
      color: statusColors[index % statusColors.length],
      dashLength: Math.max(0, length - 2),
      dashOffset:
        total > 0 ? (precedingCount / total) * circumference : 0,
    };
  });
  return (
    <article className="overview-panel overview-insight-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">CURRENT PIPELINE</p>
          <h2>Lead status mix</h2>
        </div>
        <OverviewMetricInfo metricKey="pipeline_status" />
      </div>
      {query.isLoading ? (
        <PanelSkeleton rows={3} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Lead status mix"
        />
      ) : total === 0 ? (
        <EmptyWidget
          actionHref="/companies"
          actionLabel="Add a company"
          message="No companies with contacts are in Leads yet."
        />
      ) : (
        <div className="overview-status-donut-layout">
          <svg
            aria-label={`Current pipeline status mix: ${formatCount(total)} leads across ${statusSegments.length} statuses. This is not limited to the selected date range.`}
            className="overview-status-donut"
            role="img"
            viewBox="0 0 120 120"
          >
            <circle
              className="overview-status-donut-track"
              cx="60"
              cy="60"
              r="42"
            />
            {statusSegments.map((segment) => (
              <circle
                cx="60"
                cy="60"
                key={segment.status}
                r="42"
                stroke={segment.color}
                strokeDasharray={`${segment.dashLength} ${circumference}`}
                strokeDashoffset={-segment.dashOffset}
                transform="rotate(-90 60 60)"
              >
                <title>
                  {`${segment.status.replaceAll("_", " ")}: ${formatCount(segment.count)} (${formatPercentage(segment.percentage)})`}
                </title>
              </circle>
            ))}
            <text
              className="overview-status-donut-total"
              textAnchor="middle"
              x="60"
              y="58"
            >
              {formatCount(total)}
            </text>
            <text
              className="overview-status-donut-label"
              textAnchor="middle"
              x="60"
              y="75"
            >
              LEADS
            </text>
          </svg>
          <ul className="overview-status-legend">
            {statusSegments.map((item) => (
              <li key={item.status}>
                <span
                  className="overview-status-swatch"
                  style={{ backgroundColor: item.color }}
                />
                <span className="overview-status-name">
                  {item.status.replaceAll("_", " ")}
                </span>
                <strong>{formatCount(item.count)}</strong>
                <span>{formatPercentage(item.percentage)}</span>
              </li>
            ))}
          </ul>
          <p className="overview-status-donut-note">
            Current pipeline mix; not limited to the selected date range.
          </p>
        </div>
      )}
    </article>
  );
}

function CoverageWidget({ query }: { query: OverviewQuery }) {
  const data = query.data?.coverage;
  const rows: {
    key: OverviewMetricKey;
    label: string;
    metric: OverviewResponse["coverage"]["with_email"] | undefined;
  }[] = [
    { key: "with_email", label: "Email", metric: data?.with_email },
    { key: "with_phone", label: "Phone", metric: data?.with_phone },
    { key: "with_website", label: "Website", metric: data?.with_website },
    { key: "with_industry", label: "Industry", metric: data?.with_industry },
    { key: "crawl_success", label: "Indexing success", metric: data?.crawl_success },
  ];
  return (
    <article className="overview-panel overview-insight-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">DATA QUALITY</p>
          <h2>Coverage</h2>
        </div>
        <OverviewMetricInfo metricKey="with_email" />
      </div>
      <p className="overview-coverage-scope">
        Company coverage is all-time; indexing success uses the selected period.
      </p>
      {query.isLoading ? (
        <PanelSkeleton rows={5} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Data coverage"
        />
      ) : data?.companies_total === 0 ? (
        <EmptyWidget
          actionHref="/companies"
          actionLabel="Add a company"
          message="Coverage appears after companies are added."
        />
      ) : (
        <ul className="overview-coverage-list">
          {rows.map((row) => {
            const percentage = row.metric?.percentage ?? null;
            const accessibleLabel =
              percentage === null
                ? `${row.label}: no completed indexing jobs`
                : `${row.label}: ${formatPercentage(percentage)} coverage`;
            return (
              <li key={row.key}>
                <div className="overview-coverage-heading">
                  <span>{row.label}</span>
                  <strong>{formatPercentage(percentage)}</strong>
                  <OverviewMetricInfo metricKey={row.key} />
                </div>
                <div
                  aria-label={accessibleLabel}
                  className="overview-coverage-track"
                  role="img"
                >
                  <span
                    style={{ width: `${percentage ?? 0}%` }}
                  />
                </div>
                <span className="overview-coverage-denominator">
                  {row.metric?.total
                    ? `${formatCount(row.metric.count)} of ${formatCount(row.metric.total)}`
                    : "No completed indexing jobs"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function JobsWidget({ query }: { query: OverviewQuery }) {
  const data = query.data?.jobs;
  const hasJobs = Boolean(
    data &&
      [
        data.crawler.queued,
        data.crawler.running,
        data.crawler.failed,
        data.pagespeed.queued,
        data.pagespeed.running,
        data.pagespeed.failed,
      ].some((count) => count > 0),
  );
  return (
    <article className="overview-panel overview-insight-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">LAST 24 HOURS</p>
          <h2>Jobs health</h2>
        </div>
        <OverviewMetricInfo metricKey="jobs_queued" />
      </div>
      {query.isLoading ? (
        <PanelSkeleton rows={3} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Jobs health"
        />
      ) : !hasJobs ? (
        <EmptyWidget
          actionHref="/jobs"
          actionLabel="View jobs"
          message="No jobs were created in the last 24 hours."
        />
      ) : (
        <>
          <div className="overview-jobs-table" role="table" aria-label="Jobs by queue and status">
            <div className="overview-jobs-row is-heading" role="row">
              <span role="columnheader">Queue</span>
              <span role="columnheader">Queued</span>
              <span role="columnheader">Running</span>
              <span role="columnheader">Failed</span>
            </div>
            {(
              [
                ["Indexing", data?.crawler],
                ["PageSpeed", data?.pagespeed],
              ] as const
            ).map(([name, queue]) => (
              <div className="overview-jobs-row" key={name} role="row">
                <strong role="rowheader">{name}</strong>
                <span role="cell">
                  {formatCount(queue?.queued ?? 0)}
                  <OverviewMetricInfo metricKey="jobs_queued" />
                </span>
                <span role="cell">
                  {formatCount(queue?.running ?? 0)}
                  <OverviewMetricInfo metricKey="jobs_running" />
                </span>
                <span role="cell">
                  {formatCount(queue?.failed ?? 0)}
                  <OverviewMetricInfo metricKey="jobs_failed" />
                </span>
              </div>
            ))}
          </div>
          {(data?.failed_badge_count ?? 0) > 0 && (
            <Link className="overview-job-failures-link" href="/jobs?status=failed">
              Review {formatCount(data?.failed_badge_count ?? 0)} failed jobs
              <OverviewMetricInfo metricKey="failed_jobs_badge" />
            </Link>
          )}
        </>
      )}
    </article>
  );
}

function TeamActivityWidget({
  query,
  range,
}: {
  query: OverviewQuery;
  range: OverviewRange;
}) {
  const [metric, setMetric] =
    useState<TeamActivityMetric>("leads_created");
  const users = query.data?.user_progress ?? [];
  const selectedMetric =
    teamActivityMetrics.find((option) => option.value === metric) ??
    teamActivityMetrics[0];
  const sortedUsers = [...users].sort(
    (left, right) =>
      right[metric] - left[metric] ||
      left.email.localeCompare(right.email),
  );
  const maxValue = Math.max(0, ...sortedUsers.map((user) => user[metric]));

  return (
    <article className="overview-panel overview-team-activity-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">TEAM ACTIVITY · {range}</p>
          <h2>Activity by member</h2>
        </div>
        <label className="overview-team-activity-control">
          <span>Measure</span>
          <select
            aria-label="Team activity measure"
            onChange={(event) =>
              setMetric(event.target.value as TeamActivityMetric)
            }
            value={metric}
          >
            {teamActivityMetrics.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="overview-team-activity-description">
        Counts for the selected period. Inactive members are included.
      </p>
      {query.isLoading ? (
        <PanelSkeleton rows={5} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Team activity"
        />
      ) : users.length === 0 ? (
        <EmptyWidget
          actionHref="/organization/members"
          actionLabel="Manage members"
          message="No organization members are available."
        />
      ) : maxValue === 0 ? (
        <p className="overview-team-activity-empty">
          No {selectedMetric.label.toLocaleLowerCase()} recorded in this period.
        </p>
      ) : (
        <ol
          aria-label={`${selectedMetric.label} by team member`}
          className="overview-team-activity-list"
        >
          {sortedUsers.map((user) => {
            const value = user[metric];
            const width = (value / maxValue) * 100;
            const isInactive = !user.is_active;
            return (
              <li key={user.user_id}>
                <Link
                  className="overview-team-activity-row"
                  href={`/organization/members/${user.user_id}`}
                >
                  <span className="overview-team-activity-member">
                    <span className="overview-team-user">{user.email}</span>
                    <span
                      className={`overview-team-user-status${isInactive ? " is-inactive" : ""}`}
                    >
                      {isInactive ? "Inactive" : "Active"}
                    </span>
                  </span>
                  <span
                    aria-label={`${user.email}: ${formatCount(value)} ${selectedMetric.label.toLocaleLowerCase()}`}
                    className="overview-team-activity-track"
                    role="img"
                  >
                    <span
                      className={isInactive ? "is-inactive" : ""}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <strong>{formatCount(value)}</strong>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

function RecentLeadsWidget({
  query,
}: {
  query: OverviewQuery;
}) {
  const leads = query.data?.recent_leads ?? [];
  return (
    <section
      aria-labelledby="overview-latest-leads-title"
      className="overview-panel overview-recent-panel"
    >
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">RECENTLY ADDED</p>
          <h2 id="overview-latest-leads-title">Latest leads</h2>
        </div>
        <div className="overview-recent-actions">
          <OverviewMetricInfo metricKey="recent_leads" />
          <Link className="overview-text-link" href="/leads">
            View pipeline <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      {query.isLoading ? (
        <div aria-busy="true" className="overview-table-skeleton">
          <PanelSkeleton rows={5} />
        </div>
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Latest leads"
        />
      ) : leads.length === 0 ? (
        <EmptyWidget
          actionHref="/companies"
          actionLabel="Add a company"
          message="Companies appear here after they have at least one contact."
        />
      ) : (
        <div className="overview-table-scroll">
          <table className="overview-leads-table">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">
                  Contacts <OverviewMetricInfo metricKey="recent_leads" />
                </th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Added</th>
                <th scope="col">Last emailed</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const companyHref = `/company/${lead.id}`;
                const domainDiffers =
                  lead.domain !== null &&
                  lead.domain.toLocaleLowerCase() !==
                    lead.name.toLocaleLowerCase();
                return (
                  <tr
                    className="overview-lead-row"
                    key={lead.id}
                  >
                    <td>
                      <Link
                        aria-label={`Open ${lead.name}`}
                        className="overview-company-link"
                        href={companyHref}
                      >
                        <strong>{lead.name}</strong>
                        {domainDiffers && <span>{lead.domain}</span>}
                      </Link>
                    </td>
                    <td>
                      <Link
                        aria-label={`${formatCount(lead.contact_count)} contacts for ${lead.name}`}
                        className="overview-cell-link"
                        href={companyHref}
                      >
                        {formatCount(lead.contact_count)}
                      </Link>
                    </td>
                    <td>
                      <Link
                        aria-label={`Source for ${lead.name}: ${lead.source_keyword ?? "No search keyword recorded"}`}
                        className="overview-cell-link"
                        href={companyHref}
                      >
                        {lead.source_keyword ?? "No keyword recorded"}
                      </Link>
                    </td>
                    <td>
                      <Link
                        aria-label={`${lead.name}, status ${lead.lead_status.replaceAll("_", " ")}`}
                        className="overview-cell-link"
                        href={companyHref}
                      >
                        <span className="overview-status-pill">
                          {lead.lead_status.replaceAll("_", " ")}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link
                        aria-label={`Added ${formatAbsoluteDate(lead.created_at)}`}
                        className="overview-cell-link"
                        href={companyHref}
                        title={formatAbsoluteDate(lead.created_at)}
                      >
                        {formatRelativeTime(lead.created_at)}
                      </Link>
                    </td>
                    <td>
                      <Link
                        aria-label={
                          lead.last_email_sent_at
                            ? `Last emailed ${formatAbsoluteDate(lead.last_email_sent_at)}`
                            : "No campaign email sent"
                        }
                        className="overview-cell-link"
                        href={companyHref}
                        title={
                          lead.last_email_sent_at
                            ? formatAbsoluteDate(lead.last_email_sent_at)
                            : undefined
                        }
                      >
                        {lead.last_email_sent_at
                          ? formatRelativeTime(lead.last_email_sent_at)
                          : "Never"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OnboardingChecklist({
  compact = false,
  onboarding,
}: {
  compact?: boolean;
  onboarding: NonNullable<OverviewResponse["onboarding"]>;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [isDialogOpen]);

  if (onboarding.steps.every((step) => step.completed)) return null;
  const remainingSteps = onboarding.steps.filter(
    (step) => !step.completed,
  ).length;
  return (
    <section
      aria-label="Get started checklist"
      className={`overview-onboarding${compact ? " is-compact" : ""}`}
    >
      <button
        aria-controls="overview-onboarding-dialog"
        aria-haspopup="dialog"
        className={`overview-onboarding-trigger${compact ? " is-compact" : ""}`}
        onClick={() => setIsDialogOpen(true)}
        type="button"
      >
        <span className="overview-onboarding-label">
          <span className="overview-onboarding-count-badge">
            {remainingSteps}
          </span>
          <span className="overview-onboarding-remaining">
            {remainingSteps === 1 ? "step" : "steps"} remaining
          </span>
        </span>
      </button>
      <dialog
        aria-labelledby="overview-onboarding-title"
        className="overview-onboarding-dialog"
        id="overview-onboarding-dialog"
        onCancel={(event) => {
          event.preventDefault();
          setIsDialogOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsDialogOpen(false);
          }
        }}
        ref={dialogRef}
      >
        <header className="overview-onboarding-dialog-header">
          <div>
            <p className="overview-eyebrow">GET STARTED</p>
            <h2 id="overview-onboarding-title">Set up your lead workspace</h2>
            <p>Complete these steps to build your first working pipeline.</p>
          </div>
          <button
            aria-label="Close setup checklist"
            className="icon-button"
            onClick={() => setIsDialogOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <ol className="overview-onboarding-list">
          {onboarding.steps.map((step) => (
            <li key={step.id}>
              <Link href={step.href}>
                {step.completed ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="is-complete"
                    size={20}
                  />
                ) : (
                  <Circle aria-hidden="true" size={20} />
                )}
                <span>{step.label}</span>
                <span className="overview-onboarding-state">
                  {step.completed ? "Complete" : "Start"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </dialog>
    </section>
  );
}

function EmptyWidget({
  actionHref,
  actionLabel,
  message,
}: {
  actionHref: string;
  actionLabel: string;
  message: string;
}) {
  return (
    <div className="overview-empty-state">
      <p>{message}</p>
      <Link href={actionHref}>
        {actionLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function WidgetError({
  error,
  onRetry,
  title,
}: {
  error: Error;
  onRetry: () => void;
  title: string;
}) {
  return (
    <div className="overview-widget-error" role="alert">
      <p>
        Could not load {title.toLocaleLowerCase()}: {error.message}
      </p>
      <button className="button button-secondary" onClick={onRetry} type="button">
        <RefreshCw aria-hidden="true" size={15} />
        Retry
      </button>
    </div>
  );
}

function OverviewMetricInfo({ metricKey }: { metricKey: string }) {
  if (!isOverviewMetricKey(metricKey)) return null;
  const metric = metrics[metricKey];
  const details = `${metric.definition} Source: ${metric.source}. Time field: ${metric.timeField}. Scope: ${metric.orgScope}.`;
  return (
    <span
      aria-label={`${metric.label}. ${details}`}
      className="overview-metric-info"
      data-tooltip={`${metric.definition}\nSource: ${metric.source}\nTime: ${metric.timeField}\nScope: ${metric.orgScope}`}
      role="note"
      tabIndex={0}
    >
      <Info aria-hidden="true" size={15} />
    </span>
  );
}

function KpiSkeleton() {
  return (
    <article aria-busy="true" className="overview-kpi-card">
      <span className="overview-skeleton overview-skeleton-line" />
      <span className="overview-skeleton overview-skeleton-value" />
      <span className="overview-skeleton overview-skeleton-line is-short" />
      <span className="overview-skeleton overview-skeleton-chart" />
    </article>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" className="overview-panel-skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <span
          className={`overview-skeleton overview-skeleton-line ${index % 2 === 0 ? "is-short" : ""}`}
          key={index}
        />
      ))}
    </div>
  );
}

export function CompanyName({ company }: { company: Company }) {
  return (
    <div className="company-cell">
      <span className="company-avatar">
        {company.name.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{company.name}</strong>
        <small>{company.domain ?? "No domain provided"}</small>
      </span>
    </div>
  );
}

function isOverviewRange(value: string | null): value is OverviewRange {
  return value === "7d" || value === "30d" || value === "90d";
}

function isOverviewMetricKey(value: string): value is OverviewMetricKey {
  return Object.prototype.hasOwnProperty.call(metrics, value);
}

function funnelHref(key: string) {
  switch (key) {
    case "discovered":
    case "crawled":
      return "/websites";
    case "emailed":
      return "/leads?email_status=contacted";
    default:
      return "/leads";
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: value > 9_999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function formatAbsoluteDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const differenceSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const absoluteSeconds = Math.abs(differenceSeconds);
  if (absoluteSeconds < 60) return "just now";
  if (absoluteSeconds < 3600) {
    return formatter.format(Math.round(differenceSeconds / 60), "minute");
  }
  if (absoluteSeconds < 86_400) {
    return formatter.format(Math.round(differenceSeconds / 3600), "hour");
  }
  return formatter.format(Math.round(differenceSeconds / 86_400), "day");
}

function formatClockTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function formatShortDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(`${value}T12:00:00`));
}
