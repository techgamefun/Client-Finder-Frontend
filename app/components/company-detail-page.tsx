"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  crawlCompanyWebsite,
  crawlResearchSource,
  deleteCompany,
  getCompany,
  getCompanyWebsiteCrawl,
  getPageSpeedScan,
  updateCompany,
  updateLeadStatus,
} from "@/lib/api";
import type {
  Company,
  CompanyUpdateInput,
  PageSpeedAudit,
  WebsiteCrawlResponse,
} from "@/lib/api";

const leadStatuses = [
  "new",
  "needs_review",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
];

export function CompanyDetailPage({
  companyId: companyIdParam,
}: {
  companyId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [editingForm, setEditingForm] = useState<CompanyUpdateInput>({});
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const companyId =
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(companyIdParam)
      ? companyIdParam
      : null;
  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => {
      if (companyId === null) {
        throw new Error("A valid company ID is required to load this record.");
      }
      return getCompany(companyId);
    },
    enabled: companyId !== null,
  });
  const websiteCrawlQuery = useQuery({
    queryKey: ["company-website-crawl", companyId],
    queryFn: () => {
      if (companyId === null) {
        throw new Error("A valid company ID is required to load crawl status.");
      }
      return getCompanyWebsiteCrawl(companyId);
    },
    enabled: companyId !== null,
  });
  const websiteCrawlMutation = useMutation({
    mutationFn: () => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be crawled.");
      }
      return crawlCompanyWebsite(companyId);
    },
    onSuccess: async (crawl) => {
      queryClient.setQueryData(
        ["company-website-crawl", companyId],
        crawl,
      );
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
  const researchSourceMutation = useMutation({
    mutationFn: (sourceUrl: string) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before adding a source.");
      }
      return crawlResearchSource(companyId, { source_url: sourceUrl });
    },
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData(["company", updatedCompany.id], updatedCompany);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
        queryClient.invalidateQueries({
          queryKey: ["company-website-crawl", updatedCompany.id],
        }),
      ]);
    },
  });
  const scanQuery = useQuery({
    queryKey: ["pagespeed-scan", companyId, expandedScanId],
    queryFn: () => {
      if (expandedScanId === null || companyId === null) {
        throw new Error("Select a PageSpeed scan to view its report.");
      }
      return getPageSpeedScan(companyId, expandedScanId);
    },
    enabled: expandedScanId !== null && companyId !== null,
  });
  const updateMutation = useMutation({
    mutationFn: (input: CompanyUpdateInput) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be updated.");
      }
      return updateCompany(companyId, input);
    },
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData(["company", updatedCompany.id], updatedCompany);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
        queryClient.invalidateQueries({
          queryKey: ["company-website-crawl", updatedCompany.id],
        }),
      ]);
      setIsEditing(false);
    },
  });
  const statusMutation = useMutation({
    mutationFn: (leadStatus: string) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before its status can change.");
      }
      return updateLeadStatus(companyId, leadStatus);
    },
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData(["company", updatedCompany.id], updatedCompany);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be deleted.");
      }
      return deleteCompany(companyId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      router.push("/leads");
    },
  });

  if (companyId !== null && companyQuery.isLoading) {
    return (
      <section className="company-detail-state" aria-live="polite">
        <span className="detail-state-icon" aria-hidden="true">◷</span>
        <strong>Loading company record…</strong>
        <span>Gathering company information and related research.</span>
      </section>
    );
  }

  if (companyId === null) {
    return (
      <section className="company-detail-state">
        <span className="detail-state-icon detail-state-error" aria-hidden="true">!</span>
        <strong>Company not found.</strong>
        <span>This company link may be out of date or the record may have been removed.</span>
        <Link className="button button-secondary" href="/leads">
          Back to company records
        </Link>
      </section>
    );
  }

  if (companyQuery.isError) {
    return (
      <section className="company-detail-state" role="alert">
        <span className="detail-state-icon detail-state-error" aria-hidden="true">!</span>
        <strong>Could not load this company.</strong>
        <span>{companyQuery.error.message}</span>
        <button
          className="button button-secondary"
          onClick={() => void companyQuery.refetch()}
          type="button"
        >
          Try again
        </button>
        <Link className="text-link" href="/leads">Back to company records</Link>
      </section>
    );
  }

  const company = companyQuery.data;
  if (!company) return null;

  function startEditing(record: Company) {
    setEditingForm({
      name: record.name,
      website: record.website,
      domain: record.domain,
      industry: record.industry,
      city: record.city,
      state: record.state,
      software_need: record.software_need,
      lead_score: record.lead_score,
    });
    setIsEditing(true);
    setIsDeleteConfirmed(false);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.mutate({
      ...editingForm,
      name: editingForm.name?.trim(),
      website: cleanText(editingForm.website),
      domain: cleanText(editingForm.domain),
      industry: cleanText(editingForm.industry),
      city: cleanText(editingForm.city),
      state: cleanText(editingForm.state),
      software_need: cleanText(editingForm.software_need),
    });
  }

  function updateField<K extends keyof CompanyUpdateInput>(
    key: K,
    value: CompanyUpdateInput[K],
  ) {
    setEditingForm((current) => ({ ...current, [key]: value }));
  }

  const location = [company.city, company.state].filter(Boolean).join(", ");
  const expandedReport =
    expandedScanId !== null && scanQuery.data?.id === expandedScanId
      ? scanQuery.data.report
      : null;
  const audits = Object.entries(
    expandedReport?.lighthouseResult.audits ?? {},
  );

  return (
    <div className="company-detail-page">
      <Link className="detail-back-link" href="/leads">
        <span aria-hidden="true">←</span> Back to company records
      </Link>

      <section className="company-hero">
        <div className="company-hero-main">
          <span className="company-hero-avatar" aria-hidden="true">
            {company.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="company-hero-copy">
            <p className="eyebrow">COMPANY PROFILE · RECORD #{company.id}</p>
            <h1>{company.name}</h1>
            <div className="company-hero-meta">
              {company.industry && <span>{company.industry}</span>}
              {location && <span>{location}</span>}
              {company.domain && <span>{company.domain}</span>}
            </div>
          </div>
        </div>
        <div className="company-hero-actions">
          <label className="detail-status-control">
            <span className="sr-only">Lead status</span>
            <select
              aria-label={`Change lead status for ${company.name}`}
              className="detail-status-select"
              disabled={statusMutation.isPending}
              onChange={(event) => statusMutation.mutate(event.target.value)}
              value={company.lead_status}
            >
              {!leadStatuses.includes(company.lead_status) && (
                <option value={company.lead_status}>
                  {company.lead_status.replaceAll("_", " ")}
                </option>
              )}
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            onClick={() => startEditing(company)}
            type="button"
          >
            Edit company
          </button>
        </div>
      </section>

      {statusMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not update lead status: {statusMutation.error.message}
        </div>
      )}
      {updateMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not save company changes: {updateMutation.error.message}
        </div>
      )}
      {deleteMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not delete company: {deleteMutation.error.message}
        </div>
      )}
      {websiteCrawlMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not crawl {company.name}&apos;s website:{" "}
          {websiteCrawlMutation.error.message}
        </div>
      )}
      <section className="detail-metrics" aria-label="Company record summary">
        <article className="detail-metric-card">
          <span className="detail-metric-icon violet" aria-hidden="true">◈</span>
          <div><span>LEAD SCORE</span><strong>{company.lead_score ?? "—"}</strong></div>
        </article>
        <article className="detail-metric-card">
          <span className="detail-metric-icon green" aria-hidden="true">◎</span>
          <div><span>PUBLIC CONTACTS</span><strong>{company.contacts.length}</strong></div>
        </article>
        <article className="detail-metric-card">
          <span className="detail-metric-icon amber" aria-hidden="true">↗</span>
          <div><span>RESEARCH SOURCES</span><strong>{company.sources.length}</strong></div>
        </article>
        <article className="detail-metric-card">
          <span className="detail-metric-icon blue" aria-hidden="true">◷</span>
          <div><span>PAGE SPEED SCANS</span><strong>{company.pagespeed_scans.length}</strong></div>
        </article>
      </section>

      <div className="company-detail-layout">
        <main className="company-detail-main">
          <section className="panel detail-section">
            <div className="detail-section-heading">
              <span className="section-icon violet" aria-hidden="true">▤</span>
              <div><h2>Company overview</h2><p>Core profile and qualification details</p></div>
            </div>
            {isEditing ? (
              <form className="company-form detail-edit-form" onSubmit={handleSave}>
                <div className="form-row">
                  <label>
                    Company name <span>*</span>
                    <input
                      maxLength={200}
                      onChange={(event) => updateField("name", event.target.value)}
                      required
                      value={editingForm.name ?? ""}
                    />
                  </label>
                  <label>
                    Website
                    <input
                      onChange={(event) => updateField("website", event.target.value)}
                      placeholder="https://example.com"
                      type="url"
                      value={editingForm.website ?? ""}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Industry
                    <input
                      onChange={(event) => updateField("industry", event.target.value)}
                      value={editingForm.industry ?? ""}
                    />
                  </label>
                  <label>
                    Domain
                    <input
                      onChange={(event) => updateField("domain", event.target.value)}
                      value={editingForm.domain ?? ""}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    City
                    <input
                      onChange={(event) => updateField("city", event.target.value)}
                      value={editingForm.city ?? ""}
                    />
                  </label>
                  <label>
                    State / region
                    <input
                      onChange={(event) => updateField("state", event.target.value)}
                      value={editingForm.state ?? ""}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Software need
                    <textarea
                      onChange={(event) =>
                        updateField("software_need", event.target.value)
                      }
                      rows={4}
                      value={editingForm.software_need ?? ""}
                    />
                  </label>
                  <label>
                    Lead score
                    <input
                      min={0}
                      onChange={(event) =>
                        updateField(
                          "lead_score",
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      type="number"
                      value={editingForm.lead_score ?? ""}
                    />
                  </label>
                </div>
                <div className="detail-form-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-primary"
                    disabled={updateMutation.isPending}
                    type="submit"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="company-overview-grid">
                <DetailField label="Website">
                  {company.website ? (
                    <a href={company.website} rel="noreferrer" target="_blank">
                      {company.website}<span aria-hidden="true"> ↗</span>
                    </a>
                  ) : "—"}
                </DetailField>
                <DetailField label="Domain" value={company.domain} />
                <DetailField label="Industry" value={company.industry} />
                <DetailField label="Location" value={location || null} />
                <DetailField label="Lead score">
                  {company.lead_score === null ? "Not scored" : `${company.lead_score} / 100`}
                </DetailField>
                <DetailField label="Added">
                  <time dateTime={company.created_at}>
                    {formatDate(company.created_at)}
                  </time>
                </DetailField>
                <DetailField label="Software need" wide>
                  {company.software_need || "No software need recorded."}
                </DetailField>
              </dl>
            )}
          </section>

          <WebsiteCrawlSection
            crawl={websiteCrawlQuery.data ?? null}
            error={websiteCrawlQuery.isError ? websiteCrawlQuery.error.message : null}
            isLoading={websiteCrawlQuery.isLoading}
            isPending={websiteCrawlMutation.isPending}
            onCrawl={() => websiteCrawlMutation.mutate()}
            onRetry={() => void websiteCrawlQuery.refetch()}
            hasWebsite={Boolean(company.website || company.domain)}
            lastAttemptFailed={websiteCrawlMutation.isError}
          />

          <RecordSection
            title="Contacts"
            subtitle="Publicly listed contact details"
            icon="♙"
            count={company.contacts.length}
            empty="No public contact information has been added yet."
          >
            {company.contacts.map((contact) => (
              <article className="detail-record-card" key={contact.id}>
                <span className="contact-avatar" aria-hidden="true">
                  {(contact.name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="contact-card-content">
                  <strong>{contact.name || "Unnamed contact"}</strong>
                  <span>{contact.role || "Role not provided"}</span>
                  <div className="contact-links">
                    {contact.business_email && (
                      <a href={`mailto:${contact.business_email}`}>
                        {contact.business_email}
                      </a>
                    )}
                    {contact.business_phone && (
                      <a href={`tel:${contact.business_phone}`}>
                        {contact.business_phone}
                      </a>
                    )}
                  </div>
                </div>
                <span className={`public-label${contact.is_publicly_listed ? "" : " not-public"}`}>
                  {contact.is_publicly_listed ? "Publicly listed" : "Not confirmed public"}
                </span>
              </article>
            ))}
          </RecordSection>

          <RecordSection
            title="Research sources"
            subtitle="Evidence gathered from discovery and company research"
            icon="↗"
            count={company.sources.length}
            empty="No research sources are attached to this company."
          >
            {company.sources.map((source) => (
              <article className="detail-record-card source-card" key={source.id}>
                <div className="source-card-top">
                  <span className="source-kind">
                    {source.source_type?.replaceAll("_", " ") || "Research source"}
                  </span>
                  <span>{formatDate(source.created_at)}</span>
                </div>
                <a href={source.source_url} rel="noreferrer" target="_blank">
                  {source.source_url}<span aria-hidden="true"> ↗</span>
                </a>
                <button
                  className="button button-secondary research-source-crawl-button"
                  disabled={researchSourceMutation.isPending}
                  onClick={() => researchSourceMutation.mutate(source.source_url)}
                  type="button"
                >
                  {researchSourceMutation.isPending &&
                  researchSourceMutation.variables === source.source_url
                    ? "Crawling…"
                    : "Crawl and enrich"}
                </button>
                {researchSourceMutation.isSuccess &&
                  researchSourceMutation.variables === source.source_url && (
                    <p className="research-source-success" role="status">
                      Crawl complete. Missing company details were filled when
                      they could be verified.
                    </p>
                  )}
                {researchSourceMutation.isError &&
                  researchSourceMutation.variables === source.source_url && (
                    <div className="research-source-error" role="alert">
                      <strong>Crawl failed</strong>
                      <p>{researchSourceMutation.error.message}</p>
                      <span>
                        Temporary network or server errors may clear on retry.
                        Sites that deny automated access require an approved
                        API or permission from the site owner.
                      </span>
                    </div>
                  )}
                {source.evidence && <p>{source.evidence}</p>}
                {source.verified_at && (
                  <span className="verified-copy">
                    Verified {formatDate(source.verified_at)}
                  </span>
                )}
              </article>
            ))}
          </RecordSection>

          <RecordSection
            title="Discovery keywords"
            subtitle="Searches that surfaced or were linked to this company"
            icon="⌕"
            count={company.search_keywords.length}
            empty="No discovery keywords are attached to this company."
          >
            <div className="keyword-list">
              {company.search_keywords.map((keyword, index) => (
                <article className="keyword-card" key={`${keyword.keyword}-${keyword.searched_at}-${index}`}>
                  <span aria-hidden="true">⌕</span>
                  <div><strong>{keyword.keyword}</strong><small>{formatDate(keyword.searched_at)}</small></div>
                </article>
              ))}
            </div>
          </RecordSection>
        </main>

        <aside className="company-detail-aside">
          <RecordSection
            title="PageSpeed insights"
            subtitle="Website performance and quality"
            icon="◷"
            count={company.pagespeed_scans.length}
            empty="No PageSpeed reports are available yet."
          >
            {company.pagespeed_scans.map((scan) => {
              const isExpanded = expandedScanId === scan.id;
              return (
                <article className="pagespeed-card" key={scan.id}>
                  <div className="pagespeed-card-heading">
                    <strong>{scan.strategy} scan</strong>
                    <span>{formatDate(scan.scanned_at)}</span>
                  </div>
                  <a href={scan.website_url} rel="noreferrer" target="_blank">
                    {scan.website_url}
                  </a>
                  <div className="pagespeed-card-scores">
                    {[
                      ["Performance", "performance"],
                      ["Accessibility", "accessibility"],
                      ["Best practices", "best-practices"],
                      ["SEO", "seo"],
                    ].map(([label, category]) => {
                      const score = scan.category_scores[category];
                      return (
                        <div key={category}>
                          <span>{label}</span>
                          <strong>{score === null || score === undefined ? "—" : `${score}/100`}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="text-button pagespeed-toggle"
                    onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                    type="button"
                  >
                    {isExpanded ? "Hide detailed audits" : "View detailed audits"}
                    <span aria-hidden="true">{isExpanded ? " ↑" : " ↓"}</span>
                  </button>
                  {isExpanded && scanQuery.isPending && (
                    <p className="record-empty">Loading Lighthouse audit details…</p>
                  )}
                  {isExpanded && scanQuery.isError && (
                    <p className="pagespeed-error" role="alert">{scanQuery.error.message}</p>
                  )}
                  {isExpanded && expandedReport && (
                    <div className="pagespeed-audits">
                      <p>Lighthouse {expandedReport.lighthouseResult.lighthouseVersion ?? "version unavailable"}</p>
                      {audits.map(([id, audit]) => (
                        <AuditItem audit={audit} key={id} />
                      ))}
                      {audits.length === 0 && (
                        <p className="record-empty">No detailed Lighthouse audits were included.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </RecordSection>

          <section className="panel detail-danger-zone">
            <div className="detail-section-heading">
              <span className="section-icon danger" aria-hidden="true">!</span>
              <div><h2>Remove company</h2><p>Delete this record and its related data</p></div>
            </div>
            {isDeleteConfirmed ? (
              <div className="delete-confirm-panel">
                <p>This will permanently delete {company.name} and its related records.</p>
                <div>
                  <button
                    className="button button-secondary"
                    onClick={() => setIsDeleteConfirmed(false)}
                    type="button"
                  >
                    Keep company
                  </button>
                  <button
                    className="button button-danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    type="button"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button button-danger-outline"
                onClick={() => setIsDeleteConfirmed(true)}
                type="button"
              >
                Delete company
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function WebsiteCrawlSection({
  crawl,
  error,
  isLoading,
  isPending,
  onCrawl,
  onRetry,
  hasWebsite,
  lastAttemptFailed,
}: {
  crawl: WebsiteCrawlResponse | null;
  error: string | null;
  isLoading: boolean;
  isPending: boolean;
  onCrawl: () => void;
  onRetry: () => void;
  hasWebsite: boolean;
  lastAttemptFailed: boolean;
}) {
  const crawledPages = crawl
    ? [
        {
          label: "About",
          url: crawl.about_page_url,
          content: crawl.about_content,
        },
        {
          label: "Contact",
          url: crawl.contact_page_url,
          content: crawl.contact_content,
        },
        {
          label: "Mission & goals",
          url: crawl.goals_page_url,
          content: crawl.goals_content,
        },
      ].filter((page) => page.url || page.content)
    : [];

  return (
    <section className="panel detail-section website-crawl-section">
      <div className="website-crawl-heading">
        <div className="detail-section-heading">
          <span className="section-icon blue" aria-hidden="true">⌕</span>
          <div>
            <h2>Website crawl</h2>
            <p>Latest crawl status and extracted company information</p>
          </div>
        </div>
        <span
          aria-live="polite"
          className={`website-crawl-status${
            isPending
              ? " is-pending"
              : lastAttemptFailed
                ? " is-error"
                : crawl
                  ? " is-success"
                  : ""
          }`}
        >
          {isPending
            ? "Crawling"
            : lastAttemptFailed
              ? "Last crawl failed"
              : error
                ? "Status unavailable"
                : isLoading
                  ? "Checking status"
                  : crawl
                    ? "Crawled"
                    : "Not crawled"}
        </span>
        <button
          className="button button-primary"
          disabled={!hasWebsite || isPending}
          onClick={onCrawl}
          type="button"
        >
          {isPending
            ? "Crawling website…"
            : crawl
              ? "Re-crawl website"
              : "Crawl website"}
        </button>
      </div>

      {!hasWebsite && (
        <p className="record-empty">
          Add a website or domain to enable crawling.
        </p>
      )}
      {error && (
        <div className="alert alert-error website-crawl-error" role="alert">
          Could not load crawl status: {error}
          <button className="text-button" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      )}
      {isLoading ? (
        <p className="record-empty" aria-live="polite">
          Loading crawl status…
        </p>
      ) : crawl ? (
        <div className="crawl-result website-crawl-result">
          <div className="crawl-result-heading">
            <div>
              <strong>Last successful crawl</strong>
              <a href={crawl.website_url} rel="noreferrer" target="_blank">
                {crawl.website_url}
                <span aria-hidden="true"> ↗</span>
              </a>
            </div>
            <time dateTime={crawl.crawled_at}>
              {formatDate(crawl.crawled_at)}
            </time>
          </div>
          {crawledPages.length > 0 ? (
            <div className="crawl-pages">
              {crawledPages.map((page) => (
                <article className="crawl-page" key={page.label}>
                  <div>
                    <strong>{page.label}</strong>
                    {page.url && (
                      <a href={page.url} rel="noreferrer" target="_blank">
                        Open page ↗
                      </a>
                    )}
                  </div>
                  <p>{page.content || "No page text was extracted."}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="record-empty">
              No About, Contact, or Mission page was found.
            </p>
          )}
          <div className="crawl-extracted">
            <CrawlExtractedList
              title="Email addresses"
              values={crawl.emails}
              href={(email) => `mailto:${email}`}
            />
            <CrawlExtractedList
              title="Social links"
              values={crawl.social_links}
              href={(url) => url}
              external
            />
          </div>
        </div>
      ) : (
        !error && !isLoading && (
          <p className="record-empty">
            No successful crawl has been recorded for this company yet.
          </p>
        )
      )}
    </section>
  );
}

function CrawlExtractedList({
  title,
  values,
  href,
  external = false,
}: {
  title: string;
  values: string[];
  href: (value: string) => string;
  external?: boolean;
}) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>
              <a
                href={href(value)}
                rel={external ? "noreferrer" : undefined}
                target={external ? "_blank" : undefined}
              >
                {value}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>None found</p>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  children,
  wide = false,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`overview-field${wide ? " overview-field-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children ?? value ?? "—"}</dd>
    </div>
  );
}

function RecordSection({
  title,
  subtitle,
  icon,
  count,
  empty,
  beforeContent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  count: number;
  empty: string;
  beforeContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel detail-section">
      <div className="detail-section-heading">
        <span className="section-icon violet" aria-hidden="true">{icon}</span>
        <div className="detail-section-title">
          <h2>{title}<span>{count}</span></h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {beforeContent}
      {count === 0 ? <p className="detail-empty">{empty}</p> : children}
    </section>
  );
}

function AuditItem({ audit }: { audit: PageSpeedAudit }) {
  return (
    <div className="pagespeed-audit">
      <strong>{audit.title ?? "Unnamed audit"}</strong>
      {audit.description && <p>{audit.description}</p>}
      {audit.displayValue && <span>{audit.displayValue}</span>}
    </div>
  );
}

function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
