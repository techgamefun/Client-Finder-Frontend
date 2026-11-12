"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  createCompany,
  deleteCompany,
  getCompanies,
  getPageSpeedScan,
  updateCompany,
  updateLeadStatus,
} from "@/lib/api";
import type { Company, CompanyInput, CompanyUpdateInput } from "@/lib/api";
import { CompanyName } from "./overview-page";

const noCompanies: Company[] = [];
const leadStatuses = [
  "new",
  "needs_review",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
];
const pageSizes = [10, 25, 50];
const pipelineQueryChangedEvent = "lead-pipeline-query-change";
const emptyCompany: CompanyInput = {
  name: "",
  website: "",
  domain: "",
  industry: "",
  city: "",
  state: "",
  software_need: "",
};

function subscribeToPipelineQuery(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(pipelineQueryChangedEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(pipelineQueryChangedEvent, onChange);
  };
}

function getPipelineSearchSnapshot() {
  return window.location.search;
}

function getServerPipelineSearchSnapshot() {
  return "";
}

function updatePipelineQuery(updates: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(pipelineQueryChangedEvent));
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const pipelineSearch = useSyncExternalStore(
    subscribeToPipelineQuery,
    getPipelineSearchSnapshot,
    getServerPipelineSearchSnapshot,
  );
  const pipelineParams = new URLSearchParams(pipelineSearch);
  const companyFilter = pipelineParams.get("q") ?? "";
  const requestedStatus = pipelineParams.get("status");
  const statusFilter =
    requestedStatus && leadStatuses.includes(requestedStatus)
      ? requestedStatus
      : "all";
  const requestedWebsite = pipelineParams.get("website");
  const websiteFilter =
    requestedWebsite === "with_website" ||
    requestedWebsite === "without_website"
      ? requestedWebsite
      : "all";
  const sourceDomainFilter = pipelineParams.get("source_domain") ?? "";
  const requestedPage = Number(pipelineParams.get("page"));
  const currentPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const requestedPageSize = Number(pipelineParams.get("pageSize"));
  const pageSize = pageSizes.includes(requestedPageSize)
    ? requestedPageSize
    : 10;
  const [companyForm, setCompanyForm] = useState<CompanyInput>(emptyCompany);
  const addCompanyDialogRef = useRef<HTMLDialogElement>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [expandedPageSpeedScanId, setExpandedPageSpeedScanId] = useState<
    string | null
  >(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CompanyUpdateInput>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });
  const pageSpeedScanQuery = useQuery({
    queryKey: [
      "pagespeed-scan",
      expandedCompanyId,
      expandedPageSpeedScanId,
    ],
    queryFn: () => {
      if (expandedCompanyId === null || expandedPageSpeedScanId === null) {
        throw new Error("Select a PageSpeed scan to view its report.");
      }
      return getPageSpeedScan(expandedCompanyId, expandedPageSpeedScanId);
    },
    enabled:
      expandedCompanyId !== null && expandedPageSpeedScanId !== null,
  });
  const createMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setCompanyForm(emptyCompany);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      companyId,
      input,
    }: {
      companyId: string;
      input: CompanyUpdateInput;
    }) => updateCompany(companyId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setEditingCompanyId(null);
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({
      companyId,
      leadStatus,
    }: {
      companyId: string;
      leadStatus: string;
    }) => updateLeadStatus(companyId, leadStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setConfirmDeleteId(null);
      setExpandedCompanyId(null);
    },
  });

  const companies = companiesQuery.data ?? noCompanies;
  const sourceDomainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of companies) {
      const domains = new Set(
        company.sources.map((source) => source.source_domain),
      );
      for (const domain of domains) {
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [companies]);
  const filteredCompanies = useMemo(() => {
    const term = companyFilter.trim().toLowerCase();
    return companies.filter((company) => {
      const hasWebsite = Boolean(company.website || company.domain);
      const matchesWebsite =
        websiteFilter === "all" ||
        (websiteFilter === "with_website" && hasWebsite) ||
        (websiteFilter === "without_website" && !hasWebsite);
      const matchesSourceDomain =
        !sourceDomainFilter ||
        company.sources.some(
          (source) => source.source_domain === sourceDomainFilter,
        );

      return (
        (statusFilter === "all" || company.lead_status === statusFilter) &&
        matchesWebsite &&
        matchesSourceDomain &&
        (!term ||
          [
            company.name,
            company.domain,
            company.industry,
            company.city,
            company.state,
            ...company.sources.flatMap((source) => [
              source.source_domain,
              source.source_url,
            ]),
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(term)))
      );
    });
  }, [
    companies,
    companyFilter,
    sourceDomainFilter,
    statusFilter,
    websiteFilter,
  ]);
  const websiteCount = companies.filter(
    (company) => company.website || company.domain,
  ).length;
  const pageCount = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const paginatedCompanies = useMemo(
    () =>
      filteredCompanies.slice(
        (visiblePage - 1) * pageSize,
        visiblePage * pageSize,
      ),
    [filteredCompanies, pageSize, visiblePage],
  );

  function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      name: companyForm.name.trim(),
      website: cleanText(companyForm.website),
      domain: cleanText(companyForm.domain),
      industry: cleanText(companyForm.industry),
      city: cleanText(companyForm.city),
      state: cleanText(companyForm.state),
      software_need: cleanText(companyForm.software_need),
    });
  }

  function startEditing(company: Company) {
    setExpandedCompanyId(company.id);
    setEditingCompanyId(company.id);
    setConfirmDeleteId(null);
    setEditingForm({
      name: company.name,
      website: company.website,
      domain: company.domain,
      industry: company.industry,
      city: company.city,
      state: company.state,
      software_need: company.software_need,
      lead_score: company.lead_score,
    });
  }

  function handleUpdateCompany(
    event: FormEvent<HTMLFormElement>,
    companyId: string,
  ) {
    event.preventDefault();
    updateMutation.mutate({
      companyId,
      input: {
        ...editingForm,
        name: editingForm.name?.trim(),
        website: cleanText(editingForm.website),
        domain: cleanText(editingForm.domain),
        industry: cleanText(editingForm.industry),
        city: cleanText(editingForm.city),
        state: cleanText(editingForm.state),
        software_need: cleanText(editingForm.software_need),
      },
    });
  }

  function updateField<K extends keyof CompanyInput>(
    key: K,
    value: CompanyInput[K],
  ) {
    setCompanyForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditingField<K extends keyof CompanyUpdateInput>(
    key: K,
    value: CompanyUpdateInput[K],
  ) {
    setEditingForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section className="panel pipeline-panel leads-panel">
        <div className="leads-filter-section">
          <div className="leads-filter-heading">
            <div>
              <h1>Lead pipeline</h1>
              <p className="heading-copy">
                Manage and review your company prospects.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                createMutation.reset();
                addCompanyDialogRef.current?.showModal();
              }}
              type="button"
            >
              <span aria-hidden="true">＋</span> Add a company
            </button>
          </div>
          <div>
            <div className="pipeline-tools leads-filter-controls">
              <label className="filter-input">
                <span aria-hidden="true">⌕</span>
                <span className="sr-only">
                  Search leads, source domains, and URLs
                </span>
                <input
                  onChange={(event) =>
                    updatePipelineQuery({
                      q: event.target.value || null,
                      page: null,
                    })
                  }
                  placeholder="Search leads or source domains"
                  value={companyFilter}
                />
              </label>
              <label className="select-filter">
                <span className="sr-only">Filter by lead status</span>
                <select
                  onChange={(event) =>
                    updatePipelineQuery({
                      status:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                    })
                  }
                  value={statusFilter}
                >
                  <option value="all">All statuses ({companies.length})</option>
                  {leadStatuses.map((leadStatus) => {
                    const count = companies.filter(
                      (company) => company.lead_status === leadStatus,
                    ).length;
                    return (
                      <option key={leadStatus} value={leadStatus}>
                        {leadStatus.replaceAll("_", " ")} ({count})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="select-filter">
                <span className="sr-only">Filter by website</span>
                <select
                  onChange={(event) =>
                    updatePipelineQuery({
                      website:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                    })
                  }
                  value={websiteFilter}
                >
                  <option value="all">All websites ({companies.length})</option>
                  <option value="with_website">
                    With a website ({websiteCount})
                  </option>
                  <option value="without_website">
                    Without a website ({companies.length - websiteCount})
                  </option>
                </select>
              </label>
              <button
                aria-label="Refresh leads"
                className="icon-button refresh-button"
                disabled={companiesQuery.isFetching}
                onClick={() => void companiesQuery.refetch()}
                type="button"
              >
                ↻
              </button>
            </div>
            {sourceDomainCounts.length > 0 && (
              <div className="source-domain-filters">
                <span className="source-domain-filter-label">
                  Filter by source domain
                </span>
                <div
                  aria-label="Filter leads by source domain"
                  className="source-domain-filter-options"
                  role="group"
                >
                  <button
                    aria-pressed={!sourceDomainFilter}
                    className={`source-domain-filter${!sourceDomainFilter ? " active" : ""}`}
                    onClick={() =>
                      updatePipelineQuery({
                        source_domain: null,
                        page: null,
                      })
                    }
                    type="button"
                  >
                    All domains <span>{companies.length}</span>
                  </button>
                  {sourceDomainCounts.map(([domain, count]) => (
                    <button
                      aria-pressed={sourceDomainFilter === domain}
                      className={`source-domain-filter${sourceDomainFilter === domain ? " active" : ""}`}
                      key={domain}
                      onClick={() =>
                        updatePipelineQuery({
                          source_domain:
                            sourceDomainFilter === domain ? null : domain,
                          page: null,
                        })
                      }
                      type="button"
                    >
                      {domain} <span>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {companiesQuery.isError ? (
          <div className="query-error" role="alert">
            <strong>Could not load your leads.</strong>
            <span>{companiesQuery.error.message}</span>
            <button
              className="button button-secondary"
              onClick={() => void companiesQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : companiesQuery.isLoading ? (
          <div className="table-state">Loading your pipeline...</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-symbol">▤</span>
            <strong>
              {companies.length === 0
                ? "Your pipeline is ready"
                : "No leads match your filters"}
            </strong>
            <span>
              {companies.length === 0
                ? "Discover companies or add one manually to get started."
                : "Try a different search term or filter."}
            </span>
          </div>
        ) : (
          <>
            <div
              aria-label="Company leads list"
              className="table-scroll"
              tabIndex={0}
            >
              <table>
              <thead>
                <tr>
                  <th>COMPANY</th>
                  <th>SOURCE DOMAIN</th>
                  <th>INDUSTRY</th>
                  <th>LOCATION</th>
                  <th>STATUS</th>
                  <th>SCORE</th>
                  <th>ADDED</th>
                  <th>RECORD</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.map((company) => (
                  <Fragment key={company.id}>
                    <tr>
                      <td><CompanyName company={company} /></td>
                      <td className="source-domain-cell">
                        {company.sources.length > 0 ? (
                          <div
                            aria-label={`${company.name} source domains`}
                            className="source-domain-list"
                          >
                            {Array.from(
                              new Map(
                                company.sources.map((source) => [
                                  source.source_domain,
                                  source,
                                ]),
                              ).values(),
                            ).map((source) => (
                              <a
                                href={source.source_url}
                                key={source.id}
                                rel="noreferrer"
                                target="_blank"
                                title={source.source_url}
                              >
                                {source.source_domain}
                              </a>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{company.industry ?? "—"}</td>
                      <td>
                        {[company.city, company.state].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`status-${company.id}`}>
                          Change status for {company.name}
                        </label>
                        <select
                          className="status-select"
                          disabled={statusMutation.isPending}
                          id={`status-${company.id}`}
                          onChange={(event) =>
                            statusMutation.mutate({
                              companyId: company.id,
                              leadStatus: event.target.value,
                            })
                          }
                          value={company.lead_status}
                        >
                          {!leadStatuses.includes(company.lead_status) && (
                            <option value={company.lead_status}>
                              {company.lead_status.replaceAll("_", " ")}
                            </option>
                          )}
                          {leadStatuses.map((leadStatus) => (
                            <option key={leadStatus} value={leadStatus}>
                              {leadStatus.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="score-cell">{company.lead_score ?? "—"}</td>
                      <td>
                        {new Date(company.created_at).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </td>
                      <td>
                        <Link
                          className="text-button"
                          href={`/company/${company.id}`}
                        >
                          View details <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                    {expandedCompanyId === company.id && (
                      <tr className="detail-row">
                        <td colSpan={8}>
                          <section
                            aria-label={`${company.name} full record`}
                            className="company-record"
                          >
                            <div className="record-actions">
                              <strong>Company record #{company.id}</strong>
                              <div>
                                {editingCompanyId === company.id ? (
                                  <button
                                    className="text-button"
                                    onClick={() => setEditingCompanyId(null)}
                                    type="button"
                                  >
                                    Cancel edit
                                  </button>
                                ) : (
                                  <button
                                    className="text-button"
                                    onClick={() => startEditing(company)}
                                    type="button"
                                  >
                                    Edit company
                                  </button>
                                )}
                                {confirmDeleteId === company.id ? (
                                  <>
                                    <span className="delete-confirm-copy">
                                      Delete this company and its related records?
                                    </span>
                                    <button
                                      className="text-button danger-text"
                                      disabled={deleteMutation.isPending}
                                      onClick={() =>
                                        deleteMutation.mutate(company.id)
                                      }
                                      type="button"
                                    >
                                      {deleteMutation.isPending
                                        ? "Deleting..."
                                        : "Confirm delete"}
                                    </button>
                                    <button
                                      className="text-button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      type="button"
                                    >
                                      Keep record
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="text-button danger-text"
                                    onClick={() =>
                                      setConfirmDeleteId(company.id)
                                    }
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>

                            {editingCompanyId === company.id ? (
                              <form
                                className="company-form record-edit-form"
                                onSubmit={(event) =>
                                  handleUpdateCompany(event, company.id)
                                }
                              >
                                <div className="form-row">
                                  <label>
                                    Company name <span>*</span>
                                    <input
                                      maxLength={200}
                                      onChange={(event) =>
                                        updateEditingField(
                                          "name",
                                          event.target.value,
                                        )
                                      }
                                      required
                                      value={editingForm.name ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Website
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "website",
                                          event.target.value,
                                        )
                                      }
                                      type="url"
                                      value={editingForm.website ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    Industry
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "industry",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.industry ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Domain
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "domain",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.domain ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    City
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "city",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.city ?? ""}
                                    />
                                  </label>
                                  <label>
                                    State / region
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "state",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.state ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    Software need
                                    <textarea
                                      onChange={(event) =>
                                        updateEditingField(
                                          "software_need",
                                          event.target.value,
                                        )
                                      }
                                      rows={3}
                                      value={editingForm.software_need ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Lead score
                                    <input
                                      min={0}
                                      onChange={(event) =>
                                        updateEditingField(
                                          "lead_score",
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                        )
                                      }
                                      type="number"
                                      value={editingForm.lead_score ?? ""}
                                    />
                                  </label>
                                </div>
                                {updateMutation.isError && (
                                  <div className="alert alert-error" role="alert">
                                    {updateMutation.error.message}
                                  </div>
                                )}
                                <button
                                  className="button button-primary"
                                  disabled={updateMutation.isPending}
                                  type="submit"
                                >
                                  {updateMutation.isPending
                                    ? "Saving changes..."
                                    : "Save company"}
                                </button>
                              </form>
                            ) : (
                              <dl className="company-detail-grid">
                                <Detail label="Company name" value={company.name} />
                                <Detail label="Website">
                                  {company.website ? (
                                    <a
                                      href={company.website}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {company.website}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </Detail>
                                <Detail label="Domain" value={company.domain} />
                                <Detail label="Industry" value={company.industry} />
                                <Detail
                                  label="Location"
                                  value={
                                    [company.city, company.state]
                                      .filter(Boolean)
                                      .join(", ") || null
                                  }
                                />
                                <Detail
                                  label="Software need"
                                  value={company.software_need}
                                />
                                <Detail
                                  label="Lead score"
                                  value={
                                    company.lead_score === null
                                      ? "Not scored"
                                      : String(company.lead_score)
                                  }
                                />
                                <Detail
                                  label="Lead status"
                                  value={company.lead_status.replaceAll("_", " ")}
                                />
                                <Detail
                                  label="Created"
                                  value={new Date(
                                    company.created_at,
                                  ).toLocaleString()}
                                />
                              </dl>
                            )}

                            {editingCompanyId !== company.id && (
                              <>
                                <RecordCollection
                                  title={`Search keywords (${company.search_keywords.length})`}
                                  empty="No discovery search keywords are attached."
                                  hasItems={company.search_keywords.length > 0}
                                >
                                  {company.search_keywords.map((search) => (
                                    <article
                                      className="record-item"
                                      key={search.id}
                                    >
                                      <strong>{search.keyword}</strong>
                                      <span>
                                        Searched:{" "}
                                        {new Date(
                                          search.searched_at,
                                        ).toLocaleString()}
                                      </span>
                                    </article>
                                  ))}
                                </RecordCollection>
                                <RecordCollection
                                  title={`PageSpeed scans (${company.pagespeed_scans.length})`}
                                  empty="No PageSpeed reports have been saved."
                                  hasItems={company.pagespeed_scans.length > 0}
                                >
                                  {company.pagespeed_scans.map((scan) => {
                                    const isExpanded =
                                      expandedPageSpeedScanId === scan.id;
                                    const report =
                                      isExpanded &&
                                      pageSpeedScanQuery.data?.id === scan.id
                                        ? pageSpeedScanQuery.data.report
                                        : null;
                                    const audits = Object.entries(
                                      report?.lighthouseResult.audits ?? {},
                                    );

                                    return (
                                      <article
                                        className="record-item"
                                        key={scan.id}
                                      >
                                        <strong>
                                          Google PageSpeed Insights ·{" "}
                                          {scan.strategy}
                                        </strong>
                                        <a
                                          href={scan.website_url}
                                          rel="noreferrer"
                                          target="_blank"
                                        >
                                          {scan.website_url}
                                        </a>
                                        <span>
                                          Scanned:{" "}
                                          {new Date(
                                            scan.scanned_at,
                                          ).toLocaleString()}
                                        </span>
                                        <div className="pagespeed-score-grid">
                                          {[
                                            ["Performance", "performance"],
                                            ["Accessibility", "accessibility"],
                                            ["Best practices", "best-practices"],
                                            ["SEO", "seo"],
                                          ].map(([label, category]) => (
                                            <span key={category}>
                                              {label}:{" "}
                                              {scan.category_scores[category] ??
                                                "N/A"}
                                              {scan.category_scores[category] !==
                                                null &&
                                              scan.category_scores[category] !==
                                                undefined
                                                ? "/100"
                                                : ""}
                                            </span>
                                          ))}
                                        </div>
                                        <button
                                          className="text-button"
                                          onClick={() =>
                                            setExpandedPageSpeedScanId(
                                              (current) =>
                                                current === scan.id
                                                  ? null
                                                  : scan.id,
                                            )
                                          }
                                          type="button"
                                        >
                                          {isExpanded
                                            ? "Hide detailed audits"
                                            : "View detailed audits"}
                                        </button>
                                        {isExpanded &&
                                          pageSpeedScanQuery.isPending && (
                                            <p className="record-empty">
                                              Loading Lighthouse audit details…
                                            </p>
                                          )}
                                        {isExpanded &&
                                          pageSpeedScanQuery.isError && (
                                            <p
                                              className="record-mutation-error"
                                              role="alert"
                                            >
                                              {pageSpeedScanQuery.error.message}
                                            </p>
                                          )}
                                        {report && (
                                          <div className="pagespeed-audits">
                                            <strong>
                                              Lighthouse version{" "}
                                              {report.lighthouseResult
                                                .lighthouseVersion ??
                                                "not provided"}
                                            </strong>
                                            {audits.map(([id, audit]) => (
                                              <div
                                                className="pagespeed-audit"
                                                key={id}
                                              >
                                                <strong>
                                                  {audit.title ?? id}
                                                  {audit.score === null
                                                    ? " · informational"
                                                    : ` · ${Math.round(
                                                        audit.score * 100,
                                                      )}/100`}
                                                </strong>
                                                {audit.displayValue && (
                                                  <span>
                                                    {audit.displayValue}
                                                  </span>
                                                )}
                                                {audit.description && (
                                                  <p>{audit.description}</p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </article>
                                    );
                                  })}
                                </RecordCollection>
                                <RecordCollection
                                  title={`Contacts (${company.contacts.length})`}
                                  empty="No contact records are attached."
                                  hasItems={company.contacts.length > 0}
                                >
                                  {company.contacts.map((contact) => (
                                    <article
                                      className="record-item"
                                      key={contact.id}
                                    >
                                      <strong>
                                        Contact #{contact.id}:{" "}
                                        {contact.name ?? "Unnamed contact"}
                                      </strong>
                                      <span>{contact.role ?? "Role not provided"}</span>
                                      <span>
                                        {contact.business_email ??
                                          "Email not provided"}
                                      </span>
                                      <span>
                                        {contact.business_phone ??
                                          "Phone not provided"}
                                      </span>
                                      <span>
                                        {contact.is_publicly_listed
                                          ? "Publicly listed"
                                          : "Not marked publicly listed"}
                                      </span>
                                    </article>
                                  ))}
                                </RecordCollection>
                                <RecordCollection
                                  title={`Lead sources (${company.sources.length})`}
                                  empty="No source evidence is attached."
                                  hasItems={company.sources.length > 0}
                                >
                                  {company.sources.map((source) => (
                                    <article
                                      className="record-item source-item"
                                      key={source.id}
                                    >
                                      <strong>Source #{source.id}</strong>
                                      <a
                                        href={source.source_url}
                                        rel="noreferrer"
                                        target="_blank"
                                      >
                                        {source.source_url}
                                      </a>
                                      <span>
                                        Type: {source.source_type ?? "Not specified"}
                                      </span>
                                      <span>
                                        Added:{" "}
                                        {new Date(
                                          source.created_at,
                                        ).toLocaleString()}
                                      </span>
                                      <span>
                                        Verified:{" "}
                                        {source.verified_at
                                          ? new Date(
                                              source.verified_at,
                                            ).toLocaleString()
                                          : "Not verified"}
                                      </span>
                                      <p>
                                        {source.evidence ??
                                          "No evidence text was saved."}
                                      </p>
                                    </article>
                                  ))}
                                </RecordCollection>
                              </>
                            )}
                          </section>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing{" "}
                {filteredCompanies.length === 0
                  ? 0
                  : (visiblePage - 1) * pageSize + 1}
                –{Math.min(visiblePage * pageSize, filteredCompanies.length)} of{" "}
                {filteredCompanies.length} leads
                {filteredCompanies.length !== companies.length &&
                  ` (from ${companies.length} total)`}
              </span>
              <div className="pagination-controls">
                <label>
                  Rows
                  <select
                    onChange={(event) => {
                      const nextPageSize = Number(event.target.value);
                      updatePipelineQuery({
                        pageSize: nextPageSize === 10
                          ? null
                          : String(nextPageSize),
                        page: null,
                      });
                    }}
                    value={pageSize}
                  >
                    {pageSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label="Previous page"
                  className="pagination-button"
                  disabled={visiblePage === 1}
                  onClick={() =>
                    updatePipelineQuery({
                      page:
                        visiblePage === 2 ? null : String(visiblePage - 1),
                    })
                  }
                  type="button"
                >
                  Previous
                </button>
                <span>
                  {visiblePage} / {pageCount}
                </span>
                <button
                  aria-label="Next page"
                  className="pagination-button"
                  disabled={visiblePage >= pageCount}
                  onClick={() =>
                    updatePipelineQuery({ page: String(visiblePage + 1) })
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
            {statusMutation.isError && (
              <div className="alert alert-error record-mutation-error" role="alert">
                Could not update lead status: {statusMutation.error.message}
              </div>
            )}
            {deleteMutation.isError && (
              <div className="alert alert-error record-mutation-error" role="alert">
                Could not delete company: {deleteMutation.error.message}
              </div>
            )}
          </>
        )}
      </section>

      <dialog
        aria-labelledby="add-company-title"
        className="add-company-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={addCompanyDialogRef}
      >
        <div className="panel-heading compact-heading">
          <div>
            <p className="eyebrow">MANUAL ENTRY</p>
            <h2 id="add-company-title">Add a company</h2>
            <p className="panel-subtitle">
              Add a company directly when you already have its details.
            </p>
          </div>
          <button
            aria-label="Close add company dialog"
            className="icon-button"
            onClick={() => addCompanyDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
        </div>
        <form className="company-form" onSubmit={handleCreateCompany}>
          <div className="form-row">
            <label>
              Company name <span>*</span>
              <input
                autoComplete="organization"
                maxLength={200}
                onChange={(event) => updateField("name", event.target.value)}
                required
                value={companyForm.name}
              />
            </label>
            <label>
              Website
              <input
                autoComplete="url"
                onChange={(event) => updateField("website", event.target.value)}
                placeholder="https://example.com"
                type="url"
                value={companyForm.website ?? ""}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Industry
              <input
                onChange={(event) => updateField("industry", event.target.value)}
                value={companyForm.industry ?? ""}
              />
            </label>
            <label>
              Domain
              <input
                onChange={(event) => updateField("domain", event.target.value)}
                placeholder="example.com"
                value={companyForm.domain ?? ""}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              City
              <input
                onChange={(event) => updateField("city", event.target.value)}
                value={companyForm.city ?? ""}
              />
            </label>
            <label>
              State / region
              <input
                onChange={(event) => updateField("state", event.target.value)}
                value={companyForm.state ?? ""}
              />
            </label>
          </div>
          <label>
            Software need
            <textarea
              onChange={(event) =>
                updateField("software_need", event.target.value)
              }
              rows={3}
              value={companyForm.software_need ?? ""}
            />
          </label>
          {createMutation.isError && (
            <div className="alert alert-error" role="alert">
              {createMutation.error.message}
            </div>
          )}
          {createMutation.isSuccess && (
            <div className="alert alert-success" role="status">
              Company added to your pipeline.
            </div>
          )}
          <button
            className="button button-primary full-button"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? "Adding company..." : "Add to pipeline"}
          </button>
        </form>
      </dialog>
    </>
  );
}

function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="company-detail">
      <dt>{label}</dt>
      <dd>{children ?? value ?? "—"}</dd>
    </div>
  );
}

function RecordCollection({
  title,
  empty,
  hasItems,
  children,
}: {
  title: string;
  empty: string;
  hasItems: boolean;
  children: ReactNode;
}) {
  return (
    <section className="record-collection">
      <h3>{title}</h3>
      {hasItems ? (
        <div className="record-items">{children}</div>
      ) : (
        <p className="record-empty">{empty}</p>
      )}
    </section>
  );
}
