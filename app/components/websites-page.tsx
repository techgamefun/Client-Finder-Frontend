"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  addWebsitesToLeads,
  getWebsiteCorpusWords,
  getWebsites,
  reclassifyWebsite,
  reclassifyUnclassifiedWebsites,
  updateWebsite,
  updateWebsitesStatus,
} from "@/lib/api";
import type {
  WebsiteRecord,
  WebsitePageType,
  WebsiteStatus,
  WebsiteUpdateInput,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";
import { CrawlWebsiteDialog } from "./crawler-page";
import { useToast } from "./toast-provider";

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
const websiteStatuses: WebsiteStatus[] = ["new", "lead", "checked"];
const websiteSelectionLimit = 500;

type WebsiteSortKey =
  | "website"
  | "website_type"
  | "site_topic"
  | "language"
  | "crawled_at"
  | "hypestat_monthly_visits"
  | "hypestat_referring_domains"
  | "hypestat_global_rank"
  | "hypestat_country"
  | "hypestat_backlink_countries"
  | "hypestat_audience_countries";

type WebsiteSort = {
  key: WebsiteSortKey;
  direction: "ascending" | "descending";
};

type WebsiteFacet =
  | "status"
  | "page_type"
  | "category"
  | "discovery_source"
  | "hypestat_country"
  | "backlink_country"
  | "audience_country";

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

  const numericValueFor = (website: WebsiteRecord) => {
    switch (key) {
      case "hypestat_monthly_visits":
        return website.hypestat_monthly_visits;
      case "hypestat_referring_domains":
        return website.hypestat_referring_domains;
      case "hypestat_global_rank":
        return website.hypestat_global_rank;
      default:
        return undefined;
    }
  };
  const leftNumber = numericValueFor(left);
  const rightNumber = numericValueFor(right);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    if (leftNumber === null || rightNumber === null) {
      return leftNumber === rightNumber ? 0 : leftNumber === null ? 1 : -1;
    }
    return direction === "ascending"
      ? leftNumber - rightNumber
      : rightNumber - leftNumber;
  }

  const valueFor = (website: WebsiteRecord) => {
    switch (key) {
      case "website":
        return website.domain;
      case "website_type":
        return website.page_type ?? "";
      case "site_topic":
        return website.site_topic.join(", ");
      case "language":
        return website.language ?? "";
      case "hypestat_country":
        return website.hypestat_country ?? "";
      case "hypestat_backlink_countries":
        return website.hypestat_referring_domains_by_country
          .map(({ country, domains }) => `${country} ${domains}`)
          .join(", ");
      case "hypestat_audience_countries":
        return website.hypestat_audience_countries.join(", ");
      case "hypestat_monthly_visits":
      case "hypestat_referring_domains":
      case "hypestat_global_rank":
        return "";
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

function snapWebsiteTableToColumn(element: HTMLDivElement) {
  const containerLeft = element.getBoundingClientRect().left;
  const frozenColumn = element.querySelector<HTMLTableCellElement>(
    "thead th:nth-child(2)",
  );
  if (!frozenColumn) return;

  const frozenWidth = frozenColumn.getBoundingClientRect().right - containerLeft;
  const currentScroll = element.scrollLeft;
  const maxScroll = element.scrollWidth - element.clientWidth;
  const targets = Array.from(
    element.querySelectorAll<HTMLTableCellElement>(
      "thead th:nth-child(n + 3)",
    ),
  ).map((cell) => {
    const columnLeft =
      cell.getBoundingClientRect().left - containerLeft + currentScroll;
    return Math.max(0, Math.min(maxScroll, columnLeft - frozenWidth));
  });
  const nearestTarget = targets.reduce(
    (nearest, target) =>
      Math.abs(target - currentScroll) < Math.abs(nearest - currentScroll)
        ? target
        : nearest,
    0,
  );

  if (Math.abs(nearestTarget - currentScroll) > 1) {
    element.scrollTo({ left: nearestTarget, behavior: "smooth" });
  }
}

export function WebsitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenCrawlDialog = searchParams.get("crawl") === "1";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const websiteScrollTimerRef = useRef<number | null>(null);
  const selectPageRef = useRef<HTMLInputElement>(null);
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkStatus, setBulkStatus] = useState<WebsiteStatus | "">("");

  useEffect(
    () => () => {
      if (websiteScrollTimerRef.current !== null) {
        window.clearTimeout(websiteScrollTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!shouldOpenCrawlDialog) return;
    window.requestAnimationFrame(() => setCrawlDialogOpen(true));
    router.replace("/websites", { scroll: false });
  }, [router, shouldOpenCrawlDialog]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<WebsiteSort | null>(null);
  const [category, setCategory] = useState("all");
  const [discoverySource, setDiscoverySource] = useState("all");
  const [pageType, setPageType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WebsiteStatus | "all">(
    "all",
  );
  const [minimumMonthlyVisits, setMinimumMonthlyVisits] = useState("");
  const [minimumReferringDomains, setMinimumReferringDomains] = useState("");
  const [maximumGlobalRank, setMaximumGlobalRank] = useState("");
  const [hypestatCountry, setHypestatCountry] = useState("all");
  const [backlinkCountry, setBacklinkCountry] = useState("all");
  const [audienceCountry, setAudienceCountry] = useState("all");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>(
    {},
  );
  const websitesQuery = useQuery({
    queryKey: ["websites"],
    queryFn: getWebsites,
  });
  const corpusWordsQuery = useQuery({
    queryKey: ["website-corpus-words"],
    queryFn: getWebsiteCorpusWords,
  });
  const corpusWordsByWebsite = new Map(
    (corpusWordsQuery.data?.websites ?? []).map(
      (analysis) => [analysis.website_id, analysis] as const,
    ),
  );
  const updateMutation = useMutation({
    mutationFn: ({
      websiteId,
      input,
    }: {
      websiteId: string;
      input: WebsiteUpdateInput;
    }) => updateWebsite(websiteId, input),
    onSuccess: (updatedWebsite, variables) => {
      queryClient.setQueryData<WebsiteRecord[]>(["websites"], (websites) =>
        websites?.map((website) =>
          website.id === updatedWebsite.id ? updatedWebsite : website,
        ),
      );
      if (variables.input.status) {
        showToast({
          type: "success",
          title: "Website status updated",
          message: `${updatedWebsite.domain} is now marked ${formatWebsiteStatus(updatedWebsite.status)}.`,
        });
      }
    },
  });
  const addToLeadMutation = useMutation({
    mutationFn: addWebsitesToLeads,
    onSuccess: async () => {
      setSelectedWebsiteIds(new Set());
      setBulkStatus("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
      ]);
    },
  });
  const batchStatusMutation = useMutation({
    mutationFn: ({
      websiteIds,
      status,
    }: {
      websiteIds: string[];
      status: WebsiteStatus;
    }) => updateWebsitesStatus(websiteIds, status),
    onSuccess: async (result, variables) => {
      setSelectedWebsiteIds(new Set());
      setBulkStatus("");
      await queryClient.invalidateQueries({ queryKey: ["websites"] });
      showToast({
        type: "success",
        title: "Website statuses updated",
        message: `Changed ${result.updated_count} website${result.updated_count === 1 ? "" : "s"} to ${formatWebsiteStatus(variables.status)}.${result.not_found_count ? ` ${result.not_found_count} selected website${result.not_found_count === 1 ? " was" : "s were"} no longer available.` : ""}`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not update website statuses",
        message: error.message,
      });
    },
  });
  const reclassifyMutation = useMutation({
    mutationFn: reclassifyWebsite,
    onSuccess: (updatedWebsite) => {
      queryClient.setQueryData<WebsiteRecord[]>(["websites"], (websites) =>
        websites?.map((website) =>
          website.id === updatedWebsite.id ? updatedWebsite : website,
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: ["website-detail", updatedWebsite.id],
      });
    },
  });
  const reclassifyAllMutation = useMutation({
    mutationFn: reclassifyUnclassifiedWebsites,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
        queryClient.invalidateQueries({ queryKey: ["website-detail"] }),
      ]);
    },
  });
  const allWebsites = websitesQuery.data ?? [];
  const websites = allWebsites.filter((website) => website.is_crawled);
  const websiteCount = websites.length;
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
  const hypestatCountries = Array.from(
    new Set(
      websites
        .map((website) => website.hypestat_country)
        .filter((country): country is string => country !== null),
    ),
  ).sort();
  const backlinkCountries = Array.from(
    new Set(
      websites.flatMap((website) =>
        website.hypestat_referring_domains_by_country.map(
          (item) => item.country,
        ),
      ),
    ),
  ).sort();
  const audienceCountries = Array.from(
    new Set(
      websites.flatMap((website) => website.hypestat_audience_countries),
    ),
  ).sort();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const numericFilter = (value: string) => {
    const parsed = Number(value);
    return value.trim() && Number.isFinite(parsed) ? parsed : null;
  };
  function matchesWebsiteFilters(
    website: WebsiteRecord,
    excludedFacet?: WebsiteFacet,
  ): boolean {
    if (
      excludedFacet !== "status" &&
      statusFilter !== "all" &&
      website.status !== statusFilter
    ) {
      return false;
    }
    if (
      excludedFacet !== "page_type" &&
      pageType !== "all" &&
      website.page_type !== pageType
    ) {
      return false;
    }
    if (
      excludedFacet !== "category" &&
      category !== "all" &&
      !(website.site_topic.length
        ? website.site_topic.includes(category)
        : category === "unclassified")
    ) {
      return false;
    }
    if (
      excludedFacet !== "discovery_source" &&
      discoverySource !== "all" &&
      website.discovery_source !== discoverySource &&
      website.discovery_provider !== discoverySource
    ) {
      return false;
    }
    const minimumVisits = numericFilter(minimumMonthlyVisits);
    if (
      minimumVisits !== null &&
      (website.hypestat_monthly_visits === null ||
        website.hypestat_monthly_visits < minimumVisits)
    ) {
      return false;
    }
    const minimumDomains = numericFilter(minimumReferringDomains);
    if (
      minimumDomains !== null &&
      (website.hypestat_referring_domains === null ||
        website.hypestat_referring_domains < minimumDomains)
    ) {
      return false;
    }
    const maximumRank = numericFilter(maximumGlobalRank);
    if (
      maximumRank !== null &&
      (website.hypestat_global_rank === null ||
        website.hypestat_global_rank > maximumRank)
    ) {
      return false;
    }
    if (
      excludedFacet !== "hypestat_country" &&
      hypestatCountry !== "all" &&
      website.hypestat_country !== hypestatCountry
    ) {
      return false;
    }
    if (
      excludedFacet !== "backlink_country" &&
      backlinkCountry !== "all" &&
      !website.hypestat_referring_domains_by_country.some(
        (item) => item.country === backlinkCountry,
      )
    ) {
      return false;
    }
    if (
      excludedFacet !== "audience_country" &&
      audienceCountry !== "all" &&
      !website.hypestat_audience_countries.includes(audienceCountry)
    ) {
      return false;
    }
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
      website.status,
      website.hypestat_monthly_visits?.toString() ?? "",
      website.hypestat_referring_domains?.toString() ?? "",
      website.hypestat_global_rank?.toString() ?? "",
      website.hypestat_country ?? "",
      website.hypestat_referring_domains_by_country
        .map((item) => item.country)
        .join(" "),
      website.hypestat_audience_countries.join(" "),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  }
  function countWebsiteFacet(
    excludedFacet: WebsiteFacet,
    predicate: (website: WebsiteRecord) => boolean = () => true,
  ): number {
    return websites.filter(
      (website) =>
        matchesWebsiteFilters(website, excludedFacet) && predicate(website),
    ).length;
  }
  const filteredWebsites = websites.filter((website) =>
    matchesWebsiteFilters(website),
  );
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
  const selectedVisibleCount = paginatedWebsites.filter((website) =>
    selectedWebsiteIds.has(website.id),
  ).length;
  const allVisibleSelected =
    paginatedWebsites.length > 0 &&
    selectedVisibleCount === paginatedWebsites.length;
  const hasPartiallySelectedPage =
    selectedVisibleCount > 0 && !allVisibleSelected;
  const selectedCount = selectedWebsiteIds.size;

  useEffect(() => {
    if (selectPageRef.current) {
      selectPageRef.current.indeterminate = hasPartiallySelectedPage;
    }
  }, [hasPartiallySelectedPage]);
  const activeAdvancedFilterCount = [
    minimumMonthlyVisits,
    minimumReferringDomains,
    maximumGlobalRank,
  ].filter(Boolean).length +
    [hypestatCountry, backlinkCountry, audienceCountry].filter(
      (value) => value !== "all",
    ).length;
  const activeFilterCount =
    activeAdvancedFilterCount +
    [pageType, statusFilter, category, discoverySource].filter(
      (value) => value !== "all",
    ).length +
    (search.trim() ? 1 : 0);

  function updateWebsiteField(websiteId: string, input: WebsiteUpdateInput) {
    updateMutation.mutate({ websiteId, input });
  }

  function toggleWebsiteSelection(websiteId: string) {
    if (
      !selectedWebsiteIds.has(websiteId) &&
      selectedWebsiteIds.size >= websiteSelectionLimit
    ) {
      showToast({
        type: "warning",
        title: "Selection limit reached",
        message: `Select up to ${websiteSelectionLimit} websites at a time.`,
      });
      return;
    }
    setSelectedWebsiteIds((current) => {
      const next = new Set(current);
      if (next.has(websiteId)) {
        next.delete(websiteId);
      } else {
        next.add(websiteId);
      }
      return next;
    });
  }

  function togglePageSelection() {
    if (allVisibleSelected) {
      setSelectedWebsiteIds((current) => {
        const next = new Set(current);
        for (const website of paginatedWebsites) {
          next.delete(website.id);
        }
        return next;
      });
      return;
    }

    const websitesToAdd = paginatedWebsites.filter(
      (website) => !selectedWebsiteIds.has(website.id),
    );
    const availableSlots = websiteSelectionLimit - selectedCount;
    if (websitesToAdd.length > availableSlots) {
      showToast({
        type: "warning",
        title: "Selection limit reached",
        message: `Select up to ${websiteSelectionLimit} websites at a time.`,
      });
    }
    setSelectedWebsiteIds((current) => {
      const next = new Set(current);
      for (const website of websitesToAdd.slice(0, availableSlots)) {
        next.add(website.id);
      }
      return next;
    });
  }

  function changeSelectedWebsiteStatus() {
    if (!bulkStatus || selectedCount === 0) return;
    batchStatusMutation.mutate({
      websiteIds: Array.from(selectedWebsiteIds),
      status: bulkStatus,
    });
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
      <h1 className="sr-only">Websites</h1>
      {crawlDialogOpen && (
        <CrawlWebsiteDialog onClose={() => setCrawlDialogOpen(false)} />
      )}

      <section className="website-registry-panel">
        <div className="website-registry-toolbar">
          <label className="filter-input">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <span className="sr-only">
              Search domains, categories, and sources
            </span>
            <input
              onChange={(event) => {
                resetPage();
                setSearch(event.target.value);
              }}
              placeholder="Search websites"
              value={search}
            />
          </label>
          <details className="website-filter-drawer">
            <summary>
              <SlidersHorizontal aria-hidden="true" size={15} strokeWidth={1.8} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="website-active-filter-count">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
            </summary>
            <div className="website-filter-content">
              {activeFilterCount > 0 && (
                <div className="website-filter-popover-heading">
                  <button
                    className="website-clear-filters"
                    onClick={() => {
                      setSearch("");
                      setPageType("all");
                      setStatusFilter("all");
                      setCategory("all");
                      setDiscoverySource("all");
                      setMinimumMonthlyVisits("");
                      setMinimumReferringDomains("");
                      setMaximumGlobalRank("");
                      setHypestatCountry("all");
                      setBacklinkCountry("all");
                      setAudienceCountry("all");
                      resetPage();
                    }}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={13} />
                    Clear all
                  </button>
                </div>
              )}
              <div className="website-filter-group">
                <h2>Site</h2>
                <div className="website-registry-primary-filters">
            <label className="website-filter-field select-filter">
              <span className="website-filter-field-label">Type</span>
              <select
                disabled={
                  batchStatusMutation.isPending || addToLeadMutation.isPending
                }
                onChange={(event) => {
                  resetPage();
                  setPageType(event.target.value);
                }}
                value={pageType}
              >
                <option value="all">
                  All ({countWebsiteFacet("page_type")})
                </option>
                {pageTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatSiteType(value)} (
                    {countWebsiteFacet(
                      "page_type",
                      (website) => website.page_type === value,
                    )}
                    )
                  </option>
                ))}
              </select>
            </label>
            <label className="website-filter-field select-filter">
              <span className="website-filter-field-label">Status</span>
              <select
                onChange={(event) => {
                  resetPage();
                  const nextStatus = websiteStatuses.find(
                    (value) => value === event.target.value,
                  );
                  setStatusFilter(nextStatus ?? "all");
                }}
                value={statusFilter}
              >
                <option value="all">
                  All ({countWebsiteFacet("status")})
                </option>
                {websiteStatuses.map((value) => (
                  <option key={value} value={value}>
                    {formatWebsiteStatus(value)} (
                    {countWebsiteFacet(
                      "status",
                      (website) => website.status === value,
                    )}
                    )
                  </option>
                ))}
              </select>
            </label>
            <label className="website-filter-field select-filter">
              <span className="website-filter-field-label">Topic</span>
              <select
                onChange={(event) => {
                  resetPage();
                  setCategory(event.target.value);
                }}
                value={category}
              >
                <option value="all">
                  All ({countWebsiteFacet("category")})
                </option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value === "unclassified"
                      ? "Unclassified"
                      : formatSiteType(value)}{" "}
                    (
                    {countWebsiteFacet("category", (website) =>
                      website.site_topic.length
                        ? website.site_topic.includes(value)
                        : value === "unclassified",
                    )}
                    )
                  </option>
                ))}
              </select>
            </label>
            <label className="website-filter-field select-filter">
              <span className="website-filter-field-label">Source</span>
              <select
                onChange={(event) => {
                  resetPage();
                  setDiscoverySource(event.target.value);
                }}
                value={discoverySource}
              >
                <option value="all">
                  All ({countWebsiteFacet("discovery_source")})
                </option>
                {discoverySources.map((value) => (
                  <option key={value} value={value}>
                    {formatDiscoverySource(value)} (
                    {countWebsiteFacet(
                      "discovery_source",
                      (website) =>
                        website.discovery_source === value ||
                        website.discovery_provider === value,
                    )}
                    )
                  </option>
                ))}
              </select>
            </label>
                </div>
              </div>
              <div className="website-filter-group">
                <h2>Traffic &amp; audience</h2>
            <div className="website-advanced-filter-grid">
              <label className="website-filter-field hypestat-table-filter">
                <span className="website-filter-field-label">
                  Min. monthly visits
                </span>
                <input
                  min="0"
                  onChange={(event) => {
                    resetPage();
                    setMinimumMonthlyVisits(event.target.value);
                  }}
                  placeholder="e.g. 10,000"
                  type="number"
                  value={minimumMonthlyVisits}
                />
              </label>
              <label className="website-filter-field hypestat-table-filter">
                <span className="website-filter-field-label">
                  Min. referring domains
                </span>
                <input
                  min="0"
                  onChange={(event) => {
                    resetPage();
                    setMinimumReferringDomains(event.target.value);
                  }}
                  placeholder="e.g. 100"
                  type="number"
                  value={minimumReferringDomains}
                />
              </label>
              <label className="website-filter-field hypestat-table-filter">
                <span className="website-filter-field-label">
                  Max. global rank
                </span>
                <input
                  min="1"
                  onChange={(event) => {
                    resetPage();
                    setMaximumGlobalRank(event.target.value);
                  }}
                  placeholder="e.g. 50,000"
                  type="number"
                  value={maximumGlobalRank}
                />
              </label>
              <label className="website-filter-field select-filter">
                <span className="website-filter-field-label">
                  HypeStat country
                </span>
                <select
                  onChange={(event) => {
                    resetPage();
                    setHypestatCountry(event.target.value);
                  }}
                  value={hypestatCountry}
                >
                  <option value="all">
                    All ({countWebsiteFacet("hypestat_country")})
                  </option>
                  {hypestatCountries.map((value) => (
                    <option key={value} value={value}>
                      {value} (
                      {countWebsiteFacet(
                        "hypestat_country",
                        (website) => website.hypestat_country === value,
                      )}
                      )
                    </option>
                  ))}
                </select>
              </label>
              <label className="website-filter-field select-filter">
                <span className="website-filter-field-label">
                  Backlink country
                </span>
                <select
                  onChange={(event) => {
                    resetPage();
                    setBacklinkCountry(event.target.value);
                  }}
                  value={backlinkCountry}
                >
                  <option value="all">
                    All ({countWebsiteFacet("backlink_country")})
                  </option>
                  {backlinkCountries.map((value) => (
                    <option key={value} value={value}>
                      {value} (
                      {countWebsiteFacet("backlink_country", (website) =>
                        website.hypestat_referring_domains_by_country.some(
                          (item) => item.country === value,
                        ),
                      )}
                      )
                    </option>
                  ))}
                </select>
              </label>
              <label className="website-filter-field select-filter">
                <span className="website-filter-field-label">
                  Audience country
                </span>
                <select
                  onChange={(event) => {
                    resetPage();
                    setAudienceCountry(event.target.value);
                  }}
                  value={audienceCountry}
                >
                  <option value="all">
                    All ({countWebsiteFacet("audience_country")})
                  </option>
                  {audienceCountries.map((value) => (
                    <option key={value} value={value}>
                      {value} (
                      {countWebsiteFacet("audience_country", (website) =>
                        website.hypestat_audience_countries.includes(value),
                      )}
                      )
                    </option>
                  ))}
                </select>
              </label>
            </div>
              </div>
            </div>
          </details>
          <div className="website-registry-actions">
            <button
              className="button button-secondary"
              disabled={
                websitesQuery.isLoading ||
                updateMutation.isPending ||
                addToLeadMutation.isPending ||
                batchStatusMutation.isPending ||
                reclassifyMutation.isPending ||
                reclassifyAllMutation.isPending
              }
              onClick={() => reclassifyAllMutation.mutate()}
              title="Recomputes both fields for all indexed websites with an unclassified Website Type or empty Site Topic. Uses saved indexed data."
              type="button"
            >
              {reclassifyAllMutation.isPending ? (
                "Recomputing all…"
              ) : (
                <>
                  <span className="website-recompute-label">
                    Recompute all missing
                  </span>
                  <span className="website-recompute-short">Recompute</span>
                </>
              )}
            </button>
            <button
              aria-label="Refresh websites"
              className="icon-button refresh-button"
              disabled={websitesQuery.isFetching}
              onClick={() => void websitesQuery.refetch()}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div
            aria-label="Selected website actions"
            className="website-bulk-toolbar"
            role="region"
          >
            <span className="website-bulk-selection-count">
              {selectedCount} selected
            </span>
            <label className="website-bulk-status">
              <span>Change status</span>
              <select
                onChange={(event) => {
                  const nextStatus = websiteStatuses.find(
                    (value) => value === event.target.value,
                  );
                  setBulkStatus(nextStatus ?? "");
                }}
                value={bulkStatus}
              >
                <option value="">Choose status…</option>
                {websiteStatuses.map((value) => (
                  <option key={value} value={value}>
                    {formatWebsiteStatus(value)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button-secondary"
              disabled={
                !bulkStatus ||
                batchStatusMutation.isPending ||
                addToLeadMutation.isPending
              }
              onClick={changeSelectedWebsiteStatus}
              type="button"
            >
              {batchStatusMutation.isPending ? "Updating…" : "Apply status"}
            </button>
            <button
              className="button button-primary"
              disabled={
                batchStatusMutation.isPending || addToLeadMutation.isPending
              }
              onClick={() =>
                addToLeadMutation.mutate(Array.from(selectedWebsiteIds))
              }
              type="button"
            >
              {addToLeadMutation.isPending
                ? "Adding to Lead…"
                : "Add selected to Lead"}
            </button>
            <button
              className="website-clear-selection"
              disabled={
                batchStatusMutation.isPending || addToLeadMutation.isPending
              }
              onClick={() => setSelectedWebsiteIds(new Set())}
              type="button"
            >
              Clear selection
            </button>
          </div>
        )}

        {batchStatusMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not update website statuses:{" "}
            {batchStatusMutation.error.message}
          </div>
        )}
        {updateMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not update website: {updateMutation.error.message}
          </div>
        )}
        {addToLeadMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not add websites to Leads: {addToLeadMutation.error.message}
          </div>
        )}
        {addToLeadMutation.isSuccess && (
          <div className="alert alert-success" role="status">
            Created {addToLeadMutation.data.created_count} companies and marked{" "}
            {addToLeadMutation.data.status_updated_count} websites as Lead.
            {addToLeadMutation.data.already_existing_count > 0 &&
              ` ${addToLeadMutation.data.already_existing_count} already had a company.`}
            {addToLeadMutation.data.skipped_listing_count > 0 &&
              ` ${addToLeadMutation.data.skipped_listing_count} listing websites were skipped.`}
            {addToLeadMutation.data.skipped_uncrawled_count > 0 &&
              ` ${addToLeadMutation.data.skipped_uncrawled_count} unindexed websites were skipped.`}
            {addToLeadMutation.data.not_found_count > 0 &&
              ` ${addToLeadMutation.data.not_found_count} websites were no longer available.`}
          </div>
        )}
        {reclassifyMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not recompute website classification:{" "}
            {reclassifyMutation.error.message}
          </div>
        )}
        {reclassifyMutation.isSuccess && (
          <div className="alert alert-success" role="status">
            Recomputed Website Type and Site Topic for{" "}
            {reclassifyMutation.data.domain}.
          </div>
        )}
        {reclassifyAllMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not recompute missing website classifications:{" "}
            {reclassifyAllMutation.error.message}
          </div>
        )}
        {reclassifyAllMutation.isSuccess && (
          <div className="alert alert-success" role="status">
            Recomputed both fields for{" "}
            {reclassifyAllMutation.data.recomputed_count} of{" "}
            {reclassifyAllMutation.data.eligible_count} eligible websites.
            {reclassifyAllMutation.data.skipped_count > 0 &&
              ` Skipped ${reclassifyAllMutation.data.skipped_count} without saved homepage signals.`}
          </div>
        )}
        {corpusWordsQuery.isError && (
          <div className="alert alert-error" role="alert">
            Could not load per-website keywords:{" "}
            {corpusWordsQuery.error.message}{" "}
            <button
              className="button button-secondary"
              onClick={() => void corpusWordsQuery.refetch()}
              type="button"
            >
              Retry analysis
            </button>
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
              {allWebsites.length === 0
                ? "No websites registered yet"
                : websiteCount === 0
                  ? "No successfully indexed websites yet"
                  : "No websites match your filters"}
            </strong>
            <span>
              {allWebsites.length === 0
                ? "Websites are added through discovery or indexing jobs."
                : websiteCount === 0
                  ? "Websites appear here after indexing succeeds."
                  : "Try another search or site type."}
            </span>
          </div>
        ) : (
          <>
            <div
              aria-label="Website registry"
              className="table-scroll website-table-scroll"
              onScroll={(event) => {
                const element = event.currentTarget;
                if (websiteScrollTimerRef.current !== null) {
                  window.clearTimeout(websiteScrollTimerRef.current);
                }
                websiteScrollTimerRef.current = window.setTimeout(() => {
                  websiteScrollTimerRef.current = null;
                  snapWebsiteTableToColumn(element);
                }, 120);
              }}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th className="website-row-number" scope="col">
                      <span className="website-selection-heading">
                        <input
                          aria-label={
                            allVisibleSelected
                              ? "Deselect all websites on this page"
                              : "Select all websites on this page"
                          }
                          checked={allVisibleSelected}
                          disabled={
                            batchStatusMutation.isPending ||
                            addToLeadMutation.isPending
                          }
                          onChange={togglePageSelection}
                          ref={selectPageRef}
                          type="checkbox"
                        />
                        <span aria-hidden="true">#</span>
                      </span>
                    </th>
                    <SortableHeader
                      label="Website"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="website"
                    />
                    <th scope="col">Keywords</th>
                    <SortableHeader
                      label="Website type"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="website_type"
                    />
                    <SortableHeader
                      label="Site topic"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="site_topic"
                    />
                    <SortableHeader
                      label="Est. monthly visits"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_monthly_visits"
                    />
                    <SortableHeader
                      label="Referring domains"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_referring_domains"
                    />
                    <SortableHeader
                      label="HypeStat global rank"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_global_rank"
                    />
                    <SortableHeader
                      label="Country"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_country"
                    />
                    <SortableHeader
                      label="Referring domains by country"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_backlink_countries"
                    />
                    <SortableHeader
                      label="Audience countries"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_audience_countries"
                    />
                    <SortableHeader
                      label="Language"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="language"
                    />
                    <SortableHeader
                      label="Crawled at"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="crawled_at"
                    />
                  </tr>
                </thead>
                <tbody>
                  {paginatedWebsites.map((website, index) => (
                    <tr key={website.id}>
                      <td className="website-row-number">
                        <span className="website-selection-row">
                          <input
                            aria-label={`Select ${website.domain}`}
                            checked={selectedWebsiteIds.has(website.id)}
                            disabled={
                              batchStatusMutation.isPending ||
                              addToLeadMutation.isPending
                            }
                            onChange={() =>
                              toggleWebsiteSelection(website.id)
                            }
                            type="checkbox"
                          />
                          <span>
                            {(visiblePage - 1) * pageSize + index + 1}
                          </span>
                        </span>
                      </td>
                      <td className="website-url-cell">
                        <span className="website-domain-links">
                          <span
                            aria-hidden="true"
                            className="website-favicon-badge"
                          >
                            {website.domain.charAt(0).toUpperCase()}
                            {website.favicon_url && (
                              <Image
                                alt=""
                                className="website-favicon-image"
                                height={16}
                                onError={(event) => {
                                  event.currentTarget.style.visibility = "hidden";
                                }}
                                src={website.favicon_url}
                                unoptimized
                                width={16}
                              />
                            )}
                          </span>
                          <Link
                            className="website-domain-link"
                            href={`/websites/${website.id}`}
                            title={`View details for ${website.domain}`}
                          >
                            {website.domain}
                          </Link>
                          <select
                            aria-label={`Status for ${website.domain}`}
                            className={`website-status-badge website-status-${website.status}`}
                            disabled={
                              updateMutation.isPending ||
                              addToLeadMutation.isPending ||
                              batchStatusMutation.isPending ||
                              reclassifyMutation.isPending ||
                              reclassifyAllMutation.isPending
                            }
                            onChange={(event) => {
                              const nextStatus = websiteStatuses.find(
                                (value) => value === event.target.value,
                              );
                              if (nextStatus) {
                                updateWebsiteField(website.id, {
                                  status: nextStatus,
                                });
                              }
                            }}
                            value={website.status}
                          >
                            {websiteStatuses.map((value) => (
                              <option key={value} value={value}>
                                {formatWebsiteStatus(value)}
                              </option>
                            ))}
                          </select>
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
                      <td className="website-keywords-cell">
                        <div
                          aria-label={`Corpus keywords for ${website.domain}`}
                          className="website-row-keywords"
                        >
                          {corpusWordsQuery.isLoading ? (
                            <span className="website-row-keywords-empty">
                              Analyzing…
                            </span>
                          ) : (corpusWordsByWebsite.get(website.id)?.words
                              .length ?? 0) > 0 ? (
                            corpusWordsByWebsite.get(website.id)?.words
                              .slice(0, 5)
                              .map((stat) => (
                                <span
                                  className="website-keyword-chip"
                                  key={stat.word}
                                  title={`Analysis score: ${stat.score.toFixed(2)}${stat.is_phrase ? " · phrase" : ""}`}
                                >
                                  {stat.word}
                                  {stat.is_phrase && (
                                    <small className="website-keyword-phrase">
                                      phrase
                                    </small>
                                  )}
                                </span>
                              ))
                          ) : (
                            <span className="website-row-keywords-empty">
                              No keywords found
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="website-type-recompute-control">
                          <select
                            aria-label={`Website type for ${website.domain}`}
                            className="website-review-select"
                            disabled={
                              updateMutation.isPending ||
                              addToLeadMutation.isPending ||
                              reclassifyMutation.isPending ||
                              reclassifyAllMutation.isPending
                            }
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
                          <button
                            aria-label={`Recompute Website Type and Site Topic for ${website.domain}`}
                            aria-busy={
                              reclassifyMutation.isPending &&
                              reclassifyMutation.variables === website.id
                            }
                            className="icon-button website-recompute-button"
                            disabled={
                              updateMutation.isPending ||
                              addToLeadMutation.isPending ||
                              reclassifyMutation.isPending ||
                              reclassifyAllMutation.isPending
                            }
                            onClick={() => reclassifyMutation.mutate(website.id)}
                            title="Recompute Website Type and Site Topic from saved indexed data without re-indexing."
                            type="button"
                          >
                            ↻
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          aria-label={`Site topic for ${website.domain}`}
                          className="website-review-input"
                          disabled={
                            updateMutation.isPending ||
                            addToLeadMutation.isPending ||
                            reclassifyMutation.isPending ||
                            reclassifyAllMutation.isPending
                          }
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
                      <td>{formatTableNumber(website.hypestat_monthly_visits)}</td>
                      <td>
                        {formatTableNumber(website.hypestat_referring_domains)}
                      </td>
                      <td>{formatTableNumber(website.hypestat_global_rank)}</td>
                      <td>{website.hypestat_country ?? "—"}</td>
                      <td className="website-hypestat-country-cell">
                        {website.hypestat_referring_domains_by_country.length ? (
                          [...website.hypestat_referring_domains_by_country]
                            .sort((left, right) => right.domains - left.domains)
                            .slice(0, 3)
                            .map(({ country, domains }) => (
                              <span key={country}>
                                {country}: {formatTableNumber(domains)}
                              </span>
                            ))
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="website-hypestat-country-cell">
                        {website.hypestat_audience_countries.length
                          ? website.hypestat_audience_countries.join(", ")
                          : "—"}
                      </td>
                      <td>
                        <input
                          aria-label={`Language for ${website.domain}`}
                          className="website-review-input website-language-input"
                          disabled={
                            updateMutation.isPending ||
                            addToLeadMutation.isPending ||
                            reclassifyMutation.isPending ||
                            reclassifyAllMutation.isPending
                          }
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

function formatWebsiteStatus(status: WebsiteStatus): string {
  return status.charAt(0).toLocaleUpperCase() + status.slice(1);
}

function formatTableNumber(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
        value,
      );
}
