"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCompanies } from "@/lib/api";
import type { Company } from "@/lib/api";

const noCompanies: Company[] = [];

export function OverviewPage() {
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });
  const companies = companiesQuery.data ?? noCompanies;
  const reviewCount = companies.filter(
    (company) => company.lead_status === "needs_review",
  ).length;
  const scoredCount = companies.filter(
    (company) => company.lead_score !== null,
  ).length;
  const recentCompanies = companies.slice(0, 5);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
          <h1>Lead intelligence</h1>
          <p className="heading-copy">
            Find promising companies, organize your pipeline, and keep every
            source in reach.
          </p>
        </div>
        <Link className="button button-primary" href="/leads#add-company">
          <span aria-hidden="true">＋</span> Add a company
        </Link>
      </section>

      <section className="stats-grid" aria-label="Lead summary">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon violet">▤</span>
            <span className="stat-caption">ALL LEADS</span>
          </div>
          <strong className="stat-value">
            {companiesQuery.isLoading ? "—" : companies.length}
          </strong>
          <span className="stat-foot">Companies in your pipeline</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon amber">◷</span>
            <span className="stat-caption">NEEDS REVIEW</span>
          </div>
          <strong className="stat-value">
            {companiesQuery.isLoading ? "—" : reviewCount}
          </strong>
          <span className="stat-foot">Discovered and awaiting review</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green">↗</span>
            <span className="stat-caption">SCORED LEADS</span>
          </div>
          <strong className="stat-value">
            {companiesQuery.isLoading ? "—" : scoredCount}
          </strong>
          <span className="stat-foot">With an assigned lead score</span>
        </article>
      </section>

      <section className="overview-grid" aria-label="Workspace shortcuts">
        <Link className="overview-action" href="/discovery">
          <span className="stat-icon violet">⌕</span>
          <span>
            <strong>Discover new leads</strong>
            <small>Search the web and save promising companies.</small>
          </span>
          <span className="overview-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="overview-action" href="/crawler">
          <span className="stat-icon green">◎</span>
          <span>
            <strong>Research a website</strong>
            <small>Extract public contact and company information.</small>
          </span>
          <span className="overview-arrow" aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="panel pipeline-panel overview-recent">
        <div className="pipeline-heading">
          <div>
            <p className="eyebrow">RECENTLY ADDED</p>
            <h2>Latest leads</h2>
          </div>
          <Link className="button button-secondary" href="/leads">
            View pipeline <span aria-hidden="true">→</span>
          </Link>
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
        ) : recentCompanies.length === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-symbol">▤</span>
            <strong>Your pipeline is ready</strong>
            <span>Discover companies or add one manually to get started.</span>
            <Link className="text-link" href="/discovery">
              Discover your first leads <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>COMPANY</th>
                  <th>INDUSTRY</th>
                  <th>LOCATION</th>
                  <th>STATUS</th>
                  <th>SCORE</th>
                </tr>
              </thead>
              <tbody>
                {recentCompanies.map((company) => (
                  <tr key={company.id}>
                    <td><CompanyName company={company} /></td>
                    <td>{company.industry ?? "—"}</td>
                    <td>
                      {[company.city, company.state].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td><StatusBadge status={company.lead_status} /></td>
                    <td className="score-cell">{company.lead_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
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

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`status-badge status-${status
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
