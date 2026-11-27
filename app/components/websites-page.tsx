"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Columns3,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  addExcludedDomainsBatch,
  createWebsiteGroup,
  deleteWebsiteGroup,
  fetchMissingWebsiteAhrefsDomainRatings,
  fetchMissingWebsiteHypeStatProfiles,
  fetchMissingWebsitePageSpeedScans,
  getAuthSession,
  getWebsiteCorpusWords,
  getWebsiteEnrichmentCounts,
  getWebsiteRegistryFacets,
  getWebsiteRegistryPage,
  getWebsiteGroups,
  reclassifyWebsite,
  reclassifyUnclassifiedWebsites,
  updateWebsiteGroup,
  updateWebsiteGroupMembers,
  updateWebsite,
  updateWebsitesStatus,
  websiteRegistryPageQueryKey,
} from "@/lib/api";
import type {
  ExcludedDomainInput,
  PageSpeedScanSummary,
  WebsiteRecord,
  WebsiteGroupAction,
  WebsiteBulkEnrichmentResult,
  WebsitePageType,
  WebsiteRegistryPageParams,
  WebsiteRegistrySortKey,
  WebsiteRegistryColumnId,
  WebsiteStatus,
  WebsiteUpdateInput,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";
import { CrawlWebsiteDialog } from "./crawler-page";
import { useToast } from "./toast-provider";
import { WebsiteTableLoading } from "./page-loading";
import { useUserPreferences } from "@/lib/user-preferences";

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
const websiteColumnGroups: {
  label: string;
  columns: { id: WebsiteRegistryColumnId; label: string }[];
}[] = [
  {
    label: "Website details",
    columns: [
      { id: "keywords", label: "Keywords" },
      { id: "website_type", label: "Website type" },
      { id: "site_topic", label: "Site topic" },
      { id: "language", label: "Language" },
      { id: "crawled_at", label: "Crawled at" },
    ],
  },
  {
    label: "HypeStat",
    columns: [
      { id: "hypestat_monthly_visits", label: "Monthly visits" },
      { id: "hypestat_referring_domains", label: "Referring domains" },
      { id: "hypestat_global_rank", label: "Global rank" },
      { id: "hypestat_country", label: "Country" },
      { id: "hypestat_backlink_countries", label: "Backlinks by country" },
      { id: "hypestat_audience_countries", label: "Audience countries" },
    ],
  },
  {
    label: "Ahrefs",
    columns: [{ id: "ahrefs_domain_rating", label: "Domain Rating (DR)" }],
  },
  {
    label: "PageSpeed",
    columns: [
      { id: "pagespeed_desktop_performance", label: "Desktop performance" },
      { id: "pagespeed_desktop_accessibility", label: "Desktop accessibility" },
      {
        id: "pagespeed_desktop_best_practices",
        label: "Desktop best practices",
      },
      { id: "pagespeed_desktop_seo", label: "Desktop SEO" },
      { id: "pagespeed_mobile_performance", label: "Mobile performance" },
      { id: "pagespeed_mobile_accessibility", label: "Mobile accessibility" },
      {
        id: "pagespeed_mobile_best_practices",
        label: "Mobile best practices",
      },
      { id: "pagespeed_mobile_seo", label: "Mobile SEO" },
    ],
  },
];
const defaultWebsiteColumns = websiteColumnGroups.flatMap((group) =>
  group.columns.map(({ id }) => id),
);
const websiteStatuses: WebsiteStatus[] = [
  "new",
  "checked",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
  "needs_review",
];
const EXCLUDED_DOMAIN_BATCH_SIZE = 1000;
const pageSpeedSortOptions: {
  key: Extract<WebsiteRegistryColumnId, `pagespeed_${string}`>;
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
  { key: "emails", label: "Emails" },
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

type WebsiteFilterDraft = {
  pageType: string;
  statusFilter: WebsiteStatus | "all";
  category: string;
  discoverySource: string;
  minimumMonthlyVisits: string;
  minimumReferringDomains: string;
  maximumGlobalRank: string;
  minimumAhrefsDomainRating: string;
  maximumAhrefsDomainRating: string;
  pageSpeedStrategy: PageSpeedScanSummary["strategy"];
  pageSpeedCategory: NonNullable<
    WebsiteRegistryPageParams["pagespeed_category"]
  >;
  minimumPageSpeedScore: string;
  maximumPageSpeedScore: string;
  hypestatCountry: string;
  backlinkCountry: string;
  audienceCountry: string;
};

const defaultWebsiteFilterDraft: WebsiteFilterDraft = {
  pageType: "all",
  statusFilter: "all",
  category: "all",
  discoverySource: "all",
  minimumMonthlyVisits: "",
  minimumReferringDomains: "",
  maximumGlobalRank: "",
  minimumAhrefsDomainRating: "",
  maximumAhrefsDomainRating: "",
  pageSpeedStrategy: "desktop",
  pageSpeedCategory: "performance",
  minimumPageSpeedScore: "",
  maximumPageSpeedScore: "",
  hypestatCountry: "all",
  backlinkCountry: "all",
  audienceCountry: "all",
};

function numericFilter(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function WebsiteFilterRangeField({
  description,
  label,
  maximumLabel,
  maximumValue,
  minimumLabel,
  minimumValue,
  onMaximumChange,
  onMinimumChange,
}: {
  description: string;
  label: string;
  maximumLabel: string;
  maximumValue: string;
  minimumLabel: string;
  minimumValue: string;
  onMaximumChange(value: string): void;
  onMinimumChange(value: string): void;
}) {
  const parsedMinimum = numericFilter(minimumValue);
  const parsedMaximum = numericFilter(maximumValue);
  const minimum = Math.max(0, Math.min(100, parsedMinimum ?? 0));
  const maximum = Math.max(0, Math.min(100, parsedMaximum ?? 100));
  const lowerBound = Math.min(minimum, maximum);
  const upperBound = Math.max(minimum, maximum);
  const hasValue = Boolean(minimumValue || maximumValue);

  function changeMinimum(value: string) {
    if (!value) {
      onMinimumChange("");
      return;
    }

    const nextMinimum = Math.max(0, Math.min(100, Number(value)));
    onMinimumChange(String(nextMinimum));
    if (parsedMaximum !== null && nextMinimum > parsedMaximum) {
      onMaximumChange(String(nextMinimum));
    }
  }

  function changeMaximum(value: string) {
    if (!value) {
      onMaximumChange("");
      return;
    }

    const nextMaximum = Math.max(0, Math.min(100, Number(value)));
    onMaximumChange(String(nextMaximum));
    if (parsedMinimum !== null && nextMaximum < parsedMinimum) {
      onMinimumChange(String(nextMaximum));
    }
  }

  return (
    <div className="website-filter-field website-filter-range-field">
      <span className="website-filter-field-label">{label}</span>
      <div className="website-filter-range-values">
        <label>
          <span className="sr-only">{minimumLabel}</span>
          <input
            aria-label={minimumLabel}
            max="100"
            min="0"
            onChange={(event) => changeMinimum(event.target.value)}
            placeholder="Min"
            type="number"
            value={minimumValue}
          />
        </label>
        <span aria-hidden="true" className="website-filter-range-to">
          to
        </span>
        <label>
          <span className="sr-only">{maximumLabel}</span>
          <input
            aria-label={maximumLabel}
            max="100"
            min="0"
            onChange={(event) => changeMaximum(event.target.value)}
            placeholder="Max"
            type="number"
            value={maximumValue}
          />
        </label>
      </div>
      <div
        className={`website-filter-range-slider${hasValue ? " is-active" : ""}`}
      >
        <div className="website-filter-range-track">
          <span
            className="website-filter-range-fill"
            style={{
              left: `${lowerBound}%`,
              width: `${upperBound - lowerBound}%`,
            }}
          />
        </div>
        <input
          aria-label={minimumLabel}
          max={upperBound}
          min="0"
          onChange={(event) => changeMinimum(event.target.value)}
          type="range"
          value={lowerBound}
        />
        <input
          aria-label={maximumLabel}
          max="100"
          min={lowerBound}
          onChange={(event) => changeMaximum(event.target.value)}
          type="range"
          value={upperBound}
        />
      </div>
      <span className="website-filter-help">{description}</span>
    </div>
  );
}

type WebsiteFilterSelectOption = {
  value: string;
  label: string;
};

function WebsiteFilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: string): void;
  options: WebsiteFilterSelectOption[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = useId();
  const triggerId = useId();
  const searchable = options.length >= 8;
  const isMenuPositioned = menuPosition !== null;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.trim().toLowerCase()),
  );
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = triggerRef.current?.closest("dialog");
    setPortalTarget(dialog ?? document.body);
    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerBounds = trigger.getBoundingClientRect();
      const dialogBounds = dialog?.getBoundingClientRect();
      const topBound = Math.max(8, dialogBounds?.top ?? 0);
      const bottomBound = Math.min(
        window.innerHeight - 8,
        dialogBounds?.bottom ?? window.innerHeight,
      );
      const leftBound = dialogBounds?.left ?? 0;
      const rightBound = dialogBounds?.right ?? window.innerWidth;
      const spaceBelow = bottomBound - triggerBounds.bottom - 8;
      const spaceAbove = triggerBounds.top - topBound - 8;
      const opensAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableSpace = opensAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(96, Math.min(320, availableSpace));
      const width = Math.min(
        triggerBounds.width,
        rightBound - leftBound - 24,
      );

      setMenuPosition({
        top: opensAbove
          ? Math.max(topBound + 8, triggerBounds.top - maxHeight - 8)
          : triggerBounds.bottom + 8,
        left: Math.max(
          leftBound + 12,
          Math.min(triggerBounds.left, rightBound - width - 12),
        ),
        width,
        maxHeight,
      });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const closeWithDialog = () => setIsOpen(false);

    updateMenuPosition();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    dialog?.addEventListener("close", closeWithDialog);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      dialog?.removeEventListener("close", closeWithDialog);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMenuPositioned) return;
    if (searchable) {
      searchInputRef.current?.focus();
    }
  }, [isMenuPositioned, isOpen, searchable]);

  useEffect(() => {
    if (!isOpen || !isMenuPositioned || searchable) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isMenuPositioned, isOpen, searchable]);

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    setSearchValue("");
    if (restoreFocus) triggerRef.current?.focus();
  }

  function focusOption(index: number) {
    if (filteredOptions.length === 0) return;
    const nextIndex = Math.max(0, Math.min(index, filteredOptions.length - 1));
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function openMenu() {
    const selectedIndex = options.findIndex(
      (option) => option.value === value,
    );
    const initialIndex = selectedIndex < 0 ? 0 : selectedIndex;
    setSearchValue("");
    setActiveIndex(initialIndex);
    setIsOpen(true);
  }

  function selectOption(option: WebsiteFilterSelectOption) {
    onChange(option.value);
    closeMenu(true);
  }

  function handleSearchKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(activeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(
        activeIndex === 0 ? filteredOptions.length - 1 : activeIndex - 1,
      );
    } else if (event.key === "Enter") {
      const option = filteredOptions[activeIndex];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption((index + 1) % filteredOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(
        index === 0 ? filteredOptions.length - 1 : index - 1,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(filteredOptions.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = filteredOptions[index];
      if (option) selectOption(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  const menu =
    isOpen && menuPosition && portalTarget
      ? createPortal(
          <div
            className="website-filter-select-popover"
            ref={menuRef}
            style={menuPosition}
          >
            {searchable && (
              <label className="website-filter-select-search">
                <Search aria-hidden="true" size={14} />
                <input
                  aria-controls={listboxId}
                  aria-label={`Search ${label} options`}
                  autoComplete="off"
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search options"
                  ref={searchInputRef}
                  value={searchValue}
                />
              </label>
            )}
            <div
              aria-labelledby={triggerId}
              className="website-filter-select-options"
              id={listboxId}
              role="listbox"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <div
                    aria-selected={option.value === value}
                    className="website-filter-select-option"
                    key={option.value}
                    onClick={() => selectOption(option)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    onMouseMove={() => setActiveIndex(index)}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    role="option"
                    tabIndex={activeIndex === index ? 0 : -1}
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <Check aria-hidden="true" size={15} />
                    )}
                  </div>
                ))
              ) : (
                <p className="website-filter-select-empty">No options found</p>
              )}
            </div>
          </div>,
          portalTarget,
        )
      : null;

  return (
    <div className="website-filter-select">
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="website-filter-select-trigger"
        id={triggerId}
        onClick={() => {
          if (isOpen) closeMenu();
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span>{selectedOption?.label ?? "Select an option"}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {menu}
    </div>
  );
}

function enrichmentQueueMessage(
  result: WebsiteBulkEnrichmentResult,
  itemLabel: string,
): string {
  if (result.missing_website_count === 0) {
    return `No missing ${itemLabel} found among ${result.website_count} websites.`;
  }
  const missing = `${result.missing_website_count} website${result.missing_website_count === 1 ? "" : "s"} missing ${itemLabel}`;
  if (result.queued_job_count === 0) {
    if (result.in_progress_job_count > 0) {
      const active = `${result.in_progress_job_count} ${itemLabel} ${result.in_progress_job_count === 1 ? "job is" : "jobs are"} already queued or running`;
      return `${missing}; ${active}.`;
    }
    return `${missing}; no new jobs were queued.`;
  }

  const messages: string[] = [];
  const queued = `${result.queued_website_count} website${result.queued_website_count === 1 ? "" : "s"}`;
  const jobs = `${result.queued_job_count} ${itemLabel} ${result.queued_job_count === 1 ? "job" : "jobs"}`;
  messages.push(`Queued ${queued} (${jobs})`);
  if (result.in_progress_job_count > 0) {
    const inProgress = `${result.in_progress_job_count} ${itemLabel} ${result.in_progress_job_count === 1 ? "job is" : "jobs are"} already queued or running`;
    messages.push(inProgress);
  }
  const completeWebsiteCount =
    result.website_count - result.missing_website_count;
  if (completeWebsiteCount > 0) {
    messages.push(
      `${completeWebsiteCount} website${completeWebsiteCount === 1 ? "" : "s"} already complete`,
    );
  }
  return `${messages.join("; ")}.`;
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
  column,
}: {
  label: string;
  sortKey: WebsiteSortKey;
  sort: WebsiteSort | null;
  onSort: (key: WebsiteSortKey) => void;
  column?: WebsiteRegistryColumnId;
}) {
  const isActive = sort?.key === sortKey;
  const nextDirection =
    isActive && sort.direction === "ascending" ? "descending" : "ascending";
  return (
    <th aria-sort={isActive ? sort.direction : "none"} data-column={column}>
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
  column,
}: {
  label: string;
  category: string;
  scan: PageSpeedScanSummary | null;
  column: WebsiteRegistryColumnId;
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
    <td
      className="website-pagespeed-score-cell"
      data-column={column}
      data-label={label}
    >
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
  const authSessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const userPreferences = useUserPreferences(authSessionQuery.data?.user.id);
  const saveUserPreferences = userPreferences.save;
  const visibleWebsiteColumns =
    userPreferences.data?.websites?.visible_columns ?? defaultWebsiteColumns;
  useEffect(() => {
    if (!userPreferences.isError) return;
    showToast({
      type: "error",
      title: "Could not load website table preferences",
      message: userPreferences.error.message,
    });
  }, [
    showToast,
    userPreferences.error,
    userPreferences.isError,
  ]);
  const websiteScrollTimerRef = useRef<number | null>(null);
  const selectFilteredRef = useRef<HTMLInputElement>(null);
  const websiteGroupDialogRef = useRef<HTMLDialogElement>(null);
  const bulkActionDialogRef = useRef<HTMLDialogElement>(null);
  const websiteFiltersDialogRef = useRef<HTMLDialogElement>(null);
  const enrichmentMenuRef = useRef<HTMLDivElement>(null);
  const enrichmentTriggerRef = useRef<HTMLButtonElement>(null);
  const [enrichmentMenuOpen, setEnrichmentMenuOpen] = useState(false);
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [websiteGroupMode, setWebsiteGroupMode] = useState<
    "existing" | "create"
  >("create");
  const [websiteGroupAction, setWebsiteGroupAction] =
    useState<WebsiteGroupAction>("add");
  const [selectedWebsiteGroupId, setSelectedWebsiteGroupId] = useState("");
  const [newWebsiteGroupName, setNewWebsiteGroupName] = useState("");
  const [editingWebsiteGroupName, setEditingWebsiteGroupName] = useState(false);
  const [websiteGroupNameDraft, setWebsiteGroupNameDraft] = useState("");
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "status" | "exclude" | null
  >(null);
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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(true);
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
  const [draftWebsiteFilters, setDraftWebsiteFilters] =
    useState<WebsiteFilterDraft>(() => ({ ...defaultWebsiteFilterDraft }));
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>(
    {},
  );
  const setWebsiteColumnVisibility = (
    column: WebsiteRegistryColumnId,
    visible: boolean,
  ) => {
    const nextColumns = visibleWebsiteColumns.filter((item) => item !== column);
    if (visible) nextColumns.push(column);
    saveUserPreferences({
      websites: { visible_columns: nextColumns },
    });
  };
  const resetWebsiteColumns = () => {
    saveUserPreferences({ websites: { visible_columns: null } });
  };
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
  const websiteGroupsQuery = useQuery({
    queryKey: ["websites", "groups"],
    queryFn: getWebsiteGroups,
    staleTime: 60_000,
    retry: false,
  });
  const websiteGroups = websiteGroupsQuery.data ?? [];
  const selectedWebsiteGroup = websiteGroups.find(
    (group) => group.id === selectedWebsiteGroupId,
  );
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
  const refreshWebsiteGroups = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["websites"] }),
      queryClient.invalidateQueries({ queryKey: ["websites", "groups"] }),
    ]);
  };
  const finishWebsiteGroupAction = async () => {
    websiteGroupDialogRef.current?.close();
    setSelectedWebsiteRecords(new Map());
    setBulkStatus("");
    await refreshWebsiteGroups();
  };
  const createWebsiteGroupMutation = useMutation({
    mutationFn: ({ name, websiteIds }: { name: string; websiteIds: string[] }) =>
      createWebsiteGroup({ name, website_ids: websiteIds }),
    onSuccess: finishWebsiteGroupAction,
  });
  const websiteGroupMembersMutation = useMutation({
    mutationFn: ({
      websiteIds,
      action,
      groupId,
    }: {
      websiteIds: string[];
      action: WebsiteGroupAction;
      groupId?: string;
    }) =>
      updateWebsiteGroupMembers({
        website_ids: websiteIds,
        action,
        group_id: groupId,
      }),
    onSuccess: finishWebsiteGroupAction,
  });
  const renameWebsiteGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      name,
    }: {
      groupId: string;
      name: string;
    }) => updateWebsiteGroup(groupId, name),
    onSuccess: async (group) => {
      setEditingWebsiteGroupName(false);
      setWebsiteGroupNameDraft("");
      setSelectedWebsiteGroupId(group.id);
      await refreshWebsiteGroups();
    },
  });
  const deleteWebsiteGroupMutation = useMutation({
    mutationFn: deleteWebsiteGroup,
    onSuccess: async (_, groupId) => {
      if (selectedWebsiteGroupId === groupId) setSelectedWebsiteGroupId("");
      setEditingWebsiteGroupName(false);
      await refreshWebsiteGroups();
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
  const websiteTypeOptions = [
    { value: "all", label: "Any type" },
    ...pageTypes.map((value) => ({
      value,
      label: formatSiteType(value),
    })),
  ];
  const websiteStatusOptions = [
    { value: "all", label: "Any status" },
    ...websiteStatuses.map((value) => ({
      value,
      label: formatWebsiteStatus(value),
    })),
  ];
  const topicOptions = [
    { value: "all", label: "Any topic" },
    ...categories.map((value) => ({
      value,
      label:
        value === "unclassified" ? "Unclassified" : formatSiteType(value),
    })),
  ];
  const discoverySourceOptions = [
    { value: "all", label: "Any source" },
    ...discoverySources.map((value) => ({
      value,
      label: formatDiscoverySource(value),
    })),
  ];
  const getCountryOptions = (values: string[]) => [
    { value: "all", label: "Any country" },
    ...values.map((value) => ({ value, label: value })),
  ];
  const pageSpeedStrategyOptions = [
    { value: "desktop", label: "Desktop" },
    { value: "mobile", label: "Mobile" },
  ];
  const pageSpeedCategoryOptions = pageSpeedCategories.map(({ key, label }) => ({
    value: key,
    label,
  }));
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
  const websiteGroupMutationPending =
    createWebsiteGroupMutation.isPending ||
    websiteGroupMembersMutation.isPending ||
    renameWebsiteGroupMutation.isPending ||
    deleteWebsiteGroupMutation.isPending;

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
  const draftActiveFilterCount =
    [
      draftWebsiteFilters.minimumMonthlyVisits,
      draftWebsiteFilters.minimumReferringDomains,
      draftWebsiteFilters.maximumGlobalRank,
      draftWebsiteFilters.minimumAhrefsDomainRating,
      draftWebsiteFilters.maximumAhrefsDomainRating,
      draftWebsiteFilters.minimumPageSpeedScore,
      draftWebsiteFilters.maximumPageSpeedScore,
    ].filter(Boolean).length +
    [
      draftWebsiteFilters.hypestatCountry,
      draftWebsiteFilters.backlinkCountry,
      draftWebsiteFilters.audienceCountry,
    ].filter((value) => value !== "all").length +
    [
      draftWebsiteFilters.pageType,
      draftWebsiteFilters.statusFilter,
      draftWebsiteFilters.category,
      draftWebsiteFilters.discoverySource,
    ].filter((value) => value !== "all").length;

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

  function openBulkActionConfirmation(action: "status" | "exclude") {
    if (selectedCount === 0 || (action === "status" && !bulkStatus)) return;
    setPendingBulkAction(action);
    const dialog = bulkActionDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeBulkActionConfirmation() {
    const dialog = bulkActionDialogRef.current;
    if (dialog?.open) dialog.close();
    setPendingBulkAction(null);
  }

  function confirmBulkAction() {
    const websiteIds = Array.from(selectedWebsiteIds);
    const action = pendingBulkAction;
    closeBulkActionConfirmation();

    if (websiteIds.length === 0) return;
    if (action === "status" && bulkStatus) {
      batchStatusMutation.mutate({ websiteIds, status: bulkStatus });
    } else if (action === "exclude") {
      excludeSelectedWebsitesMutation.mutate(
        Array.from(selectedWebsiteRecords.values()),
      );
    }
  }

  function changeSelectedWebsiteStatus() {
    if (!bulkStatus || selectedCount === 0) return;
    openBulkActionConfirmation("status");
  }

  function submitWebsiteGroupAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const websiteIds = Array.from(selectedWebsiteIds);
    if (websiteIds.length === 0) return;
    createWebsiteGroupMutation.reset();
    websiteGroupMembersMutation.reset();
    renameWebsiteGroupMutation.reset();
    deleteWebsiteGroupMutation.reset();
    if (websiteGroupAction === "ungroup") {
      websiteGroupMembersMutation.mutate({
        websiteIds,
        action: "ungroup",
      });
      return;
    }

    if (websiteGroupMode === "create") {
      const name = newWebsiteGroupName.trim();
      if (!name) return;
      createWebsiteGroupMutation.mutate({ name, websiteIds });
      return;
    }

    if (!selectedWebsiteGroupId) return;
    websiteGroupMembersMutation.mutate({
      websiteIds,
      action: websiteGroupAction,
      groupId: selectedWebsiteGroupId,
    });
  }

  function saveWebsiteGroupRename() {
    const name = websiteGroupNameDraft.trim();
    if (!selectedWebsiteGroup || !name) return;
    renameWebsiteGroupMutation.reset();
    renameWebsiteGroupMutation.mutate({
      groupId: selectedWebsiteGroup.id,
      name,
    });
  }

  function removeSelectedWebsiteGroup() {
    if (!selectedWebsiteGroup) return;
    if (
      !window.confirm(
        `Delete the website group "${selectedWebsiteGroup.name}"? Its websites will remain in the registry.`,
      )
    ) {
      return;
    }
    deleteWebsiteGroupMutation.reset();
    deleteWebsiteGroupMutation.mutate(selectedWebsiteGroup.id);
  }

  function openWebsiteGroupDialog() {
    createWebsiteGroupMutation.reset();
    websiteGroupMembersMutation.reset();
    renameWebsiteGroupMutation.reset();
    deleteWebsiteGroupMutation.reset();
    websiteGroupDialogRef.current?.showModal();
  }

  function resetPage() {
    setCurrentPage(1);
  }

  function updateDraftWebsiteFilter<K extends keyof WebsiteFilterDraft>(
    key: K,
    value: WebsiteFilterDraft[K],
  ) {
    setDraftWebsiteFilters((current) => ({ ...current, [key]: value }));
  }

  function openWebsiteFilters() {
    setDraftWebsiteFilters({
      pageType,
      statusFilter,
      category,
      discoverySource,
      minimumMonthlyVisits,
      minimumReferringDomains,
      maximumGlobalRank,
      minimumAhrefsDomainRating,
      maximumAhrefsDomainRating,
      pageSpeedStrategy,
      pageSpeedCategory,
      minimumPageSpeedScore,
      maximumPageSpeedScore,
      hypestatCountry,
      backlinkCountry,
      audienceCountry,
    });
    const dialog = websiteFiltersDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    setFiltersOpen(true);
  }

  function closeWebsiteFilters() {
    const dialog = websiteFiltersDialogRef.current;
    if (dialog?.open) dialog.close();
    setFiltersOpen(false);
  }

  function applyWebsiteFilters() {
    setPageType(draftWebsiteFilters.pageType);
    setStatusFilter(draftWebsiteFilters.statusFilter);
    setCategory(draftWebsiteFilters.category);
    setDiscoverySource(draftWebsiteFilters.discoverySource);
    setMinimumMonthlyVisits(draftWebsiteFilters.minimumMonthlyVisits);
    setMinimumReferringDomains(draftWebsiteFilters.minimumReferringDomains);
    setMaximumGlobalRank(draftWebsiteFilters.maximumGlobalRank);
    setMinimumAhrefsDomainRating(draftWebsiteFilters.minimumAhrefsDomainRating);
    setMaximumAhrefsDomainRating(draftWebsiteFilters.maximumAhrefsDomainRating);
    setPageSpeedStrategy(draftWebsiteFilters.pageSpeedStrategy);
    setPageSpeedCategory(draftWebsiteFilters.pageSpeedCategory);
    setMinimumPageSpeedScore(draftWebsiteFilters.minimumPageSpeedScore);
    setMaximumPageSpeedScore(draftWebsiteFilters.maximumPageSpeedScore);
    setHypestatCountry(draftWebsiteFilters.hypestatCountry);
    setBacklinkCountry(draftWebsiteFilters.backlinkCountry);
    setAudienceCountry(draftWebsiteFilters.audienceCountry);
    resetPage();
    closeWebsiteFilters();
  }

  function clearWebsiteFilters() {
    setDraftWebsiteFilters({ ...defaultWebsiteFilterDraft });
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
        <CrawlWebsiteDialog
          onClose={() => setCrawlDialogOpen(false)}
          onWebsiteQueued={() => {
            void queryClient.invalidateQueries({ queryKey: ["websites"] });
          }}
        />
      )}
      <dialog
        aria-labelledby="website-group-dialog-title"
        className="website-action-dialog website-group-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={websiteGroupDialogRef}
      >
        <div className="panel-heading compact-heading">
          <div>
            <p className="eyebrow">WEBSITE GROUPS</p>
            <h2 id="website-group-dialog-title">Group selected websites</h2>
            <p className="panel-subtitle">
              Organize {selectedCount} selected website
              {selectedCount === 1 ? "" : "s"} into a group or remove them from
              their current groups.
            </p>
          </div>
          <button
            aria-label="Close website group dialog"
            className="icon-button"
            onClick={() => websiteGroupDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
        </div>
        <form
          className="website-form website-group-form"
          onSubmit={submitWebsiteGroupAction}
        >
          <label className="website-group-option">
            <input
              checked={websiteGroupMode === "existing"}
              disabled={websiteGroupsQuery.isLoading || websiteGroups.length === 0}
              name="website-group-mode"
              onChange={() => setWebsiteGroupMode("existing")}
              type="radio"
            />
            <span>
              <strong>Use an existing group</strong>
              <small>Choose a group and add or move selected websites.</small>
            </span>
          </label>
          {websiteGroupMode === "existing" && (
            <>
              <label className="website-group-field">
                Group
                <select
                  onChange={(event) =>
                    setSelectedWebsiteGroupId(event.target.value)
                  }
                  required={websiteGroupAction !== "ungroup"}
                  value={selectedWebsiteGroupId}
                >
                  <option value="">Choose a group</option>
                  {websiteGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.website_count} websites)
                    </option>
                  ))}
                </select>
              </label>
              <label className="website-group-field">
                Membership action
                <select
                  onChange={(event) =>
                    setWebsiteGroupAction(
                      event.target.value as WebsiteGroupAction,
                    )
                  }
                  value={websiteGroupAction}
                >
                  <option value="add">Add (keep other group memberships)</option>
                  <option value="move">Move (remove other memberships)</option>
                  <option value="ungroup">Ungroup selected websites</option>
                </select>
              </label>
              {selectedWebsiteGroup && websiteGroupAction !== "ungroup" && (
                <div className="website-group-management">
                  {editingWebsiteGroupName ? (
                    <div className="website-group-rename-form">
                      <label className="website-group-field">
                        New group name
                        <input
                          autoComplete="off"
                          maxLength={160}
                          onChange={(event) =>
                            setWebsiteGroupNameDraft(event.target.value)
                          }
                          required
                          value={websiteGroupNameDraft}
                        />
                      </label>
                      <button
                        className="button button-secondary"
                        disabled={
                          renameWebsiteGroupMutation.isPending ||
                          !websiteGroupNameDraft.trim()
                        }
                        onClick={saveWebsiteGroupRename}
                        type="button"
                      >
                        {renameWebsiteGroupMutation.isPending
                          ? "Saving…"
                          : "Save name"}
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => setEditingWebsiteGroupName(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setWebsiteGroupNameDraft(selectedWebsiteGroup.name);
                          setEditingWebsiteGroupName(true);
                        }}
                        type="button"
                      >
                        Rename group
                      </button>
                      <button
                        className="button button-secondary"
                        disabled={deleteWebsiteGroupMutation.isPending}
                        onClick={removeSelectedWebsiteGroup}
                        type="button"
                      >
                        {deleteWebsiteGroupMutation.isPending
                          ? "Deleting…"
                          : "Delete group"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <label className="website-group-option">
            <input
              checked={websiteGroupMode === "create"}
              name="website-group-mode"
              onChange={() => {
                setWebsiteGroupMode("create");
                if (websiteGroupAction === "ungroup") {
                  setWebsiteGroupAction("add");
                }
              }}
              type="radio"
            />
            <span>
              <strong>Create a new group</strong>
              <small>Create a named group containing the selected websites.</small>
            </span>
          </label>
          {websiteGroupMode === "create" &&
            websiteGroupAction !== "ungroup" && (
              <label className="website-group-field">
                New group name
                <input
                  autoComplete="off"
                  maxLength={160}
                  onChange={(event) =>
                    setNewWebsiteGroupName(event.target.value)
                  }
                  placeholder="e.g. Q4 manufacturing websites"
                  required
                  value={newWebsiteGroupName}
                />
              </label>
            )}
          {websiteGroupsQuery.isError && (
            <p className="website-group-error" role="alert">
              Could not load website groups: {websiteGroupsQuery.error.message}
            </p>
          )}
          {createWebsiteGroupMutation.isError && (
            <p className="website-group-error" role="alert">
              Could not create website group:{" "}
              {createWebsiteGroupMutation.error.message}
            </p>
          )}
          {websiteGroupMembersMutation.isError && (
            <p className="website-group-error" role="alert">
              Could not update website group memberships:{" "}
              {websiteGroupMembersMutation.error.message}
            </p>
          )}
          {renameWebsiteGroupMutation.isError && (
            <p className="website-group-error" role="alert">
              Could not rename website group:{" "}
              {renameWebsiteGroupMutation.error.message}
            </p>
          )}
          {deleteWebsiteGroupMutation.isError && (
            <p className="website-group-error" role="alert">
              Could not delete website group:{" "}
              {deleteWebsiteGroupMutation.error.message}
            </p>
          )}
          <div className="website-group-actions">
            <button
              className="button button-secondary"
              onClick={() => websiteGroupDialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={
                websiteGroupMutationPending ||
                (websiteGroupMode === "existing" &&
                  (websiteGroupsQuery.isLoading || websiteGroupsQuery.isError)) ||
                (websiteGroupAction !== "ungroup" &&
                  (websiteGroupMode === "existing"
                    ? !selectedWebsiteGroupId
                    : !newWebsiteGroupName.trim()))
              }
              type="submit"
            >
              {websiteGroupMutationPending
                ? "Updating…"
                : websiteGroupAction === "ungroup"
                  ? "Ungroup selected websites"
                  : websiteGroupMode === "create"
                    ? "Create website group"
                    : websiteGroupAction === "move"
                      ? "Move to group"
                      : "Add to group"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        aria-describedby="website-bulk-action-description"
        aria-labelledby="website-bulk-action-title"
        className="website-action-dialog website-bulk-action-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeBulkActionConfirmation();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeBulkActionConfirmation();
          }
        }}
        ref={bulkActionDialogRef}
      >
        {pendingBulkAction && (
          <>
            <div className="panel-heading compact-heading">
              <div>
                <p className="eyebrow">
                  {pendingBulkAction === "exclude"
                    ? "EXCLUDE WEBSITES"
                    : "UPDATE STATUS"}
                </p>
                <h2 id="website-bulk-action-title">
                  {pendingBulkAction === "exclude"
                    ? "Exclude selected websites?"
                    : "Update website status?"}
                </h2>
                <p
                  className="panel-subtitle"
                  id="website-bulk-action-description"
                >
                  {pendingBulkAction === "exclude"
                    ? `Add ${selectedCount} selected domain${selectedCount === 1 ? "" : "s"} to Excluded domains. Matching queued and failed indexing jobs will also be removed.`
                    : `Change the status of ${selectedCount} selected website${selectedCount === 1 ? "" : "s"} to ${bulkStatus ? formatWebsiteStatus(bulkStatus) : "the selected status"}.`}
                </p>
              </div>
              <button
                aria-label="Close confirmation"
                className="icon-button"
                onClick={closeBulkActionConfirmation}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="website-bulk-confirm-actions">
              <button
                className="button button-secondary"
                onClick={closeBulkActionConfirmation}
                type="button"
              >
                Cancel
              </button>
              <button
                className={
                  pendingBulkAction === "exclude"
                    ? "button-danger"
                    : "button button-primary"
                }
                onClick={confirmBulkAction}
                type="button"
              >
                {pendingBulkAction === "exclude"
                  ? "Exclude websites"
                  : "Update status"}
              </button>
            </div>
          </>
        )}
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
          <button
            aria-controls="website-filter-dialog"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            className="website-filter-trigger"
            onClick={openWebsiteFilters}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" size={15} strokeWidth={1.8} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="website-active-filter-count">
                {activeFilterCount}
              </span>
            )}
          </button>
          <dialog
            aria-labelledby="website-filter-dialog-title"
            className="website-filter-dialog"
            id="website-filter-dialog"
            onCancel={(event) => {
              event.preventDefault();
              closeWebsiteFilters();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeWebsiteFilters();
            }}
            ref={websiteFiltersDialogRef}
          >
            <div className="website-filter-modal">
              <header className="website-filter-modal-header">
                <h2 id="website-filter-dialog-title">Filter websites</h2>
                <div className="website-filter-modal-header-actions">
                  {draftActiveFilterCount > 0 && (
                    <button
                      className="website-clear-filters"
                      onClick={clearWebsiteFilters}
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" size={13} />
                      Clear all
                    </button>
                  )}
                  <button
                    aria-label="Close website filters"
                    className="icon-button website-filter-close"
                    onClick={closeWebsiteFilters}
                    type="button"
                  >
                    <X aria-hidden="true" size={17} />
                  </button>
                </div>
              </header>
            <div
              aria-label="Website filters"
              className="website-filter-content"
              role="group"
            >
              <section className="website-filter-essentials">
                <div className="website-filter-section-heading">
                  <h2>Essentials</h2>
                  <p>The filters most searches start with.</p>
                </div>
                <div className="website-filter-essentials-grid">
                  <label className="website-filter-field">
                    <span className="website-filter-field-label">
                      Website type
                    </span>
                    <WebsiteFilterSelect
                      label="Website type"
                      onChange={(value) =>
                        updateDraftWebsiteFilter("pageType", value)
                      }
                      options={websiteTypeOptions}
                      value={draftWebsiteFilters.pageType}
                    />
                  </label>
                  <label className="website-filter-field">
                    <span className="website-filter-field-label">
                      Site topic
                    </span>
                    <WebsiteFilterSelect
                      label="Site topic"
                      onChange={(value) =>
                        updateDraftWebsiteFilter("category", value)
                      }
                      options={topicOptions}
                      value={draftWebsiteFilters.category}
                    />
                  </label>
                  <label className="website-filter-field">
                    <span className="website-filter-field-label">Status</span>
                    <WebsiteFilterSelect
                      label="Website status"
                      onChange={(value) => {
                        const nextStatus = websiteStatuses.find(
                          (status) => status === value,
                        );
                        updateDraftWebsiteFilter(
                          "statusFilter",
                          nextStatus ?? "all",
                        );
                      }}
                      options={websiteStatusOptions}
                      value={draftWebsiteFilters.statusFilter}
                    />
                  </label>
                  <label className="website-filter-field">
                    <span className="website-filter-field-label">
                      Discovery source
                    </span>
                    <WebsiteFilterSelect
                      label="Discovery source"
                      onChange={(value) =>
                        updateDraftWebsiteFilter("discoverySource", value)
                      }
                      options={discoverySourceOptions}
                      value={draftWebsiteFilters.discoverySource}
                    />
                  </label>
                  <label className="website-filter-field website-filter-help-field">
                    <span className="website-filter-field-label">
                      Min. monthly visits
                    </span>
                    <input
                      aria-label="Minimum monthly visits"
                      min="0"
                      onChange={(event) =>
                        updateDraftWebsiteFilter(
                          "minimumMonthlyVisits",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 10,000"
                      type="number"
                      value={draftWebsiteFilters.minimumMonthlyVisits}
                    />
                    <span className="website-filter-help">
                      Estimated visits per month
                    </span>
                  </label>
                  <label className="website-filter-field website-filter-help-field">
                    <span className="website-filter-field-label">
                      Min. referring domains
                    </span>
                    <input
                      aria-label="Minimum referring domains"
                      min="0"
                      onChange={(event) =>
                        updateDraftWebsiteFilter(
                          "minimumReferringDomains",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 100"
                      type="number"
                      value={draftWebsiteFilters.minimumReferringDomains}
                    />
                    <span className="website-filter-help">
                      Unique sites that link to it
                    </span>
                  </label>
                  <WebsiteFilterRangeField
                    description="Authority score from 0 to 100. Leave blank for no limit."
                    label="Domain Rating (DR)"
                    maximumLabel="Maximum domain rating"
                    maximumValue={
                      draftWebsiteFilters.maximumAhrefsDomainRating
                    }
                    minimumLabel="Minimum domain rating"
                    minimumValue={
                      draftWebsiteFilters.minimumAhrefsDomainRating
                    }
                    onMaximumChange={(value) =>
                      updateDraftWebsiteFilter(
                        "maximumAhrefsDomainRating",
                        value,
                      )
                    }
                    onMinimumChange={(value) =>
                      updateDraftWebsiteFilter(
                        "minimumAhrefsDomainRating",
                        value,
                      )
                    }
                  />
                </div>
              </section>
              <section className="website-filter-more">
                <button
                  aria-controls="website-more-filters-content"
                  aria-expanded={moreFiltersOpen}
                  className="website-filter-more-toggle"
                  onClick={() =>
                    setMoreFiltersOpen((isOpen) => !isOpen)
                  }
                  type="button"
                >
                  <span className="website-filter-more-title">
                    <strong>More filters</strong>
                    <span>Geography, rank and PageSpeed</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="website-filter-more-chevron"
                    size={17}
                  />
                </button>
                {moreFiltersOpen && (
                  <div
                    className="website-filter-more-content"
                    id="website-more-filters-content"
                  >
                    <section className="website-filter-subsection">
                      <h3>Geography</h3>
                      <div className="website-filter-geography-grid">
                        <label className="website-filter-field website-filter-help-field">
                          <span className="website-filter-field-label">
                            Audience in
                          </span>
                          <WebsiteFilterSelect
                            label="Audience country"
                            onChange={(value) =>
                              updateDraftWebsiteFilter(
                                "audienceCountry",
                                value,
                              )
                            }
                            options={getCountryOptions(audienceCountries)}
                            value={draftWebsiteFilters.audienceCountry}
                          />
                          <span className="website-filter-help">
                            Where most visitors are located
                          </span>
                        </label>
                        <label className="website-filter-field website-filter-help-field">
                          <span className="website-filter-field-label">
                            Backlinks from
                          </span>
                          <WebsiteFilterSelect
                            label="Backlink country"
                            onChange={(value) =>
                              updateDraftWebsiteFilter(
                                "backlinkCountry",
                                value,
                              )
                            }
                            options={getCountryOptions(backlinkCountries)}
                            value={draftWebsiteFilters.backlinkCountry}
                          />
                          <span className="website-filter-help">
                            Where most of its backlinks come from
                          </span>
                        </label>
                        <label className="website-filter-field website-filter-help-field">
                          <span className="website-filter-field-label">
                            Top market (HypeStat)
                          </span>
                          <WebsiteFilterSelect
                            label="HypeStat country"
                            onChange={(value) =>
                              updateDraftWebsiteFilter("hypestatCountry", value)
                            }
                            options={getCountryOptions(hypestatCountries)}
                            value={draftWebsiteFilters.hypestatCountry}
                          />
                          <span className="website-filter-help">
                            Country listed in HypeStat&apos;s data
                          </span>
                        </label>
                      </div>
                    </section>
                    <section className="website-filter-subsection">
                      <h3>Rank and performance</h3>
                      <div className="website-filter-performance-grid">
                        <label className="website-filter-field website-filter-help-field website-filter-best-rank">
                          <span className="website-filter-field-label">
                            Best global rank
                          </span>
                          <input
                            aria-label="Maximum global rank"
                            min="1"
                            onChange={(event) =>
                              updateDraftWebsiteFilter(
                                "maximumGlobalRank",
                                event.target.value,
                              )
                            }
                            placeholder="e.g. 50,000"
                            type="number"
                            value={draftWebsiteFilters.maximumGlobalRank}
                          />
                          <span className="website-filter-help">
                            Rank number or better. 50,000 shows the top 50k sites.
                          </span>
                        </label>
                        <div className="website-filter-field website-filter-device">
                          <span className="website-filter-field-label">
                            PageSpeed device
                          </span>
                          <div
                            aria-label="PageSpeed device"
                            className="website-filter-segmented"
                          >
                            {pageSpeedStrategyOptions.map((option) => (
                              <button
                                aria-pressed={
                                  draftWebsiteFilters.pageSpeedStrategy ===
                                  option.value
                                }
                                className={
                                  draftWebsiteFilters.pageSpeedStrategy ===
                                  option.value
                                    ? "is-selected"
                                    : undefined
                                }
                                key={option.value}
                                onClick={() => {
                                  if (
                                    option.value === "desktop" ||
                                    option.value === "mobile"
                                  ) {
                                    updateDraftWebsiteFilter(
                                      "pageSpeedStrategy",
                                      option.value,
                                    );
                                  }
                                }}
                                type="button"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="website-filter-field website-filter-category">
                          <span className="website-filter-field-label">
                            PageSpeed category
                          </span>
                          <WebsiteFilterSelect
                            label="PageSpeed category"
                            onChange={(value) => {
                              const selectedCategory = pageSpeedCategories.find(
                                (option) => option.key === value,
                              )?.key;
                              if (selectedCategory) {
                                updateDraftWebsiteFilter(
                                  "pageSpeedCategory",
                                  selectedCategory,
                                );
                              }
                            }}
                            options={pageSpeedCategoryOptions}
                            value={draftWebsiteFilters.pageSpeedCategory}
                          />
                        </label>
                        <WebsiteFilterRangeField
                          description="Lighthouse score from 0 to 100."
                          label="Score range"
                          maximumLabel="Maximum PageSpeed score"
                          maximumValue={
                            draftWebsiteFilters.maximumPageSpeedScore
                          }
                          minimumLabel="Minimum PageSpeed score"
                          minimumValue={
                            draftWebsiteFilters.minimumPageSpeedScore
                          }
                          onMaximumChange={(value) =>
                            updateDraftWebsiteFilter(
                              "maximumPageSpeedScore",
                              value,
                            )
                          }
                          onMinimumChange={(value) =>
                            updateDraftWebsiteFilter(
                              "minimumPageSpeedScore",
                              value,
                            )
                          }
                        />
                      </div>
                    </section>
                  </div>
                )}
              </section>
            </div>
              <footer className="website-filter-modal-footer">
                <span>
                  {draftActiveFilterCount === 0
                    ? "No filters selected"
                    : `${draftActiveFilterCount} selected`}
                </span>
                <button
                  className="button button-primary"
                  onClick={applyWebsiteFilters}
                  type="button"
                >
                  Apply filters
                </button>
              </footer>
            </div>
          </dialog>
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
            <button
              className="button button-primary website-add-button"
              onClick={() => setCrawlDialogOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={15} strokeWidth={2} />
              <span>Add website</span>
            </button>
            <details className="website-columns-menu">
              <summary>
                <Columns3 aria-hidden="true" size={15} strokeWidth={1.8} />
                <span>Columns</span>
                <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
              </summary>
              <div aria-label="Choose visible website columns" className="website-columns-popover">
                <div className="website-columns-heading">
                  <strong>Visible columns</strong>
                  <button onClick={resetWebsiteColumns} type="button">
                    Reset
                  </button>
                </div>
                {websiteColumnGroups.map((group) => (
                  <fieldset className="website-columns-group" key={group.label}>
                    <legend>{group.label}</legend>
                    {group.columns.map(({ id, label }) => (
                      <label key={id}>
                        <input
                          checked={visibleWebsiteColumns.includes(id)}
                          onChange={(event) =>
                            setWebsiteColumnVisibility(id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <p className="website-columns-fixed-note">
                  Website and row actions are always shown.
                </p>
              </div>
            </details>
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
            <div className="website-bulk-selection-summary">
              <div className="website-bulk-selection-count">
                <span className="website-bulk-selection-value">
                  {selectedCount}
                </span>
                <span>selected website{selectedCount === 1 ? "" : "s"}</span>
              </div>
              <button
                className="website-clear-selection"
                disabled={
                  batchStatusMutation.isPending ||
                  websiteGroupMutationPending ||
                  excludeSelectedWebsitesMutation.isPending
                }
                onClick={() => {
                  setSelectedWebsiteRecords(new Map());
                  setBulkStatus("");
                }}
                type="button"
              >
                <X aria-hidden="true" size={14} />
                Clear selection
              </button>
            </div>
            <div className="website-bulk-status-actions">
              <label className="website-bulk-status">
                <span>Change status</span>
                <select
                  aria-label="Status to apply to selected websites"
                  disabled={
                    batchStatusMutation.isPending ||
                    websiteGroupMutationPending ||
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
                  websiteGroupMutationPending ||
                  excludeSelectedWebsitesMutation.isPending
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
                websiteGroupMutationPending ||
                excludeSelectedWebsitesMutation.isPending
              }
              onClick={openWebsiteGroupDialog}
              type="button"
            >
              {websiteGroupMutationPending
                ? "Updating groups…"
                : "Manage website groups"}
            </button>
            <button
              className="button button-secondary website-exclude-selected-button"
              disabled={
                batchStatusMutation.isPending ||
                websiteGroupMutationPending ||
                excludeSelectedWebsitesMutation.isPending
              }
              onClick={() => openBulkActionConfirmation("exclude")}
              type="button"
            >
              {excludeSelectedWebsitesMutation.isPending
                ? "Excluding..."
                : `Exclude selected (${selectedCount})`}
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
        {createWebsiteGroupMutation.isSuccess && (
          <div className="alert alert-success" role="status">
            Created website group{" "}
            <strong>{createWebsiteGroupMutation.data.name}</strong> with the
            selected websites.
          </div>
        )}
        {websiteGroupMembersMutation.isSuccess && (
          <div className="alert alert-success" role="status">
            {websiteGroupAction === "ungroup"
              ? "Ungrouped"
              : websiteGroupAction === "move"
                ? "Moved"
                : "Added"}{" "}
            {websiteGroupMembersMutation.data.updated_count} website
            {websiteGroupMembersMutation.data.updated_count === 1 ? "" : "s"}{" "}
            {websiteGroupAction === "ungroup"
              ? "from their groups."
              : `to ${selectedWebsiteGroup?.name ?? "the selected group"}.`}
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
          <WebsiteTableLoading
            hiddenColumns={defaultWebsiteColumns
              .filter((column) => !visibleWebsiteColumns.includes(column))
              .join(" ")}
            label="Loading websites"
            rows={6}
          />
        ) : pageWebsites.length === 0 ? (
          <div className="empty-state table-state">
            <span className="empty-symbol" aria-hidden="true">↗</span>
            <strong>
              {websiteCount === 0
                ? "No websites registered yet"
                : "No websites match your filters"}
            </strong>
            {websiteCount === 0 ? (
              <button
                className="button button-primary"
                onClick={() => setCrawlDialogOpen(true)}
                type="button"
              >
                <Plus aria-hidden="true" size={15} strokeWidth={2} />
                Add websites
              </button>
            ) : (
              <span>Try another search or site type.</span>
            )}
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
              data-hidden-columns={defaultWebsiteColumns
                .filter((column) => !visibleWebsiteColumns.includes(column))
                .join(" ")}
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
                            websiteGroupMutationPending ||
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
                    <SortableHeader
                      column="emails"
                      label="Emails"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="emails"
                    />
                    <th data-column="keywords" scope="col">Keywords</th>
                    <SortableHeader
                      column="website_type"
                      label="Website type"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="website_type"
                    />
                    <SortableHeader
                      column="site_topic"
                      label="Site topic"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="site_topic"
                    />
                    <SortableHeader
                      column="hypestat_monthly_visits"
                      label="Est. monthly visits"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_monthly_visits"
                    />
                    <SortableHeader
                      column="hypestat_referring_domains"
                      label="Referring domains"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_referring_domains"
                    />
                    <SortableHeader
                      column="hypestat_global_rank"
                      label="HypeStat global rank"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_global_rank"
                    />
                    <SortableHeader
                      column="hypestat_country"
                      label="Country"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_country"
                    />
                    <SortableHeader
                      column="hypestat_backlink_countries"
                      label="Referring domains by country"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_backlink_countries"
                    />
                    <SortableHeader
                      column="hypestat_audience_countries"
                      label="Audience countries"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="hypestat_audience_countries"
                    />
                    <SortableHeader
                      column="language"
                      label="Language"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="language"
                    />
                    <SortableHeader
                      column="crawled_at"
                      label="Crawled at"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="crawled_at"
                    />
                    <SortableHeader
                      column="ahrefs_domain_rating"
                      label="DR"
                      onSort={toggleSort}
                      sort={sort}
                      sortKey="ahrefs_domain_rating"
                    />
                    {pageSpeedSortOptions.map(({ key, label }) => (
                      <SortableHeader
                        column={key}
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
                              websiteGroupMutationPending ||
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
                            {expandedWebsiteIds.has(website.id) ? "Less" : "More"}
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
                          <WebsiteStatusMenu
                            disabled={
                              updateMutation.isPending ||
                              websiteGroupMutationPending ||
                              batchStatusMutation.isPending ||
                              reclassifyMutation.isPending ||
                              reclassifyAllMutation.isPending
                            }
                            onChange={(status) =>
                              updateWebsiteField(website.id, { status })
                            }
                            website={website}
                          />
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
                      <td
                        className="website-emails-cell"
                        data-column="emails"
                        data-label="Emails"
                      >
                        {website.emails.length ? (
                          <div
                            aria-label={`Emails for ${website.domain}`}
                            className="website-table-emails"
                            title={website.emails.join("\n")}
                          >
                            {website.emails.slice(0, 2).map((email) => (
                              <span key={email}>{email}</span>
                            ))}
                            {website.emails.length > 2 && (
                              <span>+{website.emails.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className="website-keywords-cell"
                        data-column="keywords"
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
                      <td data-column="website_type" data-label="Website type">
                        <div className="website-type-recompute-control">
                          <select
                            aria-label={`Website type for ${website.domain}`}
                            className="website-review-select"
                            disabled={
                              updateMutation.isPending ||
                              websiteGroupMutationPending ||
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
                              websiteGroupMutationPending ||
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
                      <td data-column="site_topic" data-label="Site topic">
                        <input
                          aria-label={`Site topic for ${website.domain}`}
                          className="website-review-input"
                          disabled={
                            updateMutation.isPending ||
                            websiteGroupMutationPending ||
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
                      <td
                        data-column="hypestat_monthly_visits"
                        data-label="Monthly visits"
                      >
                        {formatTableNumber(website.hypestat_monthly_visits)}
                      </td>
                      <td
                        data-column="hypestat_referring_domains"
                        data-label="Referring domains"
                      >
                        {formatTableNumber(website.hypestat_referring_domains)}
                      </td>
                      <td
                        data-column="hypestat_global_rank"
                        data-label="Global rank"
                      >
                        {formatTableNumber(website.hypestat_global_rank)}
                      </td>
                      <td data-column="hypestat_country" data-label="Country">
                        {website.hypestat_country ?? "—"}
                      </td>
                      <td
                        className="website-hypestat-country-cell"
                        data-column="hypestat_backlink_countries"
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
                        data-column="hypestat_audience_countries"
                        data-label="Audience countries"
                      >
                        {website.hypestat_audience_countries.length
                          ? website.hypestat_audience_countries.join(", ")
                          : "—"}
                      </td>
                      <td data-column="language" data-label="Language">
                        <input
                          aria-label={`Language for ${website.domain}`}
                          className="website-review-input website-language-input"
                          disabled={
                            updateMutation.isPending ||
                            websiteGroupMutationPending ||
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
                      <td data-column="crawled_at" data-label="Crawled at">
                        {website.crawled_at
                          ? new Date(website.crawled_at).toLocaleString()
                          : "—"}
                      </td>
                      <td
                        className="website-ahrefs-dr-cell"
                        data-column="ahrefs_domain_rating"
                        data-label="DR"
                      >
                        {website.ahrefs_domain_rating === null
                          ? "—"
                          : website.ahrefs_domain_rating.toFixed(1)}
                      </td>
                      <PageSpeedScoreCell
                        category="performance"
                        column="pagespeed_desktop_performance"
                        label="Desktop performance"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="accessibility"
                        column="pagespeed_desktop_accessibility"
                        label="Desktop accessibility"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="best-practices"
                        column="pagespeed_desktop_best_practices"
                        label="Desktop best practices"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="seo"
                        column="pagespeed_desktop_seo"
                        label="Desktop SEO"
                        scan={website.pagespeed_desktop}
                      />
                      <PageSpeedScoreCell
                        category="performance"
                        column="pagespeed_mobile_performance"
                        label="Mobile performance"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="accessibility"
                        column="pagespeed_mobile_accessibility"
                        label="Mobile accessibility"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="best-practices"
                        column="pagespeed_mobile_best_practices"
                        label="Mobile best practices"
                        scan={website.pagespeed_mobile}
                      />
                      <PageSpeedScoreCell
                        category="seo"
                        column="pagespeed_mobile_seo"
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
                {websiteCount !== indexedWebsiteCount &&
                  ` (${indexedWebsiteCount} crawled overall)`}
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
  if (status === "needs_review") return "Needs review";
  return status.charAt(0).toLocaleUpperCase() + status.slice(1);
}

function WebsiteStatusMenu({
  website,
  disabled,
  onChange,
}: {
  website: WebsiteRecord;
  disabled: boolean;
  onChange: (status: WebsiteStatus) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `website-status-options-${website.id}`;

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className={`website-status-menu${isOpen ? " is-open" : ""}`}
      ref={containerRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={`Change status for ${website.domain}. Current status: ${formatWebsiteStatus(website.status)}`}
        className={`website-status-badge website-status-${website.status}`}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        title={`Change status for ${website.domain}`}
        type="button"
      >
        {formatWebsiteStatus(website.status)}
      </button>
      <div
        aria-label={`Choose status for ${website.domain}`}
        className="website-status-options"
        hidden={!isOpen}
        id={menuId}
        role="group"
      >
        {websiteStatuses.map((status) => {
          const selected = website.status === status;
          return (
            <button
              aria-pressed={selected}
              className="website-status-option"
              disabled={disabled}
              key={status}
              onClick={() => {
                if (!selected) onChange(status);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`website-status-option-dot is-${status}`}
              />
              <span>{formatWebsiteStatus(status)}</span>
              {selected && (
                <Check
                  aria-hidden="true"
                  className="website-status-option-check"
                  size={13}
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatTableNumber(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
        value,
      );
}
