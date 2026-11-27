"use client";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Gauge,
  Globe,
  Hash,
  Layers3,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getWebsiteAnalytics,
  type WebsiteAnalyticsBreakdown,
  type WebsiteAnalyticsDiscoveryKeyword,
  type WebsiteAnalyticsKeywordTerm,
  type WebsiteAnalyticsPageSpeedDevice,
} from "@/lib/api";
import { PageLoading } from "./page-loading";

const pageSpeedCategories = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best practices" },
  { key: "seo", label: "SEO" },
];
const websiteStatuses = [
  "new",
  "checked",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
  "needs_review",
];

export function WebsiteAnalyticsPage() {
  const query = useQuery({
    queryKey: ["website-analytics"],
    queryFn: getWebsiteAnalytics,
    staleTime: 60_000,
  });
  const data = query.data;

  if (query.isLoading) {
    return (
      <PageLoading
        label="Loading website analytics"
        variant="website-analytics"
      />
    );
  }

  return (
    <div className="website-analytics-page">
      <header className="website-analytics-header">
        <div>
          <p className="website-analytics-eyebrow">WEBSITE PORTFOLIO</p>
          <h1>Website analytics</h1>
          <p>
            Performance and quality across every website in your organization.
          </p>
          {data && (
            <span className="website-analytics-updated">
              <Clock3 aria-hidden="true" size={13} />
              Calculated {formatDateTime(data.generated_at)}
            </span>
          )}
        </div>
        <div className="website-analytics-actions">
          <button
            aria-label="Refresh website analytics"
            className="website-analytics-refresh"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={query.isFetching ? "is-spinning" : undefined}
              size={16}
            />
            Refresh
          </button>
          <Link className="website-analytics-registry-link" href="/websites">
            Open website registry
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </header>

      {query.isError ? (
        <div className="website-analytics-error" role="alert">
          <div>
            <strong>Couldn’t load website analytics</strong>
            <p>{query.error.message}</p>
          </div>
          <button onClick={() => void query.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          <section aria-label="Portfolio summary" className="website-analytics-kpis">
            <MetricCard
              icon={Globe}
              label="Total websites"
              note="Registered in this organization"
              value={formatCount(data.total_websites)}
            />
            <MetricCard
              icon={Activity}
              label="Crawled"
              note={`${formatCount(data.crawled_websites)} of ${formatCount(data.total_websites)} sites`}
              value={formatPercent(data.crawled_percentage)}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Median Domain Rating"
              note={`Reported for ${formatCount(data.domain_rating.count)} sites`}
              value={formatScore(data.domain_rating.median)}
            />
            <MetricCard
              icon={Gauge}
              label="PageSpeed coverage"
              note={`${formatCount(data.coverage.pagespeed_any)} sites scanned · mobile ${formatCount(data.coverage.pagespeed_mobile)} · desktop ${formatCount(data.coverage.pagespeed_desktop)}`}
              value={formatCoverage(
                data.coverage.pagespeed_any,
                data.total_websites,
              )}
            />
          </section>

          {data.total_websites === 0 ? (
            <section className="website-analytics-empty">
              <Globe aria-hidden="true" size={24} />
              <h2>No websites yet</h2>
              <p>
                Once websites are discovered or added, their portfolio
                analytics will appear here.
              </p>
              <Link href="/discovery">Discover websites</Link>
            </section>
          ) : (
            <>
              <section className="website-analytics-pagespeed">
                <div className="website-analytics-section-heading">
                  <div>
                    <p className="website-analytics-eyebrow">LIGHTHOUSE LAB SCORES</p>
                    <h2>PageSpeed by device</h2>
                  </div>
                  <p>
                    Latest scan per site; averages exclude missing scores.
                  </p>
                </div>
                <div className="website-analytics-pagespeed-grid">
                  <PageSpeedPanel
                    device="Desktop"
                    summary={data.pagespeed_desktop}
                  />
                  <PageSpeedPanel
                    device="Mobile"
                    summary={data.pagespeed_mobile}
                  />
                </div>
                <p className="website-analytics-method-note">
                  Lab results can vary between runs and aren’t real-user Core
                  Web Vitals. DR bands show the portfolio distribution, not
                  universal quality grades.
                </p>
              </section>

              <KeywordAnalyticsSection
                content={data.content_keywords}
                discovery={data.discovery_keywords}
              />

              <section className="website-analytics-grid">
                <BreakdownPanel
                  icon={Globe}
                  description="Share of all registered websites"
                  items={data.discovery_source_breakdown}
                  title="Discovery sources"
                />
                <BreakdownPanel
                  icon={Layers3}
                  description="Crawl-derived classifications"
                  items={data.site_type_breakdown}
                  title="Site types"
                />
                <BreakdownPanel
                  icon={Activity}
                  description="Current workflow state across all sites"
                  items={websiteStatuses.map((status) => {
                    const count =
                      data.status_breakdown.find(
                        (item) => item.key === status,
                      )?.count ?? 0;
                    return {
                      key: status,
                      count,
                      percentage: data.total_websites
                        ? (count / data.total_websites) * 100
                        : 0,
                    };
                  })}
                  title="Website status"
                />
                <BreakdownPanel
                  icon={ShieldCheck}
                  description="Listing sites versus other pages"
                  items={data.page_type_breakdown}
                  title="Page classifications"
                />
                <DistributionPanel
                  icon={BarChart3}
                  description="Reported scores, grouped for comparison"
                  items={data.domain_rating.distribution}
                  title="Domain Rating distribution"
                  total={data.domain_rating.count}
                />
                <CoveragePanel
                  coverage={data.coverage}
                  total={data.total_websites}
                />
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  note,
  value,
}: {
  icon: typeof Globe;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <article className="website-analytics-kpi">
      <div className="website-analytics-kpi-heading">
        <span>{label}</span>
        <span className="website-analytics-kpi-icon">
          <Icon aria-hidden="true" size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function BreakdownPanel({
  description,
  icon: Icon,
  items,
  title,
}: {
  description: string;
  icon: typeof Globe;
  items: WebsiteAnalyticsBreakdown[];
  title: string;
}) {
  const visibleItems = items.slice(0, 5);
  const remainingItems = items.slice(5);
  return (
    <article className="website-analytics-panel">
      <PanelHeading description={description} icon={Icon} title={title} />
      {items.length === 0 ? (
        <p className="website-analytics-no-data">No data available</p>
      ) : (
        <>
          <BreakdownRows items={visibleItems} />
          {remainingItems.length > 0 && (
            <details className="website-analytics-more">
              <summary>Show {formatCount(remainingItems.length)} more</summary>
              <BreakdownRows items={remainingItems} />
            </details>
          )}
        </>
      )}
    </article>
  );
}

function BreakdownRows({ items }: { items: WebsiteAnalyticsBreakdown[] }) {
  return (
    <ul className="website-analytics-breakdown">
      {items.map((item) => (
        <li key={item.key}>
          <div className="website-analytics-breakdown-label">
            <span>{formatLabel(item.key)}</span>
            <small className="website-analytics-breakdown-percent">
              {formatPercent(item.percentage)}
            </small>
            <strong>{formatCount(item.count)}</strong>
          </div>
          <div
            aria-label={`${formatLabel(item.key)}: ${formatPercent(item.percentage)}`}
            className="website-analytics-track"
            role="img"
          >
            <span style={{ width: `${item.percentage}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DistributionPanel({
  description,
  icon: Icon,
  items,
  title,
  total,
}: {
  description: string;
  icon: typeof Globe;
  items: WebsiteAnalyticsBreakdown[];
  title: string;
  total: number;
}) {
  return (
    <article className="website-analytics-panel">
      <PanelHeading
        description={`${description} ${formatCount(total)} scored websites.`}
        icon={Icon}
        title={title}
      />
      <ul className="website-analytics-breakdown">
        {items.map((item) => (
          <li key={item.key}>
            <div className="website-analytics-breakdown-label">
              <span>{item.key}</span>
              <small className="website-analytics-breakdown-percent">
                {formatPercent(item.percentage)}
              </small>
              <strong>{formatCount(item.count)}</strong>
            </div>
            <div
              aria-label={`${item.key}: ${formatPercent(item.percentage)}`}
              className="website-analytics-track is-rating"
              role="img"
            >
              <span style={{ width: `${item.percentage}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CoveragePanel({
  coverage,
  total,
}: {
  coverage: {
    domain_rating: number;
    hypestat: number;
    pagespeed_any: number;
    pagespeed_desktop: number;
    pagespeed_mobile: number;
  };
  total: number;
}) {
  const metrics = [
    { label: "Domain Rating", count: coverage.domain_rating },
    { label: "HypeStat profile", count: coverage.hypestat },
    { label: "Desktop PageSpeed", count: coverage.pagespeed_desktop },
    { label: "Mobile PageSpeed", count: coverage.pagespeed_mobile },
  ];
  return (
    <article className="website-analytics-panel">
      <PanelHeading
        description="Data availability across the full website portfolio."
        icon={Gauge}
        title="Data coverage"
      />
      <ul className="website-analytics-coverage">
        {metrics.map((metric) => (
          <li key={metric.label}>
            <span>{metric.label}</span>
            <strong>{formatCount(metric.count)}</strong>
            <small>
              {formatPercent(
                total ? (metric.count / total) * 100 : null,
              )}
            </small>
          </li>
        ))}
      </ul>
    </article>
  );
}

function KeywordAnalyticsSection({
  content,
  discovery,
}: {
  content: {
    analyzed_websites: number;
    crawled_websites: number;
    unique_words: number;
    unique_phrases: number;
    top_words: WebsiteAnalyticsKeywordTerm[];
    top_phrases: WebsiteAnalyticsKeywordTerm[];
  };
  discovery: {
    unique_queries: number;
    linked_websites: number;
    top_queries: WebsiteAnalyticsDiscoveryKeyword[];
  };
}) {
  return (
    <section className="website-analytics-keywords">
      <div className="website-analytics-keyword-heading">
        <div>
          <p className="website-analytics-eyebrow">KEYWORD INTELLIGENCE</p>
          <h2>Keyword analytics</h2>
        </div>
        <p>
          Crawl-derived content terms and discovery searches are tracked
          separately.
        </p>
      </div>

      <div className="website-analytics-keyword-metrics">
        <article className="website-analytics-keyword-metric">
          <div className="website-analytics-keyword-metric-title">
            <span><Layers3 aria-hidden="true" size={16} /> On-site terms</span>
            <small>
              {formatCount(content.analyzed_websites)} /{" "}
              {formatCount(content.crawled_websites)} analyzed
            </small>
          </div>
          <div className="website-analytics-keyword-metric-value">
            <strong>
              {formatCount(content.unique_words + content.unique_phrases)}
            </strong>
            <span>unique extracted terms</span>
          </div>
          <p>
            {formatCount(content.unique_words)} words ·{" "}
            {formatCount(content.unique_phrases)} phrases from current crawl
            analyses
          </p>
        </article>
        <article className="website-analytics-keyword-metric">
          <div className="website-analytics-keyword-metric-title">
            <span><Search aria-hidden="true" size={16} /> Discovery searches</span>
            <small>
              {formatCount(discovery.linked_websites)} linked sites
            </small>
          </div>
          <div className="website-analytics-keyword-metric-value">
            <strong>{formatCount(discovery.unique_queries)}</strong>
            <span>unique search queries</span>
          </div>
          <p>Saved search terms linked to websites in this portfolio</p>
        </article>
      </div>

      <div className="website-analytics-keyword-grid">
        <KeywordPanel
          description="Site frequency among each crawl’s extracted top terms."
          emptyMessage="No current on-site keyword analyses are available."
          icon={Hash}
          items={content.top_words}
          title="Top on-site words"
        />
        <KeywordPanel
          description="Phrase frequency among each crawl’s extracted top terms."
          emptyMessage="No current on-site phrase analyses are available."
          icon={Layers3}
          items={content.top_phrases}
          title="Top on-site phrases"
        />
        <KeywordPanel
          description="Websites linked to each saved discovery query."
          emptyMessage="No discovery queries are linked to websites yet."
          icon={Search}
          items={discovery.top_queries}
          title="Top discovery queries"
        />
      </div>

      <p className="website-analytics-keyword-note">
        On-site terms are extracted from crawled page titles and meta
        descriptions and appear here only when included in a site’s extracted
        top terms; they are not organic rankings or search volume. Discovery
        queries may overlap across websites, so their coverage percentages do
        not add up to 100%.
      </p>
    </section>
  );
}

function KeywordPanel({
  description,
  emptyMessage,
  icon: Icon,
  items,
  title,
}: {
  description: string;
  emptyMessage: string;
  icon: typeof Globe;
  items: Array<{
    keyword: string;
    website_count: number;
    website_percentage: number;
    search_count?: number;
  }>;
  title: string;
}) {
  return (
    <article className="website-analytics-panel website-analytics-keyword-panel">
      <PanelHeading description={description} icon={Icon} title={title} />
      {items.length === 0 ? (
        <p className="website-analytics-no-data">{emptyMessage}</p>
      ) : (
        <ul className="website-analytics-breakdown">
          {items.map((item) => (
            <li key={item.keyword}>
              <div className="website-analytics-breakdown-label">
                <span title={item.keyword}>{item.keyword}</span>
                <small className="website-analytics-breakdown-percent">
                  {formatPercent(item.website_percentage)}
                </small>
                <strong>{formatCount(item.website_count)}</strong>
              </div>
              <div
                aria-label={`${item.keyword}: ${formatCount(item.website_count)} websites, ${formatPercent(item.website_percentage)}`}
                className="website-analytics-track"
                role="img"
              >
                <span style={{ width: `${item.website_percentage}%` }} />
              </div>
              {item.search_count !== undefined && (
                <small className="website-analytics-keyword-record-count">
                  {formatCount(item.search_count)} saved search records
                </small>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function PageSpeedPanel({
  device,
  summary,
}: {
  device: string;
  summary: WebsiteAnalyticsPageSpeedDevice;
}) {
  return (
    <article className="website-analytics-pagespeed-panel">
      <div className="website-analytics-pagespeed-heading">
        <div>
          <span className="website-analytics-device-icon">
            {device === "Desktop" ? (
              <Monitor aria-hidden="true" size={16} />
            ) : (
              <Smartphone aria-hidden="true" size={16} />
            )}
          </span>
          <h3>{device}</h3>
        </div>
        <span className="website-analytics-scan-count">
          {formatCount(summary.scanned_websites)} scanned
        </span>
      </div>
      <div className="website-analytics-score-content">
        <div className="website-analytics-performance-score">
          <ScoreRing value={summary.averages.performance ?? null} />
          <span>Avg. performance</span>
        </div>
        <ul className="website-analytics-scores">
          {pageSpeedCategories.slice(1).map((category) => {
            const value = summary.averages[category.key] ?? null;
            return (
              <li key={category.key}>
                <div className="website-analytics-breakdown-label">
                  <span>{category.label}</span>
                  <strong>{formatScore(value)}</strong>
                </div>
                <div className="website-analytics-track is-score">
                  <span
                    className={scoreClass(value)}
                    style={{ width: `${value ?? 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="website-analytics-performance-bands">
        {summary.performance_distribution.map((item) => (
          <span className={`is-${item.key}`} key={item.key}>
            <strong>{formatCount(item.count)}</strong>
            {formatLabel(item.key)}
            <small>{formatPercent(item.percentage)}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function ScoreRing({ value }: { value: number | null }) {
  const score = value ?? 0;
  return (
    <div
      aria-label={`Average performance score ${formatScore(value)} out of 100`}
      className={`website-analytics-score-ring ${scoreClass(value)}`}
      role="img"
      style={{
        background: `conic-gradient(var(--score-color) 0 ${score}%, var(--score-track) ${score}% 100%)`,
      }}
    >
      <span>{formatScore(value)}</span>
      <small>/ 100</small>
    </div>
  );
}

function PanelHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Globe;
  title: string;
}) {
  return (
    <div className="website-analytics-panel-heading">
      <div className="website-analytics-panel-title">
        <span><Icon aria-hidden="true" size={16} /></span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatScore(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

function formatCoverage(count: number, total: number) {
  return total ? formatPercent((count / total) * 100) : "—";
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scoreClass(value: number | null) {
  if (value === null) return "";
  if (value >= 90) return "is-good";
  if (value >= 50) return "is-needs-improvement";
  return "is-poor";
}
