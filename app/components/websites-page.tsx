"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWebsites, updateWebsite } from "@/lib/api";
import type {
  WebsiteRecord,
  WebsitePageType,
  WebsiteUpdateInput,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";

const pageTypes: WebsitePageType[] = [
  "business_site",
  "business_listing",
  "article",
  "blog",
  "news",
  "ecommerce",
  "social_media",
  "cms",
  "software_tool",
  "documentation",
  "forum",
  "media",
  "other",
];
const pageSizes = [10, 25, 50];

type WebsiteSortKey =
  | "website"
  | "status"
  | "website_type"
  | "site_topic"
  | "language"
  | "crawl"
  | "crawled_at";

type WebsiteSort = {
  key: WebsiteSortKey;
  direction: "ascending" | "descending";
};

function getCrawlStatus(website: WebsiteRecord) {
  return (
    website.crawl_job_status ??
    (website.is_crawled ? "succeeded" : "not_queued")
  );
}

function compareWebsites(
  left: WebsiteRecord,
  right: WebsiteRecord,
  key: WebsiteSortKey,
  direction: WebsiteSort["direction"],
): number {
  if (key === "crawled_at") {
    const leftTime = left.crawled_at ? Date.parse(left.crawled_at) : Number.NaN;
    const rightTime = right.crawled_at
      ? Date.parse(right.crawled_at)
      : Number.NaN;
    const leftHasDate = Number.isFinite(leftTime);
    const rightHasDate = Number.isFinite(rightTime);
    if (!leftHasDate || !rightHasDate) {
      return leftHasDate === rightHasDate ? 0 : leftHasDate ? -1 : 1;
    }
    return direction === "ascending"
      ? leftTime - rightTime
      : rightTime - leftTime;
  }

  const valueFor = (website: WebsiteRecord) => {
    switch (key) {
      case "website":
        return website.domain;
      case "status":
        return website.status;
      case "website_type":
        return website.page_type ?? "";
      case "site_topic":
        return website.site_topic.join(", ");
      case "language":
        return website.language ?? "";
      case "crawl":
        return getCrawlStatus(website);
    }
  };
  const comparison = valueFor(left).localeCompare(valueFor(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "ascending" ? comparison : -comparison;
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: WebsiteSortKey;
  sort: WebsiteSort | null;
  onSort: (key: WebsiteSortKey) => void;
}) {
  const isActive = sort?.key === sortKey;
  const nextDirection =
    isActive && sort.direction === "ascending" ? "descending" : "ascending";
  return (
    <th aria-sort={isActive ? sort.direction : "none"}>
      <button
        aria-label={`Sort by ${label}, ${nextDirection}`}
        className="website-sort-button"
        onClick={() => onSort(sortKey)}
        type="button"
      >
        {label}
        <span aria-hidden="true" className="website-sort-indicator">
          {isActive ? (sort.direction === "ascending" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function WebsitesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<WebsiteSort | null>(null);
  const [siteType, setSiteType] = useState<"all" | WebsiteRecord["site_type"]>(
    "all",
  );
  const [category, setCategory] = useState("all");
  const [discoverySource, setDiscoverySource] = useState("all");
  const [pageType, setPageType] = useState("all");
  const [crawlStatus, setCrawlStatus] = useState<
    "all" | "crawled" | "not_crawled"
  >("all");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>(
    {},
  );
  const websitesQuery = useQuery({
    queryKey: ["websites"],
    queryFn: getWebsites,
  });
  const updateMutation = useMutation({
    mutationFn: ({
      websiteId,
      input,
    }: {
      websiteId: string;
      input: WebsiteUpdateInput;
    }) => updateWebsite(websiteId, input),
    onSuccess: (updatedWebsite) => {
      queryClient.setQueryData<WebsiteRecord[]>(["websites"], (websites) =>
        websites?.map((website) =>
          website.id === updatedWebsite.id ? updatedWebsite : website,
        ),
      );
    },
  });
  const websites = websitesQuery.data;
  const websiteCount = websites?.length ?? 0;
  const categories = Array.from(
    new Set(
      (websites ?? []).flatMap((website) =>
        website.site_topic.length
          ? website.site_topic
          : ["unclassified"],
      ),
    ),
  ).sort();
  const discoverySources = Array.from(
    new Set(
      (websites ?? []).flatMap((website) =>
        [website.discovery_source, website.discovery_provider].filter(
          (source): source is string => source !== null,
        ),
      ),
    ),
  ).sort();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredWebsites = (websites ?? []).filter((website) => {
    if (siteType !== "all" && website.site_type !== siteType) return false;
    if (pageType !== "all" && website.page_type !== pageType) return false;
    if (
      category !== "all" &&
      !(website.site_topic.length
        ? website.site_topic.includes(category)
        : category === "unclassified")
    ) {
      return false;
    }
    if (
      discoverySource !== "all" &&
      website.discovery_source !== discoverySource &&
      website.discovery_provider !== discoverySource
    ) {
      return false;
    }
    if (crawlStatus === "crawled" && !website.is_crawled) return false;
    if (crawlStatus === "not_crawled" && website.is_crawled) return false;
    if (!normalizedSearch) return true;
    return [
      website.website_url,
      website.domain,
      website.category ?? "",
      website.page_type ?? "",
      website.site_topic.join(" "),
      website.language ?? "",
      website.discovery_source,
      website.discovery_provider ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });
  const sortedWebsites = sort
    ? [...filteredWebsites].sort((left, right) =>
        compareWebsites(left, right, sort.key, sort.direction),
      )
    : filteredWebsites;
  const pageCount = Math.max(1, Math.ceil(filteredWebsites.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const paginatedWebsites = sortedWebsites.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );

  function updateWebsiteField(websiteId: string, input: WebsiteUpdateInput) {
    updateMutation.mutate({ websiteId, input });
  }

  function resetPage() {
    setCurrentPage(1);
  }

  function toggleSort(key: WebsiteSortKey) {
    setCurrentPage(1);
    setSort((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">WEBSITE REGISTRY</p>
          <h1>Websites</h1>
          <p className="heading-copy">
            Browse unique discovered domains, inspect crawl signals, and
            classify each site.
          </p>
        </div>
      </section>

      <section className="panel website-registry-panel">
        <div className="website-registry-toolbar">
          <label className="filter-input">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">
              Search domains, categories, and sources
            </span>
            <input
              onChange={(event) => {
                resetPage();
                setSearch(event.target.value);
              }}
              placeholder="Search domains, categories, or sources"
              value={search}
            />
          </label>
          <label className="select-filter">
            <span className="sr-only">Filter by site type</span>
            <select
              onChange={(event) => {
                resetPage();
                setSiteType(
                  event.target.value as "all" | WebsiteRecord["site_type"],
                );
              }}
              value={siteType}
            >
              <option value="all">All site types</option>
              <option value="normal">Normal sites</option>
              <option value="listing">Listing sites</option>
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Filter by website type</span>
            <select
              onChange={(event) => {
                resetPage();
                setPageType(event.target.value);
              }}
              value={pageType}
            >
              <option value="all">All website types</option>
              {pageTypes.map((value) => (
                <option key={value} value={value}>
                  {formatSiteType(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Filter by topic category</span>
            <select
              onChange={(event) => {
                resetPage();
                setCategory(event.target.value);
              }}
              value={category}
            >
              <option value="all">All topic categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value === "unclassified"
                    ? "Unclassified"
                    : formatSiteType(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Filter by discovery source</span>
            <select
              onChange={(event) => {
                resetPage();
                setDiscoverySource(event.target.value);
              }}
              value={discoverySource}
            >
              <option value="all">All discovery sources</option>
              {discoverySources.map((value) => (
                <option key={value} value={value}>
                  {formatDiscoverySource(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Filter by crawl status</span>
            <select
              onChange={(event) => {
                resetPage();
                setCrawlStatus(
                  event.target.value as "all" | "crawled" | "not_crawled",
                );
              }}
              value={crawlStatus}
            >
              <option value="all">All crawl statuses</option>
              <option value="crawled">Crawled</option>
              <option value="not_crawled">Not crawled</option>
            </select>
          </label>
          <button
            aria-label="Refresh websites"
            className="icon-button refresh-button"
            disabled={websitesQuery.isFetching}
            onClick={() => void websitesQuery.refetch()}
            type="button"
          >
            ↻
          </button>
        </div>

        {updateMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not update website classification: {updateMutation.error.message}
          </div>
        )}

        {websitesQuery.isError ? (
          <div className="query-error" role="alert">
            <strong>Could not load websites.</strong>
            <span>{websitesQuery.error.message}</span>
            <button
              className="button button-secondary"
              onClick={() => void websitesQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : websitesQuery.isLoading ? (
          <div className="table-state" role="status">
            Loading websites...
          </div>
        ) : filteredWebsites.length === 0 ? (
          <div className="empty-state table-state">
            <span className="empty-symbol" aria-hidden="true">↗</span>
            <strong>
              {websiteCount === 0
                ? "No websites registered yet"
                : "No websites match your filters"}
            </strong>
            <span>
              {websiteCount === 0
                ? "Websites are added through discovery or crawl jobs."
                : "Try another search or site type."}
            </span>
          </div>
        ) : (
          <>
            <div
              aria-label="Website registry"
              className="table-scroll website-table-scroll"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <SortableHeader
                      label="WEBSITE"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="website"
                    />
                    <SortableHeader
                      label="STATUS"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="status"
                    />
                    <SortableHeader
                      label="WEBSITE TYPE"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="website_type"
                    />
                    <SortableHeader
                      label="SITE TOPIC"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="site_topic"
                    />
                    <SortableHeader
                      label="LANGUAGE"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="language"
                    />
                    <SortableHeader
                      label="CRAWL"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="crawl"
                    />
                    <SortableHeader
                      label="CRAWLED AT"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="crawled_at"
                    />
                  </tr>
                </thead>
                <tbody>
                  {paginatedWebsites.map((website) => (
                    <tr key={website.id}>
                      <td className="website-url-cell">
                        <span className="website-domain-links">
                          <Link
                            className="website-domain-link"
                            href={`/websites/${website.id}`}
                            title={`View details for ${website.domain}`}
                          >
                            {website.domain}
                          </Link>
                          <a
                            aria-label={`Open ${website.domain} in a new tab`}
                            className="website-external-link"
                            href={website.website_url}
                            rel="noopener noreferrer"
                            target="_blank"
                            title="Open website in a new tab"
                          >
                            <span aria-hidden="true">↗</span>
                          </a>
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">{website.status}</span>
                      </td>
                      <td>
                        <select
                          aria-label={`Website type for ${website.domain}`}
                          className="website-review-select"
                          disabled={updateMutation.isPending}
                          onChange={(event) =>
                            updateWebsiteField(website.id, {
                              page_type:
                                pageTypes.find(
                                  (value) => value === event.target.value,
                                ) ?? null,
                            })
                          }
                          value={website.page_type ?? ""}
                        >
                          <option value="">Unclassified</option>
                          {pageTypes.map((value) => (
                            <option key={value} value={value}>
                              {formatSiteType(value)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Site topic for ${website.domain}`}
                          className="website-review-input"
                          disabled={updateMutation.isPending}
                          onBlur={() => {
                            const topics = (
                              topicDrafts[website.id] ??
                              website.site_topic.join(", ")
                            )
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean);
                            if (
                              topics.join(", ") !==
                              website.site_topic.join(", ")
                            ) {
                              updateWebsiteField(website.id, {
                                site_topic: topics,
                              });
                            }
                          }}
                          onChange={(event) =>
                            setTopicDrafts((drafts) => ({
                              ...drafts,
                              [website.id]: event.target.value,
                            }))
                          }
                          placeholder="food, furniture"
                          value={
                            topicDrafts[website.id] ??
                            website.site_topic.join(", ")
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Language for ${website.domain}`}
                          className="website-review-input website-language-input"
                          disabled={updateMutation.isPending}
                          onBlur={() => {
                            const language = (
                              languageDrafts[website.id] ??
                              website.language ??
                              ""
                            ).trim();
                            if (language !== (website.language ?? "")) {
                              updateWebsiteField(website.id, {
                                language: language || null,
                              });
                            }
                          }}
                          onChange={(event) =>
                            setLanguageDrafts((drafts) => ({
                              ...drafts,
                              [website.id]: event.target.value,
                            }))
                          }
                          placeholder="en"
                          value={
                            languageDrafts[website.id] ??
                            website.language ??
                            ""
                          }
                        />
                      </td>
                      <td>
                        <span
                          className={`status-badge website-crawl-${getCrawlStatus(website)}`}
                        >
                          {getCrawlStatus(website).replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        {website.crawled_at
                          ? new Date(website.crawled_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing{" "}
                {filteredWebsites.length === 0
                  ? 0
                  : (visiblePage - 1) * pageSize + 1}
                –{Math.min(visiblePage * pageSize, filteredWebsites.length)} of{" "}
                {filteredWebsites.length} websites
                {filteredWebsites.length !== websiteCount &&
                  ` (from ${websiteCount} total)`}
              </span>
              <div className="pagination-controls">
                <label>
                  Rows
                  <select
                    aria-label="Rows per page"
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      resetPage();
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
                  onClick={() => setCurrentPage(visiblePage - 1)}
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
                  onClick={() => setCurrentPage(visiblePage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function formatDiscoverySource(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}
