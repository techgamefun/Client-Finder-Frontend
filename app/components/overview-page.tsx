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
  type LucideIcon,
} from "lucide-react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getApplicationSettings,
  getOverview,
  getTavilyUsage,
  type Company,
  type OverviewKpi,
  type OverviewRange,
  type OverviewResponse,
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

type OverviewQuery = UseQueryResult<OverviewResponse, Error>;

export function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRange = searchParams.get("range");
  const range = isOverviewRange(requestedRange) ? requestedRange : "30d";
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const overviewQuery = useQuery({
    queryKey: ["overview", range, timezone],
    queryFn: () => getOverview(range, timezone),
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    staleTime: 60_000,
    retry: false,
  });
  const tavilyUsageQuery = useQuery({
    queryKey: ["tavily-usage"],
    queryFn: getTavilyUsage,
    enabled: settingsQuery.data?.tavily_configured === true,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!requestedRange) {
      router.replace("/?range=30d", { scroll: false });
    } else if (!isOverviewRange(requestedRange)) {
      router.replace("/?range=30d", { scroll: false });
    }
  }, [requestedRange, router]);

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
    router.push(`/?${query.toString()}`, { scroll: false });
  }

  return (
    <div className="overview-redesign">
      <header className="overview-header">
        <div>
          <h1>Overview</h1>
          <p>
            Pipeline performance and next steps
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
        <div className="overview-header-actions">
          <label className="overview-range-control">
            <span>Time range</span>
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
          <Link className="button button-primary" href="/companies?add=1">
            Add a company
          </Link>
        </div>
      </header>

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
          <OnboardingChecklist
            onboarding={overviewQuery.data.onboarding}
          />
        ) : attention.length === 0 ? (
          <p className="overview-all-clear">
            <CheckCircle2 aria-hidden="true" size={18} />
            All clear. Nothing needs attention right now.
          </p>
        ) : (
          <section aria-labelledby="overview-attention-title" className="overview-attention">
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
  const total = data?.status_breakdown.reduce((sum, item) => sum + item.count, 0) ?? 0;
  return (
    <article className="overview-panel overview-insight-panel">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">PIPELINE</p>
          <h2>Leads by status</h2>
        </div>
        <OverviewMetricInfo metricKey="pipeline_status" />
      </div>
      {query.isLoading ? (
        <PanelSkeleton rows={3} />
      ) : query.isError ? (
        <WidgetError
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Pipeline status"
        />
      ) : total === 0 ? (
        <EmptyWidget
          actionHref="/companies"
          actionLabel="Add a company"
          message="No companies with contacts are in Leads yet."
        />
      ) : (
        <>
          <div
            aria-label={`${formatCount(total)} leads across ${data?.status_breakdown.length ?? 0} statuses`}
            className="overview-status-bar"
            role="img"
          >
            {data?.status_breakdown.map((item, index) => (
              <span
                key={item.status}
                style={{
                  backgroundColor: statusColors[index % statusColors.length],
                  width: `${item.percentage ?? 0}%`,
                }}
              />
            ))}
          </div>
          <ul className="overview-status-legend">
            {data?.status_breakdown.map((item, index) => (
              <li key={item.status}>
                <span
                  className="overview-status-swatch"
                  style={{
                    backgroundColor: statusColors[index % statusColors.length],
                  }}
                />
                <span className="overview-status-name">
                  {item.status.replaceAll("_", " ")}
                </span>
                <strong>{formatCount(item.count)}</strong>
                <span>{formatPercentage(item.percentage)}</span>
              </li>
            ))}
          </ul>
        </>
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
    { key: "crawl_success", label: "Crawl success", metric: data?.crawl_success },
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
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <span className="overview-coverage-denominator">
                {row.metric?.total
                  ? `${formatCount(row.metric.count)} of ${formatCount(row.metric.total)}`
                  : "No completed crawls"}
              </span>
              <strong>{formatPercentage(row.metric?.percentage ?? null)}</strong>
              <OverviewMetricInfo metricKey={row.key} />
            </li>
          ))}
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
                ["Crawler", data?.crawler],
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
  onboarding,
}: {
  onboarding: NonNullable<OverviewResponse["onboarding"]>;
}) {
  if (onboarding.steps.every((step) => step.completed)) return null;
  return (
    <section aria-labelledby="overview-onboarding-title" className="overview-onboarding">
      <div className="overview-section-heading">
        <div>
          <p className="overview-eyebrow">GET STARTED</p>
          <h2 id="overview-onboarding-title">Set up your lead workspace</h2>
          <p>Complete these steps to build your first working pipeline.</p>
        </div>
        <CheckCircle2 aria-hidden="true" className="overview-onboarding-icon" size={22} />
      </div>
      <ol className="overview-onboarding-list">
        {onboarding.steps.map((step) => (
          <li key={step.id}>
            <Link href={step.href}>
              {step.completed ? (
                <CheckCircle2 aria-hidden="true" className="is-complete" size={20} />
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
