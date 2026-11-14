"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getWebsiteDetail } from "@/lib/api";
import type {
  CrawlPageClassification,
  WebsiteDetailResponse,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

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
    refetchInterval: (query) => {
      const status = query.state.data?.website.crawl_job_status;
      return status === "queued" || status === "running" ? 3000 : false;
    },
  });

  if (!validId) {
    return (
      <DetailState
        message="The website ID in this link is not valid."
        title="Website not found"
      />
    );
  }
  if (websiteQuery.isLoading) {
    return <DetailState title="Loading website details…" />;
  }
  if (websiteQuery.isError) {
    return (
      <DetailState
        message={websiteQuery.error.message}
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
  const { website, crawl, crawl_jobs: crawlJobs } = data;
  const crawlStatus =
    website.crawl_job_status ??
    (website.is_crawled ? "succeeded" : "not_queued");
  const crawlPages = [
    { title: "Homepage", url: crawl?.home_page_url, content: crawl?.home_content },
    { title: "About", url: crawl?.about_page_url, content: crawl?.about_content },
    { title: "Blog", url: crawl?.blog_page_url, content: crawl?.blog_content },
    {
      title: "Services",
      url: crawl?.service_page_url,
      content: crawl?.service_content,
    },
    {
      title: "Contact",
      url: crawl?.contact_page_url,
      content: crawl?.contact_content,
    },
    { title: "Goals", url: crawl?.goals_page_url, content: crawl?.goals_content },
  ].filter((page) => page.url || page.content);

  return (
    <div className="company-detail-page website-detail-page">
      <Link className="detail-back-link" href="/websites">
        <span aria-hidden="true">←</span> Back to websites
      </Link>

      <section className="company-hero">
        <div className="company-hero-main">
          <span className="company-hero-avatar" aria-hidden="true">
            {website.domain.slice(0, 1).toUpperCase()}
          </span>
          <div className="company-hero-copy">
            <p className="eyebrow">WEBSITE PROFILE</p>
            <div className="company-title-row">
              <h1>{website.domain}</h1>
              <span className="status-badge">{website.status}</span>
            </div>
            <div className="company-hero-meta">
              <span className={`status-badge website-crawl-${crawlStatus}`}>
                Crawl: {crawlStatus.replaceAll("_", " ")}
              </span>
              <span>{formatSiteType(website.site_type)}</span>
              {crawl?.site_type && (
                <span>Classification: {formatSiteType(crawl.site_type)}</span>
              )}
            </div>
          </div>
        </div>
        <a
          className="button button-secondary website-visit-link"
          href={website.website_url}
          rel="noreferrer"
          target="_blank"
        >
          Visit website <span aria-hidden="true">↗</span>
        </a>
      </section>

      <div className="company-detail-main">
        <section className="panel detail-section">
          <SectionHeading title="Website overview" />
          <dl className="website-detail-grid">
            <DetailField label="Canonical URL">
              <a href={website.website_url} rel="noreferrer" target="_blank">
                {website.website_url}
              </a>
            </DetailField>
            <DetailField label="Website status">{website.status}</DetailField>
            <DetailField label="Site type">
              {formatSiteType(website.site_type)}
            </DetailField>
            <DetailField label="Crawl category">
              {website.category ? formatSiteType(website.category) : "—"}
            </DetailField>
            <DetailField label="Website type">
              {website.page_type ? formatSiteType(website.page_type) : "Unclassified"}
            </DetailField>
            <DetailField label="Site topics">
              {website.site_topic.length
                ? website.site_topic.map(formatSiteType).join(", ")
                : "—"}
            </DetailField>
            <DetailField label="Language">{website.language || "—"}</DetailField>
            <DetailField label="Discovery source">
              {formatSiteType(website.discovery_source)}
            </DetailField>
            <DetailField label="Discovery provider">
              {website.discovery_provider
                ? formatSiteType(website.discovery_provider)
                : "—"}
            </DetailField>
            <DetailField label="Added">{formatDate(website.created_at)}</DetailField>
            <DetailField label="Last crawled">
              {crawl?.crawled_at ? formatDate(crawl.crawled_at) : "—"}
            </DetailField>
            <DetailField label="Crawl record ID">
              {website.crawl_id ?? "No crawl record"}
            </DetailField>
          </dl>
        </section>

        <section className="panel detail-section">
          <SectionHeading title="Crawl jobs" />
          {crawlJobs.length ? (
            <div className="website-job-list">
              {crawlJobs.map((job) => (
                <article className="website-job-card" key={job.id}>
                  <div className="website-job-heading">
                    <span className={`status-badge website-crawl-${job.status}`}>
                      {job.status}
                    </span>
                    <span>Attempts: {job.attempts}</span>
                    <time>{formatDate(job.created_at)}</time>
                  </div>
                  {job.started_at && (
                    <p>Started: {formatDate(job.started_at)}</p>
                  )}
                  {job.completed_at && (
                    <p>Completed: {formatDate(job.completed_at)}</p>
                  )}
                  {job.error && (
                    <p className="website-job-error">{job.error}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="detail-empty">No crawl job has been recorded.</p>
          )}
        </section>

        <section className="panel detail-section">
          <SectionHeading title="Extracted page content" />
          {!crawl ? (
            <p className="detail-empty">
              The crawler has not produced a crawl record for this website yet.
            </p>
          ) : crawlPages.length ? (
            <div className="crawl-pages website-crawl-pages">
              {crawlPages.map((page) => (
                <details className="crawl-page website-crawl-page" key={page.title}>
                  <summary>
                    <strong>{page.title}</strong>
                    {page.url && (
                      <a
                        href={page.url}
                        onClick={(event) => event.stopPropagation()}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {page.url}
                      </a>
                    )}
                  </summary>
                  <pre>{page.content || "No text content was extracted."}</pre>
                </details>
              ))}
            </div>
          ) : (
            <p className="detail-empty">
              A crawl record exists, but no page content was stored.
            </p>
          )}
        </section>

        <section className="panel detail-section">
          <SectionHeading title="Contact and social links" />
          <div className="website-link-columns">
            <LinkList
              label="Emails"
              links={(crawl?.emails ?? []).map((email) => ({
                label: email,
                href: `mailto:${email}`,
              }))}
            />
            <LinkList
              label="Social links"
              links={(crawl?.social_links ?? []).map((url) => ({
                label: url,
                href: url,
              }))}
            />
          </div>
        </section>

        <section className="panel detail-section">
          <SectionHeading title="Classification signals by page" />
          {!crawl ? (
            <p className="detail-empty">Signals will appear after the crawl.</p>
          ) : crawl.classification_signals.length ? (
            <div className="website-signal-list">
              {crawl.classification_signals.map((page, index) => (
                <SignalCard
                  key={`${page.url}-${index}`}
                  page={page}
                />
              ))}
            </div>
          ) : (
            <p className="detail-empty">
              No page-level classification signals were stored.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SignalCard({
  page,
}: {
  page: CrawlPageClassification;
}) {
  const signals = page.classification_signals;
  return (
    <article className="website-signal-card">
      <div className="website-signal-heading">
        <div>
          <h3>{signals?.page_title || page.url}</h3>
          <a href={page.url} rel="noreferrer" target="_blank">
            {page.url}
          </a>
        </div>
        <span className="status-badge">
          {page.rendering_mode || "render mode unknown"}
        </span>
      </div>
      {!signals ? (
        <p className="detail-empty">
          No classification signals were recorded for this page.
        </p>
      ) : (
        <>
          <dl className="website-signal-metadata">
            <DetailField label="Meta description">
              {signals.meta_description || "—"}
            </DetailField>
            <DetailField label="Open Graph title">
              {signals.og_title || "—"}
            </DetailField>
            <DetailField label="Open Graph description">
              {signals.og_description || "—"}
            </DetailField>
            <DetailField label="Open Graph type">
              {signals.og_type || "—"}
            </DetailField>
            <DetailField label="Generator">
              {signals.generator || "—"}
            </DetailField>
          </dl>
          <div className="website-signal-groups">
            <SignalList label="JSON-LD schema types" values={signals.json_ld_schema_types} />
            <SignalList label="Microdata schema types" values={signals.microdata_schema_types} />
            <SignalList label="URL path patterns" values={signals.url_path_patterns} />
            <SignalList label="Headings" values={signals.heading_texts} />
            <SignalList label="Navigation links" values={signals.nav_link_texts} />
            <SignalList label="Header links" values={signals.header_link_texts} />
            <SignalList label="Footer links" values={signals.footer_link_texts} />
            <SignalList label="Call-to-action text" values={signals.cta_texts} />
            <SignalList label="Meta classification terms" values={signals.meta_classification_terms} />
            <SignalList label="URL classification terms" values={signals.url_classification_terms} />
            <SignalList label="Body classification terms" values={signals.body_classification_terms} />
            <SignalList
              label="Shopping elements"
              values={Object.entries(signals.shopping_elements).map(
                ([name, count]) => `${formatSiteType(name)}: ${count}`,
              )}
            />
          </div>
          <dl className="website-signal-counts">
            <DetailField label="Article elements">{signals.article_count}</DetailField>
            <DetailField label="Password inputs">{signals.password_input_count}</DetailField>
            <DetailField label="First paragraph">
              {signals.first_paragraph_text || "—"}
            </DetailField>
          </dl>
          {signals.json_ld_scripts.length > 0 && (
            <details className="website-jsonld">
              <summary>Raw JSON-LD ({signals.json_ld_scripts.length})</summary>
              {signals.json_ld_scripts.map((script, index) => (
                <pre key={index}>{script}</pre>
              ))}
            </details>
          )}
        </>
      )}
    </article>
  );
}

function SignalList({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div>
      <strong>{label}</strong>
      <p>{values.length ? values.join(" · ") : "—"}</p>
    </div>
  );
}

function LinkList({
  label,
  links,
}: {
  label: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="website-link-list">
      <h3>{label}</h3>
      {links.length ? (
        <ul>
          {links.map(({ label: linkLabel, href }) => (
            <li key={href}>
              <a href={href} rel="noreferrer" target="_blank">
                {linkLabel}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="detail-empty">None recorded.</p>
      )}
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="website-detail-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="detail-section-heading">
      <div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function DetailState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="company-detail-page website-detail-page">
      <Link className="detail-back-link" href="/websites">
        <span aria-hidden="true">←</span> Back to websites
      </Link>
      <section
        className={`company-detail-state${message ? " detail-state-error" : ""}`}
        role={message ? "alert" : "status"}
      >
        <strong>{title}</strong>
        {message && <span>{message}</span>}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
