"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  RotateCw,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  crawlWebsite,
  fetchWebsiteAhrefsMetrics,
  getApplicationSettings,
  getWebsiteDetail,
  refetchWebsiteHypeStat,
  updateWebsite,
} from "@/lib/api";
import type {
  CrawlPageClassification,
  PageSpeedScanSummary,
  WebsiteCrawlJobHistory,
  WebsiteDetailResponse,
  WebsiteAhrefsMetrics,
  WebsiteStatus,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";
import { WebsiteHypeStatProfileView } from "./website-hypestat-profile";

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const WEBSITE_PROFILE_SECTIONS = [
  ["overview", "Overview"],
  ["ahrefs", "Ahrefs"],
  ["pagespeed", "PageSpeed"],
  ["content", "Content"],
  ["contacts", "Contacts"],
  ["signals", "Signals"],
  ["activity", "Activity"],
] as const;

export function WebsiteDetailPage({ websiteId }: { websiteId: string }) {
  const validId = uuidPattern.test(websiteId);
  const websiteQuery = useQuery({
    queryKey: ["website-detail", websiteId],
    queryFn: () => {
      if (!validId) {
        throw new Error("A valid website ID is required.");
      }
      return getWebsiteDetail(websiteId);
    },
    enabled: validId,
  });

  if (!validId) {
    return (
      <DetailState
        message="The website ID in this link is not valid."
        title="Website not found"
      />
    );
  }
  if (websiteQuery.isLoading) return <WebsiteProfileSkeleton />;
  if (websiteQuery.isError) {
    return (
      <DetailState
        message={websiteQuery.error.message}
        onRetry={() => void websiteQuery.refetch()}
        title="Could not load website"
      />
    );
  }
  if (!websiteQuery.data) {
    return (
      <DetailState
        message="The API returned no website detail record."
        title="Website details unavailable"
      />
    );
  }

  return <WebsiteDetails data={websiteQuery.data} />;
}

function WebsiteDetails({ data }: { data: WebsiteDetailResponse }) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("overview");
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const {
    website,
    crawl,
    hypestat_profile: hypestatProfile,
    ahrefs_metrics: ahrefsMetrics,
    crawl_jobs: crawlJobs,
    discovery_keywords: discoveryKeywords,
  } = data;
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    retry: false,
  });
  const crawlStatus =
    website.crawl_job_status ??
    (website.is_crawled ? "succeeded" : "not_queued");
  const crawlPages = getCrawlPages(crawl);
  const socialLinks = groupSocialLinks(
    crawl?.social_links ?? [],
    website.website_url,
    website.domain,
  );
  const largePlatform = isLargePlatform(website.domain, website.page_type);
  const prospectStatus = assessProspect(website, largePlatform);
  const category = website.category ?? crawl?.site_type;
  const evidence = getVerdictEvidence(crawl?.classification_signals ?? []);
  const seoOverview = getSeoOverviewMetrics(
    hypestatProfile?.payload,
    website,
  );

  useEffect(() => {
    const updateScrollState = () => {
      const hero = document.getElementById("website-profile-hero");
      setShowCompactHeader(
        hero !== null && hero.getBoundingClientRect().bottom < 0,
      );
      const current = WEBSITE_PROFILE_SECTIONS.map(([id]) =>
        document.getElementById(id),
      )
        .filter((element): element is HTMLElement => element !== null)
        .filter((element) => element.getBoundingClientRect().top <= 190)
        .pop();
      setActiveSection(current?.id ?? "overview");
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const invalidateWebsite = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["website-detail", website.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["websites"] }),
    ]);
  };
  const statusMutation = useMutation({
    mutationFn: (status: WebsiteStatus) =>
      updateWebsite(website.id, { status }),
    onSuccess: invalidateWebsite,
  });
  const crawlMutation = useMutation({
    mutationFn: () => crawlWebsite({ website_url: website.website_url }),
    onSuccess: invalidateWebsite,
  });
  const refetchHypeStat = useMutation({
    mutationFn: () => refetchWebsiteHypeStat(website.id),
    onSuccess: async () => {
      await Promise.all([
        invalidateWebsite(),
        queryClient.invalidateQueries({ queryKey: ["hypestat-usage"] }),
      ]);
    },
  });
  const fetchAhrefs = useMutation({
    mutationFn: () => fetchWebsiteAhrefsMetrics(website.id),
    onSuccess: async () => {
      await Promise.all([
        invalidateWebsite(),
        queryClient.invalidateQueries({ queryKey: ["ahrefs-usage"] }),
      ]);
    },
  });
  const isCrawled = website.is_crawled || crawlStatus === "succeeded";

  return (
    <div className="company-detail-page website-detail-page">
      <Link className="profile-back-link" href="/websites">
        <ArrowLeft aria-hidden="true" size={15} />
        Websites
      </Link>

      <header className="profile-hero" id="website-profile-hero">
        <div className="profile-identity">
          <WebsiteAvatar
            domain={website.domain}
            faviconUrl={website.favicon_url}
          />
          <div className="profile-identity-copy">
            <div className="profile-domain-line">
              <h1 id="website-profile-heading">{website.domain}</h1>
              <a
                aria-label={`Visit ${website.domain}`}
                className="profile-external-link"
                href={website.website_url}
                rel="noreferrer"
                target="_blank"
                title={`Visit ${website.domain}`}
              >
                <ExternalLink aria-hidden="true" size={17} />
              </a>
            </div>
            <div className="profile-status-line">
                  <span
                    className={`profile-status-indicator is-${getStatusTone(isCrawled ? "succeeded" : crawlStatus)}`}
                  />
              <span>{isCrawled ? "Indexed" : formatStatus(crawlStatus)}</span>
              <span aria-hidden="true">·</span>
              <span>{category ? formatSiteType(category) : "Unclassified"}</span>
              <span aria-hidden="true">·</span>
              <label className="profile-status-select">
                <span className="visually-hidden">Website status</span>
                <select
                  aria-label="Website status"
                  disabled={statusMutation.isPending}
                  onChange={(event) => {
                    if (isWebsiteStatus(event.target.value)) {
                      statusMutation.mutate(event.target.value);
                    }
                  }}
                  value={website.status}
                >
                  <option value="new">New</option>
                  <option value="lead">Lead</option>
                  <option value="checked">Checked</option>
                </select>
                <ChevronDown aria-hidden="true" size={13} />
              </label>
            </div>
          </div>
        </div>
        <div className="profile-header-actions">
          <button
            className="profile-button profile-button-secondary"
            disabled={statusMutation.isPending || website.status === "checked"}
            onClick={() => statusMutation.mutate("checked")}
            title="Mark as checked so it is not treated as a new lead"
            type="button"
          >
            Exclude
          </button>
          {prospectStatus.plausible ? (
            <button
              className="profile-button profile-button-primary"
              disabled={crawlMutation.isPending}
              onClick={() => crawlMutation.mutate()}
              type="button"
            >
              <RotateCw aria-hidden="true" size={15} />
              {crawlMutation.isPending ? "Queueing…" : "Re-index"}
            </button>
          ) : (
            <button
              className="profile-button profile-button-primary"
              disabled={
                statusMutation.isPending || website.status === "lead"
              }
              onClick={() => statusMutation.mutate("lead")}
              type="button"
            >
              Keep as lead
            </button>
          )}
        </div>
      </header>

      {(statusMutation.isError || crawlMutation.isError) && (
        <InlineError
          message={
            statusMutation.isError
              ? `Could not update website status: ${statusMutation.error.message}`
              : `Could not queue a new indexing job: ${crawlMutation.error?.message ?? "Unknown error"}`
          }
        />
      )}
      {statusMutation.isSuccess && (
        <p className="profile-action-feedback" role="status">
          Website status saved.
        </p>
      )}
      {crawlMutation.isSuccess && (
        <p className="profile-action-feedback" role="status">
          Indexing job queued for {website.domain}.
        </p>
      )}

      <VerdictCard
        evidence={evidence}
        kind={prospectStatus.plausible ? "neutral" : "caution"}
        onReviewSignals={
          crawl?.classification_signals.length
            ? () => document.getElementById("signals")?.scrollIntoView()
            : undefined
        }
        reason={prospectStatus.reason}
        title={prospectStatus.title}
      />

      <SectionTabs
        activeSection={activeSection}
        domain={website.domain}
        isPlausible={prospectStatus.plausible}
        onExclude={() => statusMutation.mutate("checked")}
        onKeepAsLead={() => statusMutation.mutate("lead")}
        onRecrawl={() => crawlMutation.mutate()}
        statusPending={statusMutation.isPending}
        status={website.status}
        recrawlPending={crawlMutation.isPending}
        showCompactHeader={showCompactHeader}
        websiteUrl={website.website_url}
      />

      <SeoOverview
        discoveryKeywords={discoveryKeywords}
        error={refetchHypeStat.error?.message}
        isPending={refetchHypeStat.isPending}
        metrics={seoOverview}
        onRetry={() => refetchHypeStat.mutate()}
        profile={hypestatProfile}
        website={website}
      />
      <AhrefsSection
        domainRating={website.ahrefs_domain_rating}
        domainRatingFetchedAt={website.ahrefs_domain_rating_fetched_at}
        domainRatingLicenseUrl={website.ahrefs_domain_rating_license_url}
        error={fetchAhrefs.error?.message}
        isConfigured={settingsQuery.data?.ahrefs_configured === true}
        isPending={fetchAhrefs.isPending}
        metrics={ahrefsMetrics}
        onFetch={() => fetchAhrefs.mutate()}
      />

      <div className="profile-content-layout">
        <div className="profile-main-column">
          <PageSpeedSection
            isCrawled={isCrawled}
            scans={data.pagespeed_scans}
          />
          <section className="profile-card" id="content">
            <SectionHeading
              count={crawlPages.length}
              title="Extracted content"
            />
            {!crawl ? (
              <p className="profile-empty">
                Content will appear after the first indexing job.
              </p>
            ) : crawlPages.length ? (
              <div className="profile-content-list">
                {crawlPages.map((page) => (
                  <ExtractedPage
                    key={page.title}
                    content={page.content ?? ""}
                    language={website.language}
                    title={page.title}
                    url={page.url}
                  />
                ))}
              </div>
            ) : (
              <p className="profile-empty">
                Indexing completed without storing page content.
              </p>
            )}
          </section>

          <ContactsSection
            emails={crawl?.emails ?? []}
            links={socialLinks}
            pageCount={crawlPages.length}
            phones={crawl?.phones ?? []}
          />

          <section className="profile-card" id="signals">
            <SectionHeading
              count={crawl?.classification_signals.length ?? 0}
              title="Classification signals"
            />
            {!crawl ? (
              <p className="profile-empty">
                Signals will appear after indexing.
              </p>
            ) : crawl.classification_signals.length ? (
              <div className="profile-signal-list">
                {crawl.classification_signals.map((page, index) => (
                  <SignalsAccordion
                    key={`${page.url}-${index}`}
                    page={page}
                  />
                ))}
              </div>
            ) : (
              <p className="profile-empty">
                No page-level signals were saved for this indexing job.
              </p>
            )}
          </section>

          <section className="profile-card" id="activity">
            <SectionHeading title="Activity" />
            <CrawlActivity
              crawlStatus={crawlStatus}
              jobs={crawlJobs}
            />
          </section>
        </div>

        <DetailsRail
          addedAt={website.created_at}
          addedBy={website.created_by_email}
          canonicalUrl={website.website_url}
          crawlId={crawl?.id ?? website.crawl_id}
          language={website.language}
          lastCrawled={crawl?.crawled_at ?? website.crawled_at}
          source={website.discovery_source}
          provider={website.discovery_provider}
          type={website.page_type}
          websiteId={website.id}
        />
      </div>
    </div>
  );
}

function PageSpeedSection({
  isCrawled,
  scans,
}: {
  isCrawled: boolean;
  scans: PageSpeedScanSummary[];
}) {
  return (
    <section className="profile-card" id="pagespeed">
      <SectionHeading count={scans.length} title="PageSpeed insights" />
      {scans.length ? (
        <>
          <p className="website-pagespeed-caption">
            Google Lighthouse scores from recent mobile and desktop scans.
          </p>
          <div className="website-pagespeed-list">
            {scans.map((scan) => (
                <article className="website-pagespeed-scan" key={scan.id}>
                  <header className="website-pagespeed-heading">
                    <h3>{scan.strategy} scan</h3>
                    <time dateTime={scan.scanned_at}>
                      {formatAbsoluteDate(scan.scanned_at)}
                    </time>
                  </header>
                  <div className="website-pagespeed-scores">
                    {[
                      ["Performance", "performance"],
                      ["Accessibility", "accessibility"],
                      ["Best practices", "best-practices"],
                      ["SEO", "seo"],
                    ].map(([label, category]) => (
                      <PageSpeedScore
                        key={category}
                        label={label}
                        score={scan.category_scores[category]}
                      />
                    ))}
                  </div>
                </article>
              ))}
          </div>
        </>
      ) : (
        <p className="profile-empty website-pagespeed-empty">
          {isCrawled
            ? "No completed PageSpeed scans are available yet."
            : "PageSpeed scans are queued after the first successful crawl."}{" "}
          <Link href="/jobs?tab=pagespeed">View the PageSpeed queue</Link>
        </p>
      )}
    </section>
  );
}

function PageSpeedScore({
  label,
  score,
}: {
  label: string;
  score: number | null | undefined;
}) {
  const tone =
    score === null || score === undefined
      ? "unknown"
      : score >= 90
        ? "good"
        : score >= 50
          ? "needs-work"
          : "poor";
  return (
    <div className="website-pagespeed-score">
      <span>{label}</span>
      <strong className={`is-${tone}`}>
        {score === null || score === undefined ? "—" : score}
        <small>{score === null || score === undefined ? "" : " / 100"}</small>
      </strong>
    </div>
  );
}

interface SeoOverviewMetrics {
  organicKeywords: number | null;
  organicTraffic: number | null;
  organicTrafficValue: number | null;
  monthlyVisits: number | null;
  globalRank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  followedBacklinks: number | null;
  nofollowBacklinks: number | null;
  trafficSources: { label: string; value: number }[];
  monthlyChanges: { label: string; value: number }[];
  referringDomainsByCountry: { country: string; domains: number }[];
}

function SeoOverview({
  discoveryKeywords,
  error,
  isPending,
  metrics,
  onRetry,
  profile,
  website,
}: {
  discoveryKeywords: WebsiteDetailResponse["discovery_keywords"];
  error?: string;
  isPending: boolean;
  metrics: SeoOverviewMetrics;
  onRetry: () => void;
  profile: WebsiteDetailResponse["hypestat_profile"];
  website: WebsiteDetailResponse["website"];
}) {
  const updatedAt = profile?.checked_at ?? profile?.fetched_at;
  const maxTrafficSource = Math.max(
    0,
    ...metrics.trafficSources.map((source) => source.value),
  );
  const maxReferringDomains = Math.max(
    0,
    ...metrics.referringDomainsByCountry.map((country) => country.domains),
  );
  const maxMonthlyChange = Math.max(
    0,
    ...metrics.monthlyChanges.map((change) => Math.abs(change.value)),
  );
  const metricItems = [
    {
      label: "Organic keywords",
      value: formatCompactMetric(metrics.organicKeywords),
      detail: "SEMrush estimate",
    },
    {
      label: "Organic traffic",
      value: formatCompactMetric(metrics.organicTraffic),
      detail: "Estimated monthly visits",
    },
    {
      label: "Backlinks",
      value: formatCompactMetric(metrics.backlinks),
      detail: "All reported links",
    },
    {
      label: "Referring domains",
      value: formatCompactMetric(metrics.referringDomains),
      detail: "Linking websites",
    },
    {
      label: "Monthly visits",
      value: formatCompactMetric(metrics.monthlyVisits),
      detail: "HypeStat estimate",
    },
    {
      label: "HypeStat rank",
      value: formatCompactMetric(metrics.globalRank),
      detail: "Global estimate",
    },
  ];

  return (
    <section
      aria-labelledby="site-overview-heading"
      className="profile-card profile-seo-overview"
      id="overview"
    >
      <header className="profile-seo-heading">
        <div>
          <p className="profile-seo-eyebrow">SITE OVERVIEW</p>
          <h2 id="site-overview-heading">Search and link performance</h2>
          <p>Current estimates for organic visibility, audience, and backlinks.</p>
        </div>
        <div className="profile-seo-snapshot">
          <span>Root domain</span>
          <strong>{website.domain}</strong>
          {updatedAt ? (
            <RelativeTime prefix="Updated" value={updatedAt} />
          ) : (
            <span>Snapshot date unavailable</span>
          )}
        </div>
      </header>

      <HypeStatRow
        error={error}
        isPending={isPending}
        onRetry={onRetry}
        profile={profile}
      />

      <div aria-label="Search and backlink metrics" className="profile-seo-metrics">
        {metricItems.map((item) => (
          <div className="profile-seo-metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>

      <div className="profile-seo-grid">
        <section
          aria-labelledby="profile-seo-organic-title"
          className="profile-seo-widget"
        >
          <div className="profile-seo-widget-heading">
            <div>
              <h3 id="profile-seo-organic-title">Organic search</h3>
              <p>Estimated reach and monthly movement</p>
            </div>
            <span className="profile-seo-source">SEMrush</span>
          </div>
          <div className="profile-seo-organic-primary">
            <span>Estimated organic traffic</span>
            <strong>{formatCompactMetric(metrics.organicTraffic)}</strong>
            <small>visits per month</small>
          </div>
          <div className="profile-seo-organic-secondary">
            <div>
              <span>Organic keywords</span>
              <strong>{formatMetric(metrics.organicKeywords)}</strong>
            </div>
            <div>
              <span>Traffic value</span>
              <strong>{formatCurrencyMetric(metrics.organicTrafficValue)}</strong>
            </div>
          </div>
          <div className="profile-seo-subheading">
            <h4>Monthly movement</h4>
            <span>Compared with the previous month</span>
          </div>
          {metrics.monthlyChanges.length ? (
            <ul className="profile-seo-change-list">
              {metrics.monthlyChanges.map((change) => {
                const width =
                  maxMonthlyChange > 0
                    ? (Math.abs(change.value) / maxMonthlyChange) * 100
                    : 0;
                const isFavorable =
                  change.label === "Bounce rate"
                    ? change.value <= 0
                    : change.value >= 0;
                const changeTone = isFavorable ? "is-positive" : "is-negative";
                return (
                  <li key={change.label}>
                    <span>{change.label}</span>
                    <span className="profile-seo-bar">
                      <span
                        className={`profile-seo-bar-fill ${changeTone}`}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <strong className={changeTone}>
                      {formatChangeMetric(change.value)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="profile-empty">Monthly comparison data is not reported.</p>
          )}
        </section>

        <section
          aria-labelledby="profile-seo-traffic-title"
          className="profile-seo-widget"
        >
          <div className="profile-seo-widget-heading">
            <div>
              <h3 id="profile-seo-traffic-title">Traffic channels</h3>
              <p>Estimated share by source</p>
            </div>
            <span className="profile-seo-source">HypeStat</span>
          </div>
          {metrics.trafficSources.length ? (
            <ul className="profile-seo-bar-list">
              {metrics.trafficSources.map((source) => (
                <li key={source.label}>
                  <span>{source.label}</span>
                  <span className="profile-seo-bar">
                    <span
                      className="profile-seo-bar-fill"
                      style={{
                        width: `${maxTrafficSource > 0 ? (source.value / maxTrafficSource) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <strong>{formatPercentMetric(source.value)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty">Traffic source data is not reported.</p>
          )}
        </section>

        <section
          aria-labelledby="profile-seo-referring-title"
          className="profile-seo-widget"
        >
          <div className="profile-seo-widget-heading">
            <div>
              <h3 id="profile-seo-referring-title">Referring domains by country</h3>
              <p>Where linking websites are located</p>
            </div>
            <span className="profile-seo-source">Link profile</span>
          </div>
          {metrics.referringDomainsByCountry.length ? (
            <ul className="profile-seo-bar-list">
              {metrics.referringDomainsByCountry.slice(0, 5).map((country) => (
                <li key={country.country}>
                  <span>{country.country}</span>
                  <span className="profile-seo-bar">
                    <span
                      className="profile-seo-bar-fill is-country"
                      style={{
                        width: `${maxReferringDomains > 0 ? (country.domains / maxReferringDomains) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <strong>{formatMetric(country.domains)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty">Country-level link data is not reported.</p>
          )}
        </section>

        <section
          aria-labelledby="profile-seo-links-title"
          className="profile-seo-widget"
        >
          <div className="profile-seo-widget-heading">
            <div>
              <h3 id="profile-seo-links-title">Backlink profile</h3>
              <p>Follow and nofollow links</p>
            </div>
            <span className="profile-seo-source">HypeStat</span>
          </div>
          {metrics.followedBacklinks !== null ||
          metrics.nofollowBacklinks !== null ? (
            <div className="profile-seo-link-split">
              {[
                {
                  label: "Followed",
                  value: metrics.followedBacklinks,
                },
                {
                  label: "Nofollow",
                  value: metrics.nofollowBacklinks,
                },
              ].map((item) => {
                const total =
                  (metrics.followedBacklinks ?? 0) +
                  (metrics.nofollowBacklinks ?? 0);
                const share = total > 0 ? ((item.value ?? 0) / total) * 100 : 0;
                return (
                  <div className="profile-seo-link-row" key={item.label}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{formatMetric(item.value)}</strong>
                    </div>
                    <span className="profile-seo-bar">
                      <span
                        className="profile-seo-bar-fill is-link"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="profile-empty">Follow status is not reported.</p>
          )}
        </section>
      </div>

      <section
        aria-labelledby="profile-seo-keywords-title"
        className="profile-seo-keywords"
      >
        <div className="profile-seo-widget-heading">
          <div>
            <h3 id="profile-seo-keywords-title">Discovery keywords</h3>
            <p>Search terms associated with this website</p>
          </div>
          <span className="profile-seo-count">{discoveryKeywords.length}</span>
        </div>
        {discoveryKeywords.length ? (
          <ul className="profile-keyword-list">
            {discoveryKeywords.map((keyword) => (
              <li key={keyword.id}>
                <Search aria-hidden="true" size={15} />
                <span>{keyword.keyword}</span>
                <AbsoluteTime value={keyword.searched_at} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">
            No discovery keywords are linked to this website yet.
          </p>
        )}
      </section>

      {profile?.payload && <HypeStatDetails payload={profile.payload} />}
    </section>
  );
}

function WebsiteAvatar({
  domain,
  faviconUrl,
}: {
  domain: string;
  faviconUrl: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <span className="profile-avatar" aria-hidden="true">
      {faviconUrl && !imageFailed ? (
        <Image
          alt=""
          height={44}
          onError={() => setImageFailed(true)}
          src={faviconUrl}
          unoptimized
          width={44}
        />
      ) : (
        domain.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function AhrefsSection({
  domainRating,
  domainRatingFetchedAt,
  domainRatingLicenseUrl,
  error,
  isConfigured,
  isPending,
  metrics,
  onFetch,
}: {
  domainRating: number | null;
  domainRatingFetchedAt: string | null;
  domainRatingLicenseUrl: string | null;
  error?: string;
  isConfigured: boolean;
  isPending: boolean;
  metrics: WebsiteAhrefsMetrics | null;
  onFetch: () => void;
}) {
  const rating = metrics?.domain_rating ?? domainRating;
  const metricItems: [string, string][] = [];
  if (rating !== null) {
    metricItems.push(["Domain Rating", rating.toFixed(1)]);
  }
  if (metrics?.organic_traffic != null) {
    metricItems.push([
      "Organic traffic",
      formatMetric(metrics.organic_traffic),
    ]);
  }
  if (metrics?.organic_keywords != null) {
    metricItems.push([
      "Organic keywords",
      formatMetric(metrics.organic_keywords),
    ]);
  }
  if (metrics?.backlinks_live != null) {
    metricItems.push(["Live backlinks", formatMetric(metrics.backlinks_live)]);
  }
  if (metrics?.backlinks_all_time != null) {
    metricItems.push([
      "All-time backlinks",
      formatMetric(metrics.backlinks_all_time),
    ]);
  }
  if (metrics?.refdomains_live != null) {
    metricItems.push([
      "Live referring domains",
      formatMetric(metrics.refdomains_live),
    ]);
  }
  if (metrics?.refdomains_all_time != null) {
    metricItems.push([
      "All-time referring domains",
      formatMetric(metrics.refdomains_all_time),
    ]);
  }
  if (metrics?.organic_traffic_cost_cents != null) {
    metricItems.push([
      "Organic traffic value",
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(metrics.organic_traffic_cost_cents / 100),
    ]);
  }
  const hasPaidMetrics = metricItems.some(
    ([label]) => label !== "Domain Rating",
  );
  const isFreeApiSnapshot = rating !== null && !hasPaidMetrics;
  const isFreeDomainRating = isFreeApiSnapshot && rating !== null;
  const fetchedAt = metrics?.fetched_at ?? domainRatingFetchedAt;
  const ratingProgress = Math.max(0, Math.min(100, rating ?? 0)) * 3.6;

  return (
    <section
      aria-labelledby="website-ahrefs-heading"
      className={`profile-card profile-seo-overview${isFreeDomainRating ? " ahrefs-dr-card" : ""}`}
      id="ahrefs"
    >
      <header
        className={`profile-seo-heading${isFreeDomainRating ? " ahrefs-dr-header" : ""}`}
      >
        {isFreeDomainRating ? (
          <div>
            <p className="profile-seo-eyebrow">AHREFS</p>
            <h2 id="website-ahrefs-heading">Domain Rating</h2>
          </div>
        ) : (
          <div>
            <p className="profile-seo-eyebrow">AHREFS METRICS</p>
            <h2 id="website-ahrefs-heading">Ahrefs metrics</h2>
            <p>
              Free Domain Rating is available with the public API. Organic and
              backlink metrics require paid Site Explorer access.
            </p>
          </div>
        )}
        <div className="settings-actions">
          {isConfigured ? (
            <button
              className={`profile-button${isFreeDomainRating ? " ahrefs-dr-refresh" : " profile-button-primary"}`}
              disabled={isPending}
              onClick={onFetch}
              title="Paid snapshots are cached for 24 hours. Free Domain Rating can be refreshed at any time."
              type="button"
            >
              {isFreeDomainRating && !isPending && (
                <RotateCw aria-hidden="true" size={14} />
              )}
              {isPending
                ? "Fetching…"
                : isFreeDomainRating
                  ? "Refresh"
                  : rating !== null
                    ? "Refresh Ahrefs metrics"
                    : "Fetch Ahrefs metrics"}
            </button>
          ) : (
            <Link
              className={`profile-button${isFreeDomainRating ? " ahrefs-dr-refresh" : " profile-button-primary"}`}
              href="/settings?section=ahrefs"
            >
              Configure Ahrefs
            </Link>
          )}
        </div>
      </header>
      {error && <InlineError message={`Ahrefs request failed: ${error}`} />}
      {isFreeDomainRating ? (
        <div className="ahrefs-dr-main">
          <div
            aria-label={`Domain Rating ${rating.toFixed(1)} out of 100`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={rating}
            className="ahrefs-dr-gauge"
            role="meter"
            style={{
              background: `conic-gradient(var(--profile-accent) ${ratingProgress}deg, var(--profile-divider) ${ratingProgress}deg)`,
            }}
          >
            <div className="ahrefs-dr-gauge-inner">
              <span>DR</span>
              <strong>{rating.toFixed(1)}</strong>
            </div>
          </div>
          <div className="ahrefs-dr-info">
            {fetchedAt && (
              <span className="ahrefs-dr-updated">
                <RelativeTime prefix="Updated" value={fetchedAt} />
              </span>
            )}
            <a
              className="ahrefs-dr-license"
              href={
                metrics?.domain_rating_license_url ??
                domainRatingLicenseUrl ??
                "https://ahrefs.com"
              }
              rel="noreferrer"
              target="_blank"
            >
              Ahrefs data license
              <ExternalLink aria-hidden="true" size={13} />
            </a>
          </div>
        </div>
      ) : metricItems.length > 0 ? (
        <>
          <div
            aria-label="Ahrefs website metrics"
            className="profile-seo-metrics"
          >
            {metricItems.map(([label, value]) => (
              <div className="profile-seo-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>Ahrefs estimate</small>
              </div>
            ))}
          </div>
          <p className="profile-empty">
            {metrics
              ? `Snapshot date ${new Date(metrics.snapshot_date).toLocaleDateString()} · `
              : ""}
            {fetchedAt && <RelativeTime prefix="Fetched" value={fetchedAt} />}
            {metrics?.units_used != null
              ? ` · ${metrics.units_used.toLocaleString()} API units used`
              : ""}
          </p>
        </>
      ) : (
        <p className="profile-empty">
          Fetch a free Domain Rating snapshot. Organic search, backlink, and
          referring-domain metrics require paid Site Explorer access.
        </p>
      )}
      {!isFreeDomainRating && (
        <p className="profile-empty">
          Paid Site Explorer requests use API units. Results are cached for 24
          hours. Domain Rating data by Ahrefs ·{" "}
          <a
            href={
              metrics?.domain_rating_license_url ??
              domainRatingLicenseUrl ??
              "https://ahrefs.com"
            }
            rel="noreferrer"
            target="_blank"
          >
            View license
          </a>
          .
        </p>
      )}
    </section>
  );
}

function VerdictCard({
  evidence,
  kind,
  onReviewSignals,
  reason,
  title,
}: {
  evidence: VerdictEvidence[];
  kind: "neutral" | "caution";
  onReviewSignals?: () => void;
  reason: string;
  title: string;
}) {
  return (
    <section
      aria-label="Prospect assessment"
      className={`profile-verdict is-${kind}`}
    >
      <div className="profile-verdict-copy">
        <div className="profile-verdict-title">
          {kind === "caution" && <AlertCircle aria-hidden="true" size={17} />}
          <h2>{title}</h2>
        </div>
        <p>{reason}</p>
        {evidence.length ? (
          <ul aria-label="Signals used for this assessment">
            {evidence.map((item) => (
              <li key={item.label}>
                {item.label} <span>{item.pageCount} pages</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-verdict-empty">
            No page-level classification evidence is available yet.
          </p>
        )}
      </div>
      {onReviewSignals && (
        <button
          className="profile-verdict-link"
          onClick={onReviewSignals}
          type="button"
        >
          Review signals
          <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}

function SectionTabs({
  activeSection,
  domain,
  isPlausible,
  onExclude,
  onKeepAsLead,
  onRecrawl,
  recrawlPending,
  statusPending,
  status,
  showCompactHeader,
  websiteUrl,
}: {
  activeSection: string;
  domain: string;
  isPlausible: boolean;
  onExclude: () => void;
  onKeepAsLead: () => void;
  onRecrawl: () => void;
  recrawlPending: boolean;
  statusPending: boolean;
  status: WebsiteStatus;
  showCompactHeader: boolean;
  websiteUrl: string;
}) {
  return (
    <div className="profile-sticky-nav">
      {showCompactHeader && (
        <div className="profile-compact-header">
          <strong title={domain}>{domain}</strong>
          <div>
            <a
              aria-label={`Visit ${domain}`}
              href={websiteUrl}
              rel="noreferrer"
              target="_blank"
              title={`Visit ${domain}`}
            >
              <ExternalLink aria-hidden="true" size={15} />
              <span>Visit</span>
            </a>
            {isPlausible ? (
              <button
                className="is-primary"
                aria-label={`Re-index ${domain}`}
                disabled={recrawlPending}
                onClick={onRecrawl}
                title={`Re-index ${domain}`}
                type="button"
              >
                <RotateCw aria-hidden="true" size={15} />
                <span>Re-index</span>
              </button>
            ) : (
              <>
                <button
                  className="is-secondary"
                  disabled={statusPending || status === "checked"}
                  onClick={onExclude}
                  title="Mark as checked so it is not treated as a new lead"
                  type="button"
                >
                  Exclude
                </button>
                <button
                  className="is-primary"
                  disabled={statusPending || status === "lead"}
                  onClick={onKeepAsLead}
                  type="button"
                >
                  Keep as lead
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <nav aria-label="Website profile sections" className="profile-tabs">
        {WEBSITE_PROFILE_SECTIONS.map(([id, label]) => (
          <a
            aria-current={activeSection === id ? "location" : undefined}
            className={activeSection === id ? "is-active" : ""}
            href={`#${id}`}
            key={id}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function DetailsRail({
  addedAt,
  addedBy,
  canonicalUrl,
  crawlId,
  language,
  lastCrawled,
  provider,
  source,
  type,
  websiteId,
}: {
  addedAt: string;
  addedBy: string | null;
  canonicalUrl: string;
  crawlId: string | null;
  language: string | null;
  lastCrawled: string | null;
  provider: string | null;
  source: string;
  type: string | null;
  websiteId: string;
}) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  return (
    <aside aria-label="Website details" className="profile-details-rail">
      <section className="profile-card profile-details-card">
        <h2>Details</h2>
        <dl>
          <DetailItem label="Language">
            {language ? fullLanguageName(language) : "Not reported"}
          </DetailItem>
          <DetailItem label="Type">
            {type ? formatSiteType(type) : "Not classified"}
          </DetailItem>
          <DetailItem label="Discovery source/provider">
            {formatDiscoverySource(source, provider)}
          </DetailItem>
          <DetailItem label="Added">
            <AbsoluteTime value={addedAt} showRelativeOnHover />
          </DetailItem>
          <DetailItem label="Added by">
            {addedBy ?? "Not recorded"}
          </DetailItem>
          <DetailItem label="Last indexed">
            {lastCrawled ? (
              <RelativeTime value={lastCrawled} />
            ) : (
              "Not indexed"
            )}
          </DetailItem>
        </dl>
        <details
          className="profile-technical-ids"
          onToggle={(event) => setTechnicalOpen(event.currentTarget.open)}
        >
          <summary
            aria-controls="website-technical-ids"
            aria-expanded={technicalOpen}
          >
            Technical IDs
            <ChevronDown aria-hidden="true" size={15} />
          </summary>
          <dl id="website-technical-ids">
            <DetailItem label="Website ID">
              <CopyableValue label="Website ID" value={websiteId} />
            </DetailItem>
            <DetailItem label="Index record ID">
              {crawlId ? (
                <CopyableValue label="Index record ID" value={crawlId} />
              ) : (
                "Not available"
              )}
            </DetailItem>
            <DetailItem label="Canonical URL">
              <CopyableValue label="Canonical URL" value={canonicalUrl} />
            </DetailItem>
          </dl>
        </details>
      </section>
    </aside>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="profile-detail-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function HypeStatRow({
  error,
  isPending,
  onRetry,
  profile,
}: {
  error?: string;
  isPending: boolean;
  onRetry: () => void;
  profile: WebsiteDetailResponse["hypestat_profile"];
}) {
  const checkedAt = profile?.checked_at ?? profile?.fetched_at;
  if (profile?.payload) {
    return (
      <>
        {error && (
          <div className="profile-hypestat-row">
            <span className="profile-status-indicator is-failed" />
            <strong>HypeStat</strong>
            <span title={error}>Refresh failed: {error}</span>
            <button
              className="profile-text-button"
              disabled={isPending}
              onClick={onRetry}
              type="button"
            >
              {isPending ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
        <div className="profile-hypestat-row profile-hypestat-summary">
          <span className="profile-status-indicator is-succeeded" />
          <strong>HypeStat estimates</strong>
          <span>Profile available</span>
          {checkedAt ? (
            <RelativeTime prefix="Checked" value={checkedAt} />
          ) : (
            <span className="profile-muted">Date unavailable</span>
          )}
          <button
            className="profile-text-button"
            disabled={isPending}
            onClick={onRetry}
            type="button"
          >
            {isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </>
    );
  }

  const hasFailed = profile?.status === "failed" || Boolean(error);
  const failureMessage = profile?.error ?? error ?? "data unavailable";
  const detail = hasFailed
    ? `Unavailable (${isCrawlerServiceError(failureMessage) ? "indexing service offline" : failureMessage})`
    : profile?.status === "queued" || profile?.status === "pending"
      ? "Lookup in progress"
      : profile?.status === "removed"
        ? "Profile removed"
        : profile?.status === "invalid_domain"
          ? "Invalid domain"
          : "Not available";

  return (
    <div className="profile-hypestat-row">
      <span className={`profile-status-indicator is-${hasFailed ? "failed" : "neutral"}`} />
      <strong>HypeStat</strong>
      <span>{detail}</span>
      {checkedAt ? (
        <RelativeTime prefix="Checked" value={checkedAt} />
      ) : (
        <span className="profile-muted">Not checked</span>
      )}
      <button
        className="profile-text-button"
        disabled={isPending}
        onClick={onRetry}
        type="button"
      >
        {isPending ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

function HypeStatDetails({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const contentId = "website-hypestat-profile";
  return (
    <details
      className="profile-hypestat-details profile-seo-provider-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-controls={contentId} aria-expanded={open}>
        <span className="profile-hypestat-title">Detailed provider report</span>
        <span className="profile-hypestat-available">HypeStat</span>
        <ChevronDown aria-hidden="true" size={16} />
      </summary>
      <div className="profile-hypestat-content" id={contentId}>
        <WebsiteHypeStatProfileView payload={payload} />
      </div>
    </details>
  );
}

function ContactsSection({
  emails,
  links,
  pageCount,
  phones,
}: {
  emails: string[];
  links: NormalizedLink[];
  pageCount: number;
  phones: string[];
}) {
  const [hideLowPriorityLinks, setHideLowPriorityLinks] = useState(true);
  const [activeCategory, setActiveCategory] = useState<LinkCategory>("all");
  const filteredLinks = links.filter(
    (link) =>
      (!hideLowPriorityLinks || !isLowPriorityLink(link)) &&
      (activeCategory === "all" || link.category === activeCategory),
  );
  const internalLinks = filteredLinks.filter((link) => link.isInternal);
  const externalLinks = filteredLinks.filter((link) => !link.isInternal);

  return (
    <section className="profile-card" id="contacts">
      <div className="profile-section-heading profile-contacts-heading">
        <div>
          <h2>Contacts & links</h2>
          <span>{links.length} links</span>
        </div>
        <label className="profile-link-filter">
          <input
            checked={hideLowPriorityLinks}
            onChange={(event) =>
              setHideLowPriorityLinks(event.target.checked)
            }
            type="checkbox"
          />
          <span>Hide tracking/login/policy links</span>
        </label>
      </div>

      {emails.length || phones.length ? (
        <div className="profile-contact-methods">
          {emails.length > 0 && (
            <ContactMethod icon={<Mail aria-hidden="true" size={15} />} label="Emails" values={emails} />
          )}
          {phones.length > 0 && (
            <ContactMethod icon={<Phone aria-hidden="true" size={15} />} label="Phone numbers" values={phones} />
          )}
        </div>
      ) : (
        <p className="profile-empty profile-contact-empty">
          No emails or phone numbers found on {pageCount} indexed{" "}
          {pageCount === 1 ? "page" : "pages"}. Try indexing /contact.
        </p>
      )}

      <div
        aria-label="Filter links"
        className="profile-link-segments"
        role="group"
      >
        {[
          ["all", "All"],
          ["social", "Social"],
          ["help", "Help & support"],
          ["other", "Other"],
        ].map(([value, label]) => (
          <button
            aria-pressed={activeCategory === value}
            className={activeCategory === value ? "is-active" : ""}
            key={value}
            onClick={() => setActiveCategory(value as LinkCategory)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {links.length === 0 ? (
        <p className="profile-empty">
          No links were found on {pageCount} indexed{" "}
          {pageCount === 1 ? "page" : "pages"}.
        </p>
      ) : internalLinks.length || externalLinks.length ? (
        <div className="profile-link-groups">
          {internalLinks.length > 0 && (
            <LinkList
              heading="Internal links"
              links={internalLinks}
            />
          )}
          {externalLinks.length > 0 && (
            <LinkList
              heading="External links"
              links={externalLinks}
            />
          )}
        </div>
      ) : (
        <p className="profile-empty">
          No links match this filter. Try another category or show hidden links.
        </p>
      )}
    </section>
  );
}

function ContactMethod({
  icon,
  label,
  values,
}: {
  icon: ReactNode;
  label: string;
  values: string[];
}) {
  return (
    <div className="profile-contact-method">
      <span>{icon}</span>
      <strong>{label}</strong>
      <ul>
        {values.map((value) => (
          <li key={value}>
            <a href={`${label === "Emails" ? "mailto" : "tel"}:${value}`}>
              {value}
            </a>
            <CopyButton label={label} value={value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkList({
  heading,
  links,
}: {
  heading: string;
  links: NormalizedLink[];
}) {
  const [showAll, setShowAll] = useState(false);
  const shownLinks = showAll ? links : links.slice(0, 6);

  return (
    <div className="profile-link-group">
      <h3>
        {heading}
        <span>{links.length}</span>
      </h3>
      <ul>
        {shownLinks.map((link) => (
          <li key={link.key}>
            <a
              href={link.url}
              rel="noreferrer"
              target="_blank"
              title={link.url}
            >
              <strong>{link.label}</strong>
              <span className="profile-link-url">{link.displayUrl}</span>
            </a>
            <CopyButton label={`URL for ${link.label}`} value={link.url} />
          </li>
        ))}
      </ul>
      {links.length > 6 && (
        <button
          aria-expanded={showAll}
          className="profile-show-all"
          onClick={() => setShowAll((current) => !current)}
          type="button"
        >
          {showAll ? "Show fewer" : `Show all (${links.length})`}
        </button>
      )}
    </div>
  );
}

function ExtractedPage({
  content,
  language,
  title,
  url,
}: {
  content: string;
  language: string | null;
  title: string;
  url?: string | null;
}) {
  const [fullTextOpen, setFullTextOpen] = useState(false);
  const normalizedContent = content.trim();
  const snippet = normalizedContent.replace(/\s+/g, " ");
  const wordCount = normalizedContent
    ? normalizedContent.split(/\s+/).length
    : 0;
  if (!wordCount) {
    return (
      <p className="profile-empty-page">
        {title} · 0 words · No text extracted
      </p>
    );
  }

  return (
    <article className="profile-content-row">
      <div className="profile-content-heading">
        <div>
          <h3>{title}</h3>
          {url && (
            <a href={url} rel="noreferrer" target="_blank" title={url}>
              {url}
            </a>
          )}
        </div>
        <div className="profile-content-meta">
          <span>{wordCount.toLocaleString()} words</span>
          <span className="profile-language-badge">
            {language ? fullLanguageName(language) : "Unknown language"}
          </span>
        </div>
      </div>
      <p className="profile-content-snippet">{snippet}</p>
      <details
        className="profile-read-full"
        onToggle={(event) => setFullTextOpen(event.currentTarget.open)}
      >
        <summary
          aria-controls={`full-content-${safeId(url ?? title)}`}
          aria-expanded={fullTextOpen}
        >
          Read full text
        </summary>
        <pre id={`full-content-${safeId(url ?? title)}`}>{normalizedContent}</pre>
      </details>
    </article>
  );
}

function SignalsAccordion({ page }: { page: CrawlPageClassification }) {
  const [open, setOpen] = useState(false);
  const populated = getPopulatedSignals(page.classification_signals);
  const statusTone =
    page.error
      ? "is-failed"
      : page.status_code != null && page.status_code > 0
      ? page.status_code >= 400
        ? "is-failed"
        : page.status_code >= 300
          ? "is-pending"
          : "is-succeeded"
      : "";
  const pageType =
    page.classification_signals?.og_type ??
    inferPageType(getUrlPath(page.url), page.classification_signals?.page_title);
  const contentId = `signal-${safeId(page.url)}`;

  return (
    <details
      className="profile-signal-row"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-controls={contentId} aria-expanded={open}>
        <span className="profile-signal-path" title={page.url}>
          {getUrlPath(page.url)}
        </span>
        {(page.status_code != null && page.status_code > 0 || page.error) && (
          <span
            className={`profile-page-status ${statusTone}`}
            title={page.error ?? "HTTP response status"}
          >
            {page.status_code != null && page.status_code > 0
              ? `HTTP ${page.status_code}`
              : "No response"}
          </span>
        )}
        <span className="profile-signal-count">
          {populated.length} populated
        </span>
        <span className="profile-signal-type">
          {formatSiteType(pageType)}
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </summary>
      <div className="profile-signal-content" id={contentId}>
        {page.error && (
          <div className="profile-page-diagnostic">
            <strong>Page issue</strong>
            <p>{page.error}</p>
          </div>
        )}
        {populated.length ? (
          <dl>
            {populated.map((signal) => (
              <div key={signal.label}>
                <dt>{signal.label}</dt>
                <dd>{signal.values.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="profile-empty">No populated signals on this page.</p>
        )}
      </div>
    </details>
  );
}

function CrawlActivity({
  crawlStatus,
  jobs,
}: {
  crawlStatus: string;
  jobs: WebsiteCrawlJobHistory[];
}) {
  const [open, setOpen] = useState(false);
  const latestJob = jobs[0];
  const summary = latestJob
    ? `Indexing jobs · ${formatStatus(latestJob.status)} · ${jobs.length} ${
        jobs.length === 1 ? "job" : "jobs"
      } recorded`
    : jobs.length
      ? `Indexing jobs · ${jobs.length} recorded`
      : "No indexing jobs recorded";
  const contentId = "website-crawl-activity";
  return (
    <details
      className="profile-activity-disclosure"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-controls={contentId} aria-expanded={open}>
        <span
          className={`profile-status-indicator is-${getStatusTone(latestJob?.status ?? crawlStatus)}`}
        />
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </summary>
      <div className="profile-activity-details" id={contentId}>
        {jobs.length ? (
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                <span
                  className={`profile-status-indicator is-${getStatusTone(job.status)}`}
                />
                <strong>{formatStatus(job.status)}</strong>
                <span>{job.attempts} attempts</span>
                <AbsoluteTime value={job.created_at} />
                {job.error && <p>{job.error}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">
            Indexing activity will appear here after the first indexing job.
          </p>
        )}
      </div>
    </details>
  );
}

function SectionHeading({
  count,
  title,
}: {
  count?: number;
  title: string;
}) {
  return (
    <div className="profile-section-heading">
      <h2>{title}</h2>
      {count !== undefined && <span>{count}</span>}
    </div>
  );
}

function CopyableValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="profile-copyable-value" title={value}>
      <span>{value}</span>
      <CopyButton label={label} value={value} />
    </span>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <span className="profile-copy-action">
      <button
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="profile-copy-button"
        onClick={() => void copyValue()}
        title={copied ? "Copied" : `Copy ${label}`}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" size={14} />
        ) : (
          <Copy aria-hidden="true" size={14} />
        )}
      </button>
      {copyError && (
        <span className="profile-copy-error" role="status">
          Copy unavailable
        </span>
      )}
    </span>
  );
}

function AbsoluteTime({
  showRelativeOnHover = false,
  value,
}: {
  showRelativeOnHover?: boolean;
  value: string;
}) {
  const date = new Date(value);
  const timestamp = date.getTime();
  const [relative, setRelative] = useState<string | null>(null);
  useEffect(() => {
    if (!showRelativeOnHover || !Number.isFinite(timestamp)) return;
    const timer = window.setTimeout(
      () => setRelative(formatRelativeTime(timestamp, Date.now())),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [showRelativeOnHover, timestamp]);
  if (!Number.isFinite(timestamp)) return <time>Unknown</time>;
  return (
    <time
      dateTime={date.toISOString()}
      title={showRelativeOnHover ? relative ?? undefined : undefined}
    >
      {formatAbsoluteDate(value)}
    </time>
  );
}

function RelativeTime({
  prefix,
  value,
}: {
  prefix?: string;
  value: string;
}) {
  const date = new Date(value);
  const timestamp = date.getTime();
  const [relative, setRelative] = useState<string | null>(null);
  useEffect(() => {
    if (!Number.isFinite(timestamp)) return;
    const timer = window.setTimeout(
      () => setRelative(formatRelativeTime(timestamp, Date.now())),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [timestamp]);
  if (!Number.isFinite(timestamp)) return <time>Unknown</time>;
  return (
    <time dateTime={date.toISOString()} title={formatAbsoluteDate(value)}>
      {prefix ? `${prefix} ` : ""}
      {relative ?? formatAbsoluteDate(value)}
    </time>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="profile-inline-error" role="alert">
      <AlertCircle aria-hidden="true" size={16} />
      <p>{message}</p>
    </div>
  );
}

function WebsiteProfileSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading website profile"
      className="company-detail-page website-detail-page profile-skeleton"
      role="status"
    >
      <span className="profile-skeleton-line" />
      <span className="profile-skeleton-hero" />
      <div>
        <span className="profile-skeleton-card" />
        <span className="profile-skeleton-card" />
      </div>
    </div>
  );
}

function DetailState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="company-detail-page website-detail-page">
      <Link className="profile-back-link" href="/websites">
        <ArrowLeft aria-hidden="true" size={15} />
        Websites
      </Link>
      <section
        className="profile-card profile-detail-state"
        role={message ? "alert" : "status"}
      >
        <strong>{title}</strong>
        {message && <span>{message}</span>}
        {onRetry && (
          <button
            className="profile-button profile-button-secondary"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        )}
      </section>
    </div>
  );
}

type LinkCategory = "all" | "social" | "help" | "other";

type NormalizedLink = {
  key: string;
  url: string;
  label: string;
  displayUrl: string;
  category: Exclude<LinkCategory, "all">;
  isInternal: boolean;
};

type VerdictEvidence = {
  label: string;
  pageCount: number;
};

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "snapchat.com",
  "twitch.tv",
  "discord.com",
  "discord.gg",
  "whatsapp.com",
  "telegram.org",
];

const TRACKING_PARAMETERS = [
  "fbclid",
  "gclid",
  "dclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref_src",
  "ref_url",
  "_ga",
];

function getSeoOverviewMetrics(
  payload: Record<string, unknown> | null | undefined,
  website: WebsiteDetailResponse["website"],
): SeoOverviewMetrics {
  const root = asRecord(payload?.entry) ?? payload;
  const data = asRecord(root?.data) ?? {};
  const traffic = asRecord(data.traffic) ?? {};
  const trafficChanges = asRecord(traffic.change_vs_previous_month) ?? {};
  const semrush = asRecord(data.semrush) ?? {};
  const backlinks = asRecord(data.backlinks) ?? {};
  const rank = asRecord(data.rank) ?? {};
  const sources = asRecord(traffic.sources) ?? {};
  const trafficSources = Object.entries(sources)
    .map(([label, value]) => ({
      label: humanizeOverviewLabel(label),
      value: finiteNumber(value),
    }))
    .filter(
      (source): source is { label: string; value: number } =>
        source.value !== null,
    )
    .sort((left, right) => right.value - left.value);
  const monthlyChanges = [
    { label: "Visits", value: finiteNumber(trafficChanges.visits) },
    { label: "Users", value: finiteNumber(trafficChanges.users) },
    {
      label: "Visit duration",
      value: finiteNumber(trafficChanges.visit_duration),
    },
    {
      label: "Pages per visit",
      value: finiteNumber(trafficChanges.pages_per_visit),
    },
    {
      label: "Bounce rate",
      value: finiteNumber(trafficChanges.bounce_rate),
    },
  ].filter(
    (change): change is { label: string; value: number } =>
      change.value !== null,
  );
  const payloadCountries = asRecords(backlinks.by_country)
    .map((country) => ({
      country:
        typeof country.country === "string" ? country.country.trim() : "",
      domains: finiteNumber(country.domains),
    }))
    .filter(
      (country): country is { country: string; domains: number } =>
        country.country.length > 0 && country.domains !== null,
    );
  const referringDomainsByCountry =
    payloadCountries.length > 0
      ? payloadCountries
      : website.hypestat_referring_domains_by_country;

  return {
    organicKeywords: finiteNumber(semrush.organic_keywords),
    organicTraffic: finiteNumber(semrush.organic_traffic),
    organicTrafficValue: finiteNumber(semrush.organic_cost_usd),
    monthlyVisits:
      finiteNumber(traffic.visits_monthly) ?? website.hypestat_monthly_visits,
    globalRank: finiteNumber(rank.hypestat),
    backlinks: finiteNumber(backlinks.total),
    referringDomains:
      finiteNumber(backlinks.referring_domains) ??
      website.hypestat_referring_domains,
    followedBacklinks: finiteNumber(backlinks.follow),
    nofollowBacklinks: finiteNumber(backlinks.nofollow),
    trafficSources,
    monthlyChanges,
    referringDomainsByCountry: [...referringDomainsByCountry].sort(
      (left, right) => right.domains - left.domains,
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== null)
    : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function humanizeOverviewLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value: number | null): string {
  return value === null
    ? "Not reported"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatCompactMetric(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
}

function formatCurrencyMetric(value: number | null): string {
  return value === null
    ? "Not reported"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}

function formatPercentMetric(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatChangeMetric(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value)}%`;
}

function getCrawlPages(crawl: WebsiteDetailResponse["crawl"]) {
  if (!crawl) return [];
  return [
    { title: "Homepage", url: crawl.home_page_url, content: crawl.home_content },
    { title: "About", url: crawl.about_page_url, content: crawl.about_content },
    { title: "Blog", url: crawl.blog_page_url, content: crawl.blog_content },
    { title: "Services", url: crawl.service_page_url, content: crawl.service_content },
    { title: "Contact", url: crawl.contact_page_url, content: crawl.contact_content },
    { title: "Goals", url: crawl.goals_page_url, content: crawl.goals_content },
  ].filter((page) => page.url || page.content);
}

function getVerdictEvidence(
  pages: CrawlPageClassification[],
): VerdictEvidence[] {
  const pageTitleCount = pages.filter(
    (page) => page.classification_signals?.page_title?.trim(),
  ).length;
  const passwordCount = pages.filter(
    (page) => (page.classification_signals?.password_input_count ?? 0) > 0,
  ).length;
  const urlPatternCount = pages.filter(
    (page) =>
      (page.classification_signals?.url_path_patterns.length ?? 0) > 0 ||
      (page.classification_signals?.url_classification_terms.length ?? 0) > 0,
  ).length;
  return [
    { label: "Page title", pageCount: pageTitleCount },
    { label: "Password inputs", pageCount: passwordCount },
    { label: "URL patterns", pageCount: urlPatternCount },
  ].filter((item) => item.pageCount > 0);
}

function assessProspect(
  website: WebsiteDetailResponse["website"],
  largePlatform: boolean,
) {
  if (largePlatform) {
    return {
      plausible: false,
      title: "Not a prospect: large online platform",
      reason:
        "This domain is a platform rather than an individual business to add to your prospect list.",
    };
  }
  const pageType = website.page_type ?? website.category;
  if (pageType === "business_listing") {
    return {
      plausible: false,
      title: "Not a prospect: business directory",
      reason:
        "This site appears to list businesses rather than represent one business.",
    };
  }
  if (pageType === "social_media") {
    return {
      plausible: false,
      title: "Not a prospect: social platform",
      reason:
        "This site is a social platform, not the business represented by a lead.",
    };
  }
  if (["article", "blog", "news", "documentation"].includes(pageType ?? "")) {
    return {
      plausible: false,
      title: "Not a prospect: content or documentation",
      reason:
        "This page appears to be editorial content or documentation rather than a business website.",
    };
  }
  return {
    plausible: true,
    title: "Potential business prospect",
    reason:
      "No large-platform or directory signal was detected. Review the saved evidence before reaching out.",
  };
}

function getPopulatedSignals(
  signals: CrawlPageClassification["classification_signals"],
): { label: string; values: string[] }[] {
  if (!signals) return [];
  const rows = [
    { label: "Page title", values: textValues(signals.page_title) },
    { label: "Meta description", values: textValues(signals.meta_description) },
    { label: "Open Graph title", values: textValues(signals.og_title) },
    {
      label: "Open Graph description",
      values: textValues(signals.og_description),
    },
    { label: "Open Graph type", values: textValues(signals.og_type) },
    { label: "Generator", values: textValues(signals.generator) },
    {
      label: "JSON-LD scripts",
      values: signals.json_ld_scripts.map((_, index) => `Script ${index + 1}`),
    },
    { label: "JSON-LD schema types", values: signals.json_ld_schema_types },
    {
      label: "Microdata schema types",
      values: signals.microdata_schema_types,
    },
    { label: "Headings", values: signals.heading_texts },
    { label: "First paragraph", values: textValues(signals.first_paragraph_text) },
    {
      label: "Meta classification terms",
      values: signals.meta_classification_terms,
    },
    {
      label: "URL classification terms",
      values: signals.url_classification_terms,
    },
    {
      label: "Body classification terms",
      values: signals.body_classification_terms,
    },
    {
      label: "Article elements",
      values: signals.article_count > 0 ? [String(signals.article_count)] : [],
    },
    {
      label: "Password inputs",
      values:
        signals.password_input_count > 0
          ? [String(signals.password_input_count)]
          : [],
    },
    {
      label: "Shopping elements",
      values: Object.entries(signals.shopping_elements)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => `${formatSiteType(name)}: ${count}`),
    },
    { label: "Navigation links", values: signals.nav_link_texts },
    { label: "Footer links", values: signals.footer_link_texts },
    { label: "Header links", values: signals.header_link_texts },
    { label: "Call-to-action text", values: signals.cta_texts },
    { label: "URL path patterns", values: signals.url_path_patterns },
  ];
  return rows.filter((row) => row.values.length > 0);
}

function textValues(value: string | null): string[] {
  return value?.trim() ? [value.trim()] : [];
}

function normalizeUrl(value: string, baseUrl: string): string | null {
  let candidate = value.trim();
  if (!candidate) return null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let url: URL;
    try {
      url = new URL(candidate, baseUrl);
    } catch {
      try {
        url = new URL(`https://${candidate}`);
      } catch {
        return null;
      }
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const redirectHost =
      url.hostname === "l.facebook.com" ||
      url.hostname === "lm.facebook.com" ||
      url.hostname === "l.instagram.com" ||
      url.hostname === "t.co" ||
      url.hostname === "out.reddit.com";
    const redirectPath =
      /\/(?:l\.php|url|redirect|out)(?:\/|$)/i.test(url.pathname) ||
      ((url.hostname === "google.com" ||
        url.hostname === "www.google.com") &&
        url.pathname === "/url");
    const destination =
      redirectHost || redirectPath
        ? [
            "u",
            "url",
            "q",
            "target",
            "dest",
            "destination",
            "redirect",
            "redirect_url",
            "continue",
          ]
            .map((key) => url.searchParams.get(key))
            .find((parameter) => parameter && parameter !== candidate)
        : null;
    if (destination) {
      candidate = destination;
      continue;
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        TRACKING_PARAMETERS.includes(lower) ||
        lower === "tracking"
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  }
  return null;
}

function groupSocialLinks(
  values: string[],
  websiteUrl: string,
  domain: string,
): NormalizedLink[] {
  const seen = new Set<string>();
  const domainHost = domain.toLowerCase().replace(/^www\./, "");
  const links: NormalizedLink[] = [];
  for (const value of values) {
    const normalized = normalizeUrl(value, websiteUrl);
    if (!normalized) continue;
    const url = new URL(normalized);
    const key = `${url.hostname}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const isSocial = SOCIAL_HOSTS.some(
      (socialHost) => host === socialHost || host.endsWith(`.${socialHost}`),
    );
    const category: NormalizedLink["category"] =
      /(?:^|[/.])(help|support|contact|faq)(?:[/.]|$)/i.test(
        `${host}${path}`,
      )
        ? "help"
        : isSocial
          ? "social"
          : "other";
    const isInternal =
      host === domainHost || host.endsWith(`.${domainHost}`);
    const pathname = url.pathname === "/" ? "" : url.pathname;
    links.push({
      key,
      url: normalized,
      label: linkLabel(url),
      displayUrl: `${host}${pathname}${url.search}`,
      category,
      isInternal,
    });
  }
  return links;
}

function linkLabel(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (!lastSegment) return url.hostname;
  let decoded = lastSegment;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    decoded = lastSegment;
  }
  const slug = decoded.replace(/[-_]+/g, " ").trim();
  if (/^(?:ad|ads|advertising)$/i.test(slug)) return "Ad campaigns";
  if (/^(?:jobs|job openings|careers)$/i.test(slug)) return "Careers";
  return slug.replace(/\b\w/g, (letter) => letter.toUpperCase()) || url.hostname;
}

function isLowPriorityLink(link: NormalizedLink): boolean {
  const url = new URL(link.url);
  return /(?:^|[/.])(?:login|log-in|signin|sign-in|auth|account|track|tracking|analytics|click|redirect|outbound)(?:[/.]|$)|(?:privacy|terms|legal|policy|policies|cookie|gdpr|disclaimer)/i.test(
    `${url.hostname}${url.pathname}`,
  );
}

function isLargePlatform(domain: string, pageType: string | null) {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  return (
    pageType === "social_media" ||
    [
      ...SOCIAL_HOSTS,
      "google.com",
      "amazon.com",
      "wikipedia.org",
      "medium.com",
      "github.com",
    ].some(
      (host) =>
        normalizedDomain === host || normalizedDomain.endsWith(`.${host}`),
    )
  );
}

function inferPageType(path: string, title: string | null | undefined): string {
  const pathAndTitle = `${path} ${title ?? ""}`.toLowerCase();
  if (/about|company|who-we-are/.test(pathAndTitle)) return "About";
  if (/contact|reach-us/.test(pathAndTitle)) return "Contact";
  if (/blog|article|post/.test(pathAndTitle)) return "Blog";
  if (/service|solution|offering/.test(pathAndTitle)) return "Services";
  if (/help|support|faq/.test(pathAndTitle)) return "Help";
  if (/product|shop|store|pricing/.test(pathAndTitle)) return "Product";
  return path === "/" ? "Homepage" : "Page";
}

function getUrlPath(value: string): string {
  try {
    return new URL(value).pathname || "/";
  } catch {
    return value;
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isWebsiteStatus(value: string): value is WebsiteStatus {
  return value === "new" || value === "lead" || value === "checked";
}

function formatDiscoverySource(
  source: string,
  provider: string | null,
): string {
  const values = [source, provider]
    .filter((value): value is string => Boolean(value))
    .map(formatSiteType);
  return [...new Set(values)].join(" · ") || "Not reported";
}

function getStatusTone(
  status: string,
): "succeeded" | "failed" | "pending" {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  return "pending";
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

function fullLanguageName(value: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(value) ?? value;
  } catch {
    return value;
  }
}

function isCrawlerServiceError(error: string | undefined): boolean {
  return Boolean(
    error &&
      /crawler service.{0,30}(?:offline|unavailable)|service unavailable|connection refused/i.test(
        error,
      ),
  );
}

function formatAbsoluteDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : value;
}

function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = (timestamp - now) / 1000;
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(seconds) < 60
      ? [seconds / 60, "minute"]
      : Math.abs(seconds) < 60 * 60
        ? [seconds / (60 * 60), "hour"]
        : Math.abs(seconds) < 60 * 60 * 24
          ? [seconds / (60 * 60 * 24), "day"]
          : Math.abs(seconds) < 60 * 60 * 24 * 30
            ? [seconds / (60 * 60 * 24 * 7), "week"]
            : Math.abs(seconds) < 60 * 60 * 24 * 365
              ? [seconds / (60 * 60 * 24 * 30), "month"]
              : [seconds / (60 * 60 * 24 * 365), "year"];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(amount),
    unit,
  );
}
