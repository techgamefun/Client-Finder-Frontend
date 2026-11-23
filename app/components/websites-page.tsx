"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  RotateCcw,
  Search,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  addExcludedDomain,
  addExcludedDomainsBatch,
  addWebsitesToLeads,
  fetchMissingWebsiteAhrefsDomainRatings,
  fetchMissingWebsiteHypeStatProfiles,
  fetchMissingWebsitePageSpeedScans,
  getWebsiteCorpusWords,
  getWebsiteEnrichmentCounts,
  getWebsiteRegistryFacets,
  getWebsiteRegistryPage,
  getLeadBatches,
  reclassifyWebsite,
  reclassifyUnclassifiedWebsites,
  updateWebsite,
  updateWebsitesStatus,
  websiteRegistryPageQueryKey,
} from "@/lib/api";
import type {
  ExcludedDomainInput,
  PageSpeedScanSummary,
  WebsiteRecord,
  WebsiteBulkEnrichmentResult,
  WebsitePageType,
  WebsiteRegistryPageParams,
  WebsiteRegistrySortKey,
  WebsiteStatus,
  WebsiteUpdateInput,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";
import { CrawlWebsiteDialog } from "./crawler-page";
import { useToast } from "./toast-provider";
import { TableLoading } from "./page-loading";

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
const EXCLUDED_DOMAIN_BATCH_SIZE = 1000;
const pageSpeedSortOptions: {
  key: WebsiteRegistrySortKey;
  label: string;
}[] = [
  { key: "pagespeed_desktop_performance", label: "Desktop performance" },
  { key: "pagespeed_desktop_accessibility", label: "Desktop accessibility" },
  {
    key: "pagespeed_desktop_best_practices",
    label: "Desktop best practices",
  },
  { key: "pagespeed_desktop_seo", label: "Desktop SEO" },
  { key: "pagespeed_mobile_performance", label: "Mobile performance" },
  { key: "pagespeed_mobile_accessibility", label: "Mobile accessibility" },
  { key: "pagespeed_mobile_best_practices", label: "Mobile best practices" },
  { key: "pagespeed_mobile_seo", label: "Mobile SEO" },
];
const websiteSortOptions: { key: WebsiteRegistrySortKey; label: string }[] = [
  { key: "website", label: "Website" },
  { key: "website_type", label: "Website type" },
  { key: "site_topic", label: "Site topic" },
  { key: "ahrefs_domain_rating", label: "Domain Rating (DR)" },
  ...pageSpeedSortOptions,
  { key: "hypestat_monthly_visits", label: "Monthly visits" },
  { key: "hypestat_referring_domains", label: "Referring domains" },
  { key: "hypestat_global_rank", label: "Global rank" },
  { key: "hypestat_country", label: "Country" },
  { key: "hypestat_backlink_countries", label: "Backlink countries" },
  { key: "hypestat_audience_countries", label: "Audience countries" },
  { key: "language", label: "Language" },
  { key: "crawled_at", label: "Crawled at" },
];
const pageSpeedCategories: {
  key: NonNullable<WebsiteRegistryPageParams["pagespeed_category"]>;
  label: string;
}[] = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best practices" },
  { key: "seo", label: "SEO" },
];

function numericFilter(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function enrichmentQueueMessage(
  result: WebsiteBulkEnrichmentResult,
  itemLabel: string,
): string {
  if (result.queued_website_count === 0) {
    return `No missing ${itemLabel} found among ${result.website_count} websites.`;
  }
  const queued = `${result.queued_website_count} website${result.queued_website_count === 1 ? "" : "s"}`;
  const jobs = `${result.queued_job_count} ${itemLabel} ${result.queued_job_count === 1 ? "job" : "jobs"}`;
  const skipped = `${result.skipped_website_count} already complete or in progress`;
  return `Queued ${queued} (${jobs}); skipped ${skipped}.`;
}

function formatMissingCount(count: number, item: string): string {
  return `${count} ${item}${count === 1 ? "" : "s"} missing`;
}

async function addExcludedDomainsInBatches(
  websites: WebsiteRecord[],
): Promise<{ createdCount: number; updatedCount: number; totalCount: number }> {
  const seenDomains = new Set<string>();
  const exclusions: ExcludedDomainInput[] = [];
  for (const website of websites) {
    const domain = website.domain.trim();
    const normalizedDomain = domain.toLowerCase();
    if (!normalizedDomain || seenDomains.has(normalizedDomain)) continue;
    seenDomains.add(normalizedDomain);
    exclusions.push({ domain, reason: "Manual Exclusion" });
  }
  if (exclusions.length === 0) {
    throw new Error("No selected websites are available to exclude.");
  }

  let createdCount = 0;
  let updatedCount = 0;
  for (
    let start = 0;
    start < exclusions.length;
    start += EXCLUDED_DOMAIN_BATCH_SIZE
  ) {
    const batch = exclusions.slice(start, start + EXCLUDED_DOMAIN_BATCH_SIZE);
    try {
      const result = await addExcludedDomainsBatch(batch);
      createdCount += result.created_count;
      updatedCount += result.updated_count;
    } catch (error) {
      const processedCount = createdCount + updatedCount;
      if (processedCount > 0) {
        const detail =
          error instanceof Error ? error.message : "The request failed.";
        throw new Error(
          `Excluded ${processedCount} of ${exclusions.length} domains before the next batch failed: ${detail}`,
        );
      }
      throw error;
    }
  }

  return {
    createdCount,
    updatedCount,
    totalCount: exclusions.length,
  };
}

type WebsiteSortKey = WebsiteRegistrySortKey;

type WebsiteSort = {
  key: WebsiteSortKey;
  direction: "ascending" | "descending";
};

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

function PageSpeedScoreCell({
  label,
  category,
  scan,
}: {
  label: string;
  category: string;
  scan: PageSpeedScanSummary | null;
}) {
  const score = scan?.category_scores[category] ?? null;
  const scoreTone =
    score === null
      ? "unknown"
      : score >= 90
        ? "good"
        : score >= 50
          ? "needs-work"
          : "poor";
  const scannedDate = scan
    ? new Date(scan.scanned_at).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <td className="website-pagespeed-score-cell" data-label={label}>
      <span
        aria-label={
          score === null ? `${label}: not reported` : `${label}: ${score} / 100`
        }
        className={`website-pagespeed-table-score is-${scoreTone}`}
        title={
          score === null
            ? `${label}: not reported`
            : `${label}: ${score} / 100`
        }
      >
        {score ?? "—"}
      </span>
      {category === "performance" && scannedDate && (
        <small>{scannedDate}</small>
      )}
    </td>
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
  const selectFilteredRef = useRef<HTMLInputElement>(null);
  const addToLeadDialogRef = useRef<HTMLDialogElement>(null);
  const enrichmentMenuRef = useRef<HTMLDivElement>(null);
  const enrichmentTriggerRef = useRef<HTMLButtonElement>(null);
  const [enrichmentMenuOpen, setEnrichmentMenuOpen] = useState(false);
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [leadGroupMode, setLeadGroupMode] = useState<"existing" | "custom">(
    "custom",
  );
  const [selectedLeadBatchId, setSelectedLeadBatchId] = useState("");
  const [customLeadBatchName, setCustomLeadBatchName] = useState("");
  const [selectedWebsiteRecords, setSelectedWebsiteRecords] = useState<
    Map<string, WebsiteRecord>
  >(
    new Map(),
  );
  const [bulkStatus, setBulkStatus] = useState<WebsiteStatus | "">("");
  const [expandedWebsiteIds, setExpandedWebsiteIds] = useState<Set<string>>(
    () => new Set(),
  );

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
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<WebsiteSort | null>(null);
  const [category, setCategory] = useState("all");
  const [discoverySource, setDiscoverySource] = useState("all");
  const [pageType, setPageType] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WebsiteStatus | "all">(
    "all",
  );
  const [minimumMonthlyVisits, setMinimumMonthlyVisits] = useState("");
  const [minimumReferringDomains, setMinimumReferringDomains] = useState("");
  const [maximumGlobalRank, setMaximumGlobalRank] = useState("");
  const [minimumAhrefsDomainRating, setMinimumAhrefsDomainRating] =
    useState("");
  const [maximumAhrefsDomainRating, setMaximumAhrefsDomainRating] =
    useState("");
  const [pageSpeedStrategy, setPageSpeedStrategy] =
    useState<PageSpeedScanSummary["strategy"]>("desktop");
  const [pageSpeedCategory, setPageSpeedCategory] =
    useState<NonNullable<WebsiteRegistryPageParams["pagespeed_category"]>>(
      "performance",
    );
  const [minimumPageSpeedScore, setMinimumPageSpeedScore] = useState("");
  const [maximumPageSpeedScore, setMaximumPageSpeedScore] = useState("");
  const [hypestatCountry, setHypestatCountry] = useState("all");
  const [backlinkCountry, setBacklinkCountry] = useState("all");
  const [audienceCountry, setAudienceCountry] = useState("all");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const hasPageSpeedScoreFilter = Boolean(
    minimumPageSpeedScore || maximumPageSpeedScore,
  );
  const registryParams: WebsiteRegistryPageParams = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    search: debouncedSearch.trim(),
    status: statusFilter === "all" ? undefined : statusFilter,
    page_type: pageType === "all" ? undefined : pageType,
    category: category === "all" ? undefined : category,
    discovery_source:
      discoverySource === "all" ? undefined : discoverySource,
    minimum_monthly_visits: numericFilter(minimumMonthlyVisits) ?? undefined,
    minimum_referring_domains:
      numericFilter(minimumReferringDomains) ?? undefined,
    maximum_global_rank: numericFilter(maximumGlobalRank) ?? undefined,
    minimum_ahrefs_domain_rating:
      numericFilter(minimumAhrefsDomainRating) ?? undefined,
    maximum_ahrefs_domain_rating:
      numericFilter(maximumAhrefsDomainRating) ?? undefined,
    pagespeed_strategy: hasPageSpeedScoreFilter
      ? pageSpeedStrategy
      : undefined,
    pagespeed_category: hasPageSpeedScoreFilter
      ? pageSpeedCategory
      : undefined,
    minimum_pagespeed_score:
      numericFilter(minimumPageSpeedScore) ?? undefined,
    maximum_pagespeed_score:
      numericFilter(maximumPageSpeedScore) ?? undefined,
    hypestat_country:
      hypestatCountry === "all" ? undefined : hypestatCountry,
    backlink_country:
      backlinkCountry === "all" ? undefined : backlinkCountry,
    audience_country:
      audienceCountry === "all" ? undefined : audienceCountry,
    sort_by: sort?.key,
    sort_direction: sort?.direction,
  };
  const websitesQuery = useQuery({
    queryKey: websiteRegistryPageQueryKey(registryParams),
    queryFn: () => getWebsiteRegistryPage(registryParams),
    staleTime: 60_000,
    retry: false,
  });
  const leadBatchesQuery = useQuery({
    queryKey: ["companies", "lead-batches"],
    queryFn: getLeadBatches,
    staleTime: 60_000,
    retry: false,
  });
  const facetsQuery = useQuery({
    queryKey: ["websites", "registry-facets"],
    queryFn: getWebsiteRegistryFacets,
    enabled: filtersOpen,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const enrichmentCountsQuery = useQuery({
    queryKey: ["websites", "enrichment-counts"],
    queryFn: getWebsiteEnrichmentCounts,
    enabled: enrichmentMenuOpen,
    staleTime: 15_000,
    refetchInterval: enrichmentMenuOpen ? 15_000 : false,
    retry: false,
  });
  useEffect(() => {
    if (!enrichmentMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !enrichmentMenuRef.current?.contains(event.target)
      ) {
        setEnrichmentMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEnrichmentMenuOpen(false);
        enrichmentTriggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enrichmentMenuOpen]);
  const updateMutation = useMutation({
    mutationFn: ({
      websiteId,
      input,
    }: {
      websiteId: string;
      input: WebsiteUpdateInput;
    }) => updateWebsite(websiteId, input),
    onSuccess: async (updatedWebsite, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["websites", "registry-page"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["websites", "registry-facets"],
        }),
      ]);
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
    mutationFn: ({
      websiteIds,
      batchId,
      batchName,
    }: {
      websiteIds: string[];
      batchId?: string;
      batchName?: string;
    }) => addWebsitesToLeads(websiteIds, { batchId, batchName }),
    onSuccess: async () => {
      addToLeadDialogRef.current?.close();
      setSelectedWebsiteRecords(new Map());
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
      setSelectedWebsiteRecords(new Map());
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
  const excludeWebsiteMutation = useMutation({
    mutationFn: (website: WebsiteRecord) =>
      addExcludedDomain({
        domain: website.domain,
        reason: "Manual Exclusion",
      }),
    onSuccess: async (domain) => {
      showToast({
        type: "success",
        title: "Domain excluded",
        message: `${domain.domain} was excluded and its queued and failed indexing jobs were removed.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not exclude domain",
        message: error.message,
      });
    },
  });
  const excludeSelectedWebsitesMutation = useMutation({
    mutationFn: addExcludedDomainsInBatches,
    onSuccess: async (result) => {
      setSelectedWebsiteRecords(new Map());
      setBulkStatus("");
      showToast({
        type: "success",
        title: "Selected domains excluded",
        message: `Added ${result.createdCount} and updated ${result.updatedCount} exclusions (${result.totalCount} unique domains). Matching queued and failed indexing jobs were removed.`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not exclude selected websites",
        message: error.message,
      });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
  });
  const reclassifyMutation = useMutation({
    mutationFn: reclassifyWebsite,
    onSuccess: async (updatedWebsite) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["websites", "registry-page"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["websites", "registry-facets"],
        }),
      ]);
      void queryClient.invalidateQueries({
        queryKey: ["website-detail", updatedWebsite.id],
      });
    },
  });
  const reclassifyAllMutation = useMutation({
    mutationFn: reclassifyUnclassifiedWebsites,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
        queryClient.invalidateQueries({ queryKey: ["website-detail"] }),
      ]);
      showToast({
        type: "success",
        title: "Website classification updated",
        message: `Reclassified ${result.recomputed_count} website${result.recomputed_count === 1 ? "" : "s"}${result.skipped_count ? `; skipped ${result.skipped_count} without enough saved crawl data` : ""}.`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not classify websites",
        message: error.message,
      });
    },
  });
  const handleEnrichmentQueued = async (
    result: WebsiteBulkEnrichmentResult,
    title: string,
    itemLabel: string,
  ) => {
    showToast({
      type: "success",
      title,
      message: enrichmentQueueMessage(result, itemLabel),
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["websites"] }),
      queryClient.invalidateQueries({ queryKey: ["website-detail"] }),
      queryClient.invalidateQueries({
        queryKey: ["websites", "enrichment-counts"],
      }),
    ]);
  };
  const ahrefsBulkMutation = useMutation({
    mutationFn: fetchMissingWebsiteAhrefsDomainRatings,
    onSuccess: (result) =>
      handleEnrichmentQueued(result, "Ahrefs DR jobs queued", "Ahrefs DR"),
    onError: (error: Error) =>
      showToast({
        type: "error",
        title: "Could not queue Ahrefs DR fetches",
        message: error.message,
      }),
  });
  const hypestatBulkMutation = useMutation({
    mutationFn: fetchMissingWebsiteHypeStatProfiles,
    onSuccess: (result) =>
      handleEnrichmentQueued(result, "HypeStat jobs queued", "HypeStat"),
    onError: (error: Error) =>
      showToast({
        type: "error",
        title: "Could not queue HypeStat fetches",
        message: error.message,
      }),
  });
  const pagespeedBulkMutation = useMutation({
    mutationFn: fetchMissingWebsitePageSpeedScans,
    onSuccess: (result) =>
      handleEnrichmentQueued(result, "PageSpeed jobs queued", "PageSpeed scan"),
    onError: (error: Error) =>
      showToast({
        type: "error",
        title: "Could not queue PageSpeed scans",
        message: error.message,
      }),
  });
  const registryBulkActionPending =
    reclassifyAllMutation.isPending ||
    ahrefsBulkMutation.isPending ||
    hypestatBulkMutation.isPending ||
    pagespeedBulkMutation.isPending;
  const enrichmentActions = [
    {
      label: "Classify type & topic",
      description: "Use saved crawl data to fill missing classifications.",
      count: enrichmentCountsQuery.data?.classification_missing_count,
      countItem: "website",
      pending: reclassifyAllMutation.isPending,
      pendingLabel: "Classifying…",
      run: () => reclassifyAllMutation.mutate(),
    },
    {
      label: "Ahrefs Domain Rating",
      description: "Fetch a rating for websites without one.",
      count: enrichmentCountsQuery.data?.ahrefs_missing_count,
      countItem: "website",
      pending: ahrefsBulkMutation.isPending,
      pendingLabel: "Queuing…",
      run: () => ahrefsBulkMutation.mutate(),
    },
    {
      label: "HypeStat profile",
      description: "Fetch data for websites without a saved profile.",
      count: enrichmentCountsQuery.data?.hypestat_missing_count,
      countItem: "website",
      pending: hypestatBulkMutation.isPending,
      pendingLabel: "Queuing…",
      run: () => hypestatBulkMutation.mutate(),
    },
    {
      label: "PageSpeed scans",
      description: "Run missing desktop and mobile scans.",
      count: enrichmentCountsQuery.data?.pagespeed_missing_scan_count,
      countItem: "scan",
      pending: pagespeedBulkMutation.isPending,
      pendingLabel: "Queuing…",
      run: () => pagespeedBulkMutation.mutate(),
    },
  ];
  const pageWebsites = websitesQuery.data?.items ?? [];
  const visibleWebsiteIds = pageWebsites.map((website) => website.id);
  const visibleCrawlTimestamps = pageWebsites.map(
    (website) => website.crawled_at,
  );
  const corpusWordsQuery = useQuery({
    queryKey: [
      "website-corpus-words",
      visibleWebsiteIds,
      visibleCrawlTimestamps,
    ],
    queryFn: () => getWebsiteCorpusWords(visibleWebsiteIds),
    enabled: visibleWebsiteIds.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (query) =>
      (query.state.data?.pending_website_ids.length ?? 0) > 0
        ? 5_000
        : false,
  });
  const corpusWordsByWebsite = new Map(
    (corpusWordsQuery.data?.websites ?? []).map(
      (analysis) => [analysis.website_id, analysis] as const,
    ),
  );
  const pendingKeywordWebsiteIds = new Set(
    corpusWordsQuery.data?.pending_website_ids ?? [],
  );
  const failedKeywordWebsiteIds = new Set(
    corpusWordsQuery.data?.failed_website_ids ?? [],
  );
  const categories = facetsQuery.data?.categories ?? [];
  const discoverySources = facetsQuery.data?.discovery_sources ?? [];
  const hypestatCountries = facetsQuery.data?.hypestat_countries ?? [];
  const backlinkCountries = facetsQuery.data?.backlink_countries ?? [];
  const audienceCountries = facetsQuery.data?.audience_countries ?? [];
  const indexedWebsiteCount = websitesQuery.data?.indexed_count ?? 0;
  const websiteCount = websitesQuery.data?.website_count ?? 0;
  const filteredWebsiteCount = websitesQuery.data?.total_count ?? 0;
  const pageCount = Math.max(
    1,
    Math.ceil(filteredWebsiteCount / pageSize),
  );
  const visiblePage = Math.min(currentPage, pageCount);
  const selectedWebsiteIds = new Set(selectedWebsiteRecords.keys());
  const selectedPageCount = pageWebsites.filter((website) =>
    selectedWebsiteIds.has(website.id),
  ).length;
  const allPageSelected =
    pageWebsites.length > 0 && selectedPageCount === pageWebsites.length;
  const hasPartiallySelectedPage =
    selectedPageCount > 0 && !allPageSelected;
  const selectedCount = selectedWebsiteIds.size;

  useEffect(() => {
    if (selectFilteredRef.current) {
      selectFilteredRef.current.indeterminate =
        hasPartiallySelectedPage;
    }
  }, [hasPartiallySelectedPage]);
  const activeAdvancedFilterCount = [
    minimumMonthlyVisits,
    minimumReferringDomains,
    maximumGlobalRank,
    minimumAhrefsDomainRating,
    maximumAhrefsDomainRating,
    minimumPageSpeedScore,
    maximumPageSpeedScore,
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

  function toggleWebsiteSelection(website: WebsiteRecord) {
    setSelectedWebsiteRecords((current) => {
      const next = new Map(current);
      if (next.has(website.id)) {
        next.delete(website.id);
      } else {
        next.set(website.id, website);
      }
      return next;
    });
  }

  function toggleFilteredSelection() {
    if (allPageSelected) {
      setSelectedWebsiteRecords((current) => {
        const next = new Map(current);
        for (const website of pageWebsites) {
          next.delete(website.id);
        }
        return next;
      });
      return;
    }

    setSelectedWebsiteRecords((current) => {
      const next = new Map(current);
      for (const website of pageWebsites) {
        next.set(website.id, website);
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

  function submitAddSelectedWebsites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const websiteIds = Array.from(selectedWebsiteIds);
    if (websiteIds.length === 0) return;
    if (leadGroupMode === "existing") {
      if (!selectedLeadBatchId) return;
      addToLeadMutation.mutate({ websiteIds, batchId: selectedLeadBatchId });
      return;
    }

    const batchName = customLeadBatchName.trim();
    if (!batchName) return;
    addToLeadMutation.mutate({ websiteIds, batchName });
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
      <dialog
        aria-labelledby="website-lead-group-dialog-title"
        className="add-company-dialog website-lead-group-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={addToLeadDialogRef}
      >
        <div className="panel-heading compact-heading">
          <div>
            <p className="eyebrow">WEBSITE IMPORT</p>
            <h2 id="website-lead-group-dialog-title">
              Choose a lead group
            </h2>
            <p className="panel-subtitle">
              Add {selectedCount} selected website
              {selectedCount === 1 ? "" : "s"} to an existing group or create
              one with a custom name.
            </p>
          </div>
          <button
            aria-label="Close lead group selection"
            className="icon-button"
            onClick={() => addToLeadDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
        </div>
        <form
          className="company-form website-lead-group-form"
          onSubmit={submitAddSelectedWebsites}
        >
          <label className="website-lead-group-option">
            <input
              checked={leadGroupMode === "existing"}
              disabled={
                leadBatchesQuery.isLoading ||
                (leadBatchesQuery.data?.items.length ?? 0) === 0
              }
              name="lead-group-mode"
              onChange={() => setLeadGroupMode("existing")}
              type="radio"
            />
            <span>
              <strong>Add to an existing group</strong>
              <small>Keep the group&apos;s name and add these leads to it.</small>
            </span>
          </label>
          {leadGroupMode === "existing" && (
            <label className="website-lead-group-field">
              Existing group
              <select
                onChange={(event) =>
                  setSelectedLeadBatchId(event.target.value)
                }
                required
                value={selectedLeadBatchId}
              >
                <option value="">Choose a group</option>
                {(leadBatchesQuery.data?.items ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} ({batch.lead_count} leads)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="website-lead-group-option">
            <input
              checked={leadGroupMode === "custom"}
              name="lead-group-mode"
              onChange={() => setLeadGroupMode("custom")}
              type="radio"
            />
            <span>
              <strong>Create a custom-named group</strong>
              <small>
                A new group is created if at least one selected website can be
                added as a lead.
              </small>
            </span>
          </label>
          {leadGroupMode === "custom" && (
            <label className="website-lead-group-field">
              Group name
              <input
                autoComplete="off"
                maxLength={160}
                onChange={(event) =>
                  setCustomLeadBatchName(event.target.value)
                }
                placeholder="e.g. Q4 manufacturing prospects"
                required
                value={customLeadBatchName}
              />
            </label>
          )}
          {leadBatchesQuery.isError && (
            <p className="website-lead-group-error" role="alert">
              Could not load existing groups: {leadBatchesQuery.error.message}
            </p>
          )}
          {addToLeadMutation.isError && (
            <p className="website-lead-group-error" role="alert">
              Could not add websites to Leads: {addToLeadMutation.error.message}
            </p>
          )}
          <div className="website-lead-group-actions">
            <button
              className="button button-secondary"
              onClick={() => addToLeadDialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={
                addToLeadMutation.isPending ||
                (leadGroupMode === "existing" && leadBatchesQuery.isLoading) ||
                (leadGroupMode === "existing" &&
                  (!selectedLeadBatchId || leadBatchesQuery.isError)) ||
                (leadGroupMode === "custom" && !customLeadBatchName.trim())
              }
              type="submit"
            >
              {addToLeadMutation.isPending
                ? "Adding websites..."
                : "Add websites to Leads"}
            </button>
          </div>
        </form>
      </dialog>

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
          <details
            className="website-filter-drawer"
            onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
          >
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
                      setMinimumAhrefsDomainRating("");
                      setMaximumAhrefsDomainRating("");
                      setPageSpeedStrategy("desktop");
                      setPageSpeedCategory("performance");
                      setMinimumPageSpeedScore("");
                      setMaximumPageSpeedScore("");
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
                <option value="all">All</option>
                {pageTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatSiteType(value)}
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
                <option value="all">All</option>
                {websiteStatuses.map((value) => (
                  <option key={value} value={value}>
                    {formatWebsiteStatus(value)}
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
                <option value="all">All</option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value === "unclassified"
                      ? "Unclassified"
                      : formatSiteType(value)}
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
                <option value="all">All</option>
                {discoverySources.map((value) => (
                  <option key={value} value={value}>
                    {formatDiscoverySource(value)}
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
                  <option value="all">All</option>
                  {hypestatCountries.map((value) => (
                    <option key={value} value={value}>
                      {value}
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
                  <option value="all">All</option>
                  {backlinkCountries.map((value) => (
                    <option key={value} value={value}>
                      {value}
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
                  <option value="all">All</option>
                  {audienceCountries.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
              </div>
              <div className="website-filter-group">
                <h2>Domain Rating</h2>
                <div className="website-advanced-filter-grid">
                  <label className="website-filter-field hypestat-table-filter">
                    <span className="website-filter-field-label">
                      Min. DR
                    </span>
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => {
                        resetPage();
                        setMinimumAhrefsDomainRating(event.target.value);
                      }}
                      placeholder="0–100"
                      type="number"
                      value={minimumAhrefsDomainRating}
                    />
                  </label>
                  <label className="website-filter-field hypestat-table-filter">
                    <span className="website-filter-field-label">
                      Max. DR
                    </span>
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => {
                        resetPage();
                        setMaximumAhrefsDomainRating(event.target.value);
                      }}
                      placeholder="0–100"
                      type="number"
                      value={maximumAhrefsDomainRating}
                    />
                  </label>
                </div>
              </div>
              <div className="website-filter-group">
                <h2>PageSpeed score</h2>
                <div className="website-advanced-filter-grid">
                  <label className="website-filter-field select-filter">
                    <span className="website-filter-field-label">Device</span>
                    <select
                      onChange={(event) => {
                        resetPage();
                        const strategy = event.target.value;
                        if (strategy === "desktop" || strategy === "mobile") {
                          setPageSpeedStrategy(strategy);
                        }
                      }}
                      value={pageSpeedStrategy}
                    >
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </label>
                  <label className="website-filter-field select-filter">
                    <span className="website-filter-field-label">Category</span>
                    <select
                      onChange={(event) => {
                        resetPage();
                        const category = pageSpeedCategories.find(
                          (option) => option.key === event.target.value,
                        )?.key;
                        if (category) setPageSpeedCategory(category);
                      }}
                      value={pageSpeedCategory}
                    >
                      {pageSpeedCategories.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="website-filter-field hypestat-table-filter">
                    <span className="website-filter-field-label">
                      Min. score
                    </span>
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => {
                        resetPage();
                        setMinimumPageSpeedScore(event.target.value);
                      }}
                      placeholder="0–100"
                      type="number"
                      value={minimumPageSpeedScore}
                    />
                  </label>
                  <label className="website-filter-field hypestat-table-filter">
                    <span className="website-filter-field-label">
                      Max. score
                    </span>
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => {
                        resetPage();
                        setMaximumPageSpeedScore(event.target.value);
                      }}
                      placeholder="0–100"
                      type="number"
                      value={maximumPageSpeedScore}
                    />
                  </label>
                </div>
              </div>
            </div>
          </details>
          <div className="website-mobile-sort-control">
            <label>
              <span>Sort</span>
              <select
                aria-label="Sort websites by"
                onChange={(event) => {
                  const key = websiteSortOptions.find(
                    (option) => option.key === event.target.value,
                  )?.key;
                  setCurrentPage(1);
                  setSort((current) =>
                    key
                      ? {
                          key,
                          direction:
                            current?.key === key
                              ? current.direction
                              : "ascending",
                        }
                      : null,
                  );
                }}
                value={sort?.key ?? ""}
              >
                <option value="">Default order</option>
                {websiteSortOptions.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label={
                sort
                  ? `Sort ${sort.direction === "ascending" ? "descending" : "ascending"}`
                  : "Sort direction unavailable for default order"
              }
              className="website-mobile-sort-direction"
              disabled={!sort}
              onClick={() =>
                setSort((current) =>
                  current
                    ? {
                        ...current,
                        direction:
                          current.direction === "ascending"
                            ? "descending"
                            : "ascending",
                      }
                    : null,
                )
              }
              title={
                sort
                  ? `Currently ${sort.direction}; tap to reverse`
                  : "Choose a sort field first"
              }
              type="button"
            >
              {sort?.direction === "descending" ? "↓" : "↑"}
            </button>
          </div>
          <div className="website-registry-actions">
            <div className="website-enrichment-menu" ref={enrichmentMenuRef}>
              <button
                aria-controls={
                  enrichmentMenuOpen
                    ? "website-enrichment-options"
                    : undefined
                }
                aria-expanded={enrichmentMenuOpen}
                className="website-enrichment-trigger"
                onClick={() => setEnrichmentMenuOpen((open) => !open)}
                ref={enrichmentTriggerRef}
                type="button"
              >
                <Sparkles aria-hidden="true" size={15} />
                <span>Enrichment</span>
                <ChevronDown
                  aria-hidden="true"
                  className={enrichmentMenuOpen ? "is-open" : undefined}
                  size={14}
                />
              </button>
              {enrichmentMenuOpen && (
                <div
                  aria-label="Website enrichment actions"
                  className="website-enrichment-popover"
                  id="website-enrichment-options"
                  role="region"
                >
                  <div className="website-enrichment-heading">
                    <strong>Fill missing data</strong>
                    <p>
                      Counts cover all saved websites and include work already
                      in progress.
                    </p>
                  </div>
                  {enrichmentCountsQuery.isError && (
                    <div className="website-enrichment-error" role="alert">
                      <span>Couldn’t load missing counts.</span>
                      <button
                        className="website-enrichment-retry"
                        onClick={() => void enrichmentCountsQuery.refetch()}
                        type="button"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {enrichmentCountsQuery.isLoading && (
                    <p
                      aria-live="polite"
                      className="website-enrichment-loading"
                    >
                      Loading missing counts…
                    </p>
                  )}
                  <div className="website-enrichment-options">
                    {enrichmentActions.map((action) => (
                      <button
                        aria-label={
                          action.count === undefined
                            ? action.label
                            : `${action.label}, ${formatMissingCount(action.count, action.countItem)}`
                        }
                        className="website-enrichment-option"
                        disabled={
                          registryBulkActionPending ||
                          action.count === 0 ||
                          (action.count === undefined &&
                            !enrichmentCountsQuery.isError)
                        }
                        key={action.label}
                        onClick={() => {
                          setEnrichmentMenuOpen(false);
                          action.run();
                        }}
                        type="button"
                      >
                        <span className="website-enrichment-option-copy">
                          <span className="website-enrichment-option-title">
                            {action.pending ? action.pendingLabel : action.label}
                          </span>
                          <span className="website-enrichment-option-description">
                            {action.description}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="website-enrichment-count"
                        >
                          {action.count === undefined ? "—" : action.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            <div className="website-bulk-selection-count">
              <span className="website-bulk-selection-value">
                {selectedCount}
              </span>
              <span>selected website{selectedCount === 1 ? "" : "s"}</span>
            </div>
            <div className="website-bulk-status-actions">
              <label className="website-bulk-status">
                <span>Change status</span>
                <select
                  aria-label="Status to apply to selected websites"
                  disabled={
                    batchStatusMutation.isPending ||
                    addToLeadMutation.isPending ||
                    excludeSelectedWebsitesMutation.isPending
                  }
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
                  addToLeadMutation.isPending ||
                  excludeSelectedWebsitesMutation.isPending ||
                  excludeWebsiteMutation.isPending
                }
                onClick={changeSelectedWebsiteStatus}
                type="button"
              >
                {batchStatusMutation.isPending ? "Updating…" : "Apply status"}
              </button>
            </div>
            <button
              className="button button-primary"
              disabled={
                batchStatusMutation.isPending ||
                addToLeadMutation.isPending ||
                excludeSelectedWebsitesMutation.isPending ||
                excludeWebsiteMutation.isPending
              }
              onClick={() => addToLeadDialogRef.current?.showModal()}
              type="button"
            >
              {addToLeadMutation.isPending
                ? "Adding to Lead…"
                : "Add selected to Lead"}
            </button>
            <button
              className="button button-secondary website-exclude-selected-button"
              disabled={
                batchStatusMutation.isPending ||
                addToLeadMutation.isPending ||
                excludeSelectedWebsitesMutation.isPending ||
                excludeWebsiteMutation.isPending
              }
              onClick={() =>
                excludeSelectedWebsitesMutation.mutate(
                  Array.from(selectedWebsiteRecords.values()),
                )
              }
              type="button"
            >
              {excludeSelectedWebsitesMutation.isPending
                ? "Excluding..."
                : `Exclude selected (${selectedCount})`}
            </button>
            <button
              className="website-clear-selection"
              disabled={
                batchStatusMutation.isPending ||
                addToLeadMutation.isPending ||
                excludeSelectedWebsitesMutation.isPending ||
                excludeWebsiteMutation.isPending
              }
              onClick={() => {
                setSelectedWebsiteRecords(new Map());
                setBulkStatus("");
              }}
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
            {addToLeadMutation.data.batch_id && (
              <>
                {" "}Added to{" "}
                <strong>
                  {addToLeadMutation.data.batch_name ?? "a new lead group"}
                </strong>
                {" "}·{" "}
                <Link
                  href={`/leads?batch=${encodeURIComponent(addToLeadMutation.data.batch_id)}`}
                >
                  View group
                </Link>
                .
              </>
            )}
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
        {facetsQuery.isError && (
          <div className="alert alert-error" role="alert">
            Could not load website filter options: {facetsQuery.error.message}{" "}
            <button
              className="button button-secondary"
              onClick={() => void facetsQuery.refetch()}
              type="button"
            >
              Retry filters
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
          <TableLoading label="Loading websites" rows={6} />
        ) : pageWebsites.length === 0 ? (
          <div className="empty-state table-state">
            <span className="empty-symbol" aria-hidden="true">↗</span>
            <strong>
              {websiteCount === 0
                ? "No websites registered yet"
                : indexedWebsiteCount === 0
                  ? "No successfully indexed websites yet"
                  : "No websites match your filters"}
            </strong>
            <span>
              {websiteCount === 0
                ? "Websites are added through discovery or indexing jobs."
                : indexedWebsiteCount === 0
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
                            allPageSelected
                              ? `Deselect all ${pageWebsites.length} websites on this page`
                              : `Select all ${pageWebsites.length} websites on this page`
                          }
                          checked={allPageSelected}
                          disabled={
                            batchStatusMutation.isPending ||
                            addToLeadMutation.isPending ||
                            excludeSelectedWebsitesMutation.isPending ||
                            pageWebsites.length === 0
                          }
                          onChange={toggleFilteredSelection}
                          ref={selectFilteredRef}
                          type="checkbox"
                          title="Select all websites on this page"
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
                    <SortableHeader
                      label="DR"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="ahrefs_domain_rating"
                    />
                    {pageSpeedSortOptions.map(({ key, label }) => (
                      <SortableHeader
                        key={key}
                        label={label}
                        onSort={toggleSort}
                        sort={sort}
                        sortKey={key}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageWebsites.map((website, index) => (
                    <tr
                      className={
                        expandedWebsiteIds.has(website.id)
                          ? "website-mobile-card is-expanded"
                          : "website-mobile-card"
                      }
                      key={website.id}
                    >
                      <td className="website-row-number">
                        <span className="website-selection-row">
                          <input
                            aria-label={`Select ${website.domain}`}
                            checked={selectedWebsiteIds.has(website.id)}
                            disabled={
                              batchStatusMutation.isPending ||
                              addToLeadMutation.isPending ||
                              excludeSelectedWebsitesMutation.isPending
                            }
                            onChange={() =>
                              toggleWebsiteSelection(website)
                            }
                            type="checkbox"
                          />
                          <span>
                            {(visiblePage - 1) * pageSize + index + 1}
                          </span>
                          <button
                            aria-expanded={expandedWebsiteIds.has(website.id)}
                            aria-label={
                              expandedWebsiteIds.has(website.id)
                                ? `Collapse details for ${website.domain}`
                                : `Expand details for ${website.domain}`
                            }
                            className="website-mobile-card-toggle"
                            onClick={() =>
                              setExpandedWebsiteIds((current) => {
                                const next = new Set(current);
                                if (next.has(website.id)) {
                                  next.delete(website.id);
                                } else {
                                  next.add(website.id);
                                }
                                return next;
                              })
                            }
                            type="button"
                          >
                            {expandedWebsiteIds.has(website.id) ? "Hide" : "Details"}
                            <span aria-hidden="true">
                              {expandedWebsiteIds.has(website.id) ? "−" : "+"}
                            </span>
                          </button>
                        </span>
                      </td>
                      <td className="website-url-cell" data-label="Website">
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
                          <button
                            aria-label={`Exclude ${website.domain} from indexing`}
                            className="button button-secondary website-exclude-row-button"
                            disabled={
                              excludeWebsiteMutation.isPending ||
                              excludeSelectedWebsitesMutation.isPending ||
                              addToLeadMutation.isPending ||
                              batchStatusMutation.isPending
                            }
                            onClick={() =>
                              excludeWebsiteMutation.mutate(website)
                            }
                            title={`Add ${website.domain} to Excluded domains`}
                            type="button"
                          >
                            {excludeWebsiteMutation.isPending &&
                            excludeWebsiteMutation.variables?.id === website.id
                              ? "Excluding..."
                              : "Exclude"}
                          </button>
                        </span>
                      </td>
                      <td
                        className="website-keywords-cell"
                        data-label="Keywords"
                      >
                        <div
                          aria-label={`Corpus keywords for ${website.domain}`}
                          className="website-row-keywords"
                        >
                          {corpusWordsQuery.isLoading ? (
                            <span className="website-row-keywords-empty">
                              Analyzing…
                            </span>
                          ) : !corpusWordsByWebsite.has(website.id) ? (
                            <Link
                              className="website-row-keywords-empty"
                              href="/jobs?tab=keywords"
                            >
                              {failedKeywordWebsiteIds.has(website.id)
                                ? "Keyword generation failed · View queue"
                                : pendingKeywordWebsiteIds.has(website.id)
                                  ? "Generating keywords · View queue"
                                  : "Keywords unavailable · View queue"}
                            </Link>
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
                      <td data-label="Website type">
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
                      <td data-label="Site topic">
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
                      <td data-label="Monthly visits">
                        {formatTableNumber(website.hypestat_monthly_visits)}
                      </td>
                      <td data-label="Referring domains">
                        {formatTableNumber(website.hypestat_referring_domains)}
                      </td>
                      <td data-label="Global rank">
                        {formatTableNumber(website.hypestat_global_rank)}
                      </td>
                      <td data-label="Country">
                        {website.hypestat_country ?? "—"}
                      </td>
                      <td
                        className="website-hypestat-country-cell"
                        data-label="Backlinks by country"
                      >
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
                      <td
                        className="website-hypestat-country-cell"
                        data-label="Audience countries"
                      >
                        {website.hypestat_audience_countries.length
                          ? website.hypestat_audience_countries.join(", ")
                          : "—"}
                      </td>
                      <td data-label="Language">
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
                      <td data-label="Crawled at">
                        {website.crawled_at
                          ? new Date(website.crawled_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="website-ahrefs-dr-cell" data-label="DR">
                        {website.ahrefs_domain_rating === null
                          ? "—"
                          : website.ahrefs_domain_rating.toFixed(1)}
                      </td>
                      <PageSpeedScoreCell
                        category="performance"
                        label="Desktop performance"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="accessibility"
                        label="Desktop accessibility"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="best-practices"
                        label="Desktop best practices"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="seo"
                        label="Desktop SEO"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="performance"
                        label="Mobile performance"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="accessibility"
                        label="Mobile accessibility"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="best-practices"
                        label="Mobile best practices"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="seo"
                        label="Mobile SEO"
                        scan={website.pagespeed_mobile}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing{" "}
                {filteredWebsiteCount === 0
                  ? 0
                  : (visiblePage - 1) * pageSize + 1}
                –{Math.min(visiblePage * pageSize, filteredWebsiteCount)} of{" "}
                {filteredWebsiteCount} websites
                {filteredWebsiteCount !== indexedWebsiteCount &&
                  ` (from ${indexedWebsiteCount} total)`}
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
