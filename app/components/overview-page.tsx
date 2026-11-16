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
  const leads = companies.filter((company) => company.contacts.length > 0);
  const reviewCount = leads.filter(
    (company) => company.lead_status === "needs_review",
  ).length;
  const scoredCount = leads.filter(
    (company) => company.lead_score !== null,
  ).length;
  const recentLeads = leads.slice(0, 5);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
          <h1>Your growth, in focus.</h1>
          <p className="heading-copy">
            One workspace to discover promising companies, research their
            websites, and move every opportunity forward.
          </p>
        </div>
        <Link className="button button-primary" href="/companies">
          <span aria-hidden="true">＋</span> Add a company
        </Link>
      </section>

      <section className="home-welcome" aria-label="Workspace introduction">
        <div className="home-welcome-copy">
          <span className="home-welcome-label">
            <span className="home-welcome-dot" />
            YOUR LEAD WORKSPACE
          </span>
          <h2>Make every discovery count.</h2>
          <p>
            Start with a search, explore a company’s website, then keep the
            strongest opportunities organized in your pipeline.
          </p>
          <Link className="home-welcome-link" href="/discovery">
            Find your next lead <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-welcome-art" aria-hidden="true">
          <span className="home-art-ring home-art-ring-one" />
          <span className="home-art-ring home-art-ring-two" />
          <span className="home-art-orb">BI</span>
          <span className="home-art-spark home-art-spark-one">✦</span>
          <span className="home-art-spark home-art-spark-two">✧</span>
        </div>
      </section>

      <section className="stats-grid" aria-label="Lead summary">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon violet">▤</span>
            <span className="stat-caption">COMPANIES WITH CONTACTS</span>
          </div>
          <strong className="stat-value">
            {companiesQuery.isLoading ? "—" : leads.length}
          </strong>
          <span className="stat-foot">Included in your Lead pipeline</span>
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
        <Link className="overview-action" href="/websites">
          <span className="stat-icon green">◎</span>
          <span>
            <strong>Browse websites</strong>
            <small>Review saved websites or start a new crawl.</small>
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
        ) : recentLeads.length === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-symbol">▤</span>
            <strong>
              {companies.length === 0
                ? "Your company database is empty"
                : "No companies in Leads yet"}
            </strong>
            <span>
              {companies.length === 0
                ? "Add or discover a company to start building your database."
                : "Add a contact to a company in Companies to move it into your pipeline."}
            </span>
            <Link className="text-link" href="/companies">
              Go to Companies <span aria-hidden="true">→</span>
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
                {recentLeads.map((company) => (
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
