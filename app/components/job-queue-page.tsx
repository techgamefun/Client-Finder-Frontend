"use client";

import Link from "next/link";
import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addExcludedDomain,
  addExcludedDomainsBatch,
  completeWebsiteCrawlJobManually,
  getWebsiteCorpusAnalysisJobsPage,
  getApplicationSettings,
  getPageSpeedScanJobs,
  getWebsiteCrawlJobFailureReasons,
  getWebsiteCrawlJobsPage,
  getWebsiteHypeStatJobsPage,
  retryWebsiteCorpusAnalysisJob,
  retryWebsiteCorpusAnalysisJobs,
  retryWebsiteHypeStatJob,
  retryWebsiteHypeStatJobs,
  retryPageSpeedScanJob,
  retryPageSpeedScanJobs,
  retryWebsiteCrawlJob,
  retryWebsiteCrawlJobs,
  type PageSpeedScanJob,
  type ExcludedDomainInput,
  type ManualWebsiteCrawlCompletionInput,
  type ManualEnrichmentStatus,
  type QueueJobsPageParams,
  type WebsiteCorpusAnalysisJob,
  type WebsiteCrawlJobResponse,
  type WebsiteHypeStatFetchJob,
} from "@/lib/api";
import {
  formatElapsedTime,
  formatJobStatus,
  formatTimestamp,
  type QueueJobStatus,
} from "@/lib/job-format";
import { formatSiteType } from "@/lib/site-type";
import { useToast } from "./toast-provider";
import { TableLoading } from "./page-loading";

type QueueKind = "crawler" | "pagespeed" | "keywords" | "hypestat";

interface QueueJob {
  id: string;
  websiteUrl: string;
  siteType: string | null;
  detail: string;
  status: QueueJobStatus;
  error: string | null;
  skipReason: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const queueConfig = {
  crawler: {
    title: "Website indexing queue",
    description: "Monitor website indexing jobs and retry failures.",
    label: "WEBSITE INDEXING",
  },
  pagespeed: {
    title: "PageSpeed queue",
    description:
      "Track background PageSpeed scans, their progress, duration, and any failures.",
    label: "PAGESPEED INSIGHTS",
  },
  keywords: {
    title: "Keyword generation queue",
    description:
      "Track background keyword analysis for newly crawled websites and retry failures.",
    label: "WEBSITE KEYWORDS",
  },
  hypestat: {
    title: "HypeStat profile queue",
    description:
      "Monitor background HypeStat profile lookups, their progress, duration, and any failures.",
    label: "HYPESTAT PROFILES",
  },
} satisfies Record<
  QueueKind,
  { title: string; description: string; label: string }
>;

function normalizeCrawlerJob(job: WebsiteCrawlJobResponse): QueueJob {
  return {
    id: job.id,
    websiteUrl: job.website_url,
    siteType: job.result?.site_type ?? null,
    detail: "Website indexing",
    status: job.status,
    error: job.error,
    skipReason: null,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

function normalizePageSpeedJob(job: PageSpeedScanJob): QueueJob {
  return {
    id: job.id,
    websiteUrl: job.website_url,
    siteType: null,
    detail: `${job.strategy} scan`,
    status: job.status,
    error: job.error,
    skipReason: null,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

function normalizeCorpusAnalysisJob(
  job: WebsiteCorpusAnalysisJob,
): QueueJob {
  return {
    id: job.id,
    websiteUrl: job.website_url,
    siteType: null,
    detail: "Keyword generation",
    status: job.status,
    error: job.status === "failed" ? job.error : null,
    skipReason: job.status === "skipped" ? job.error : null,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

function normalizeHypeStatJob(job: WebsiteHypeStatFetchJob): QueueJob {
  return {
    id: job.id,
    websiteUrl: job.website_url,
    siteType: null,
    detail: "HypeStat profile",
    status: job.status,
    error: job.status === "failed" ? job.error : null,
    skipReason: job.status === "skipped" ? job.error : null,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

async function excludeQueueJobsInBatches(
  jobs: QueueJob[],
): Promise<{ createdCount: number; updatedCount: number; totalCount: number }> {
  const domains = new Map<string, ExcludedDomainInput>();
  for (const job of jobs) {
    let url: URL;
    try {
      url = new URL(
        job.websiteUrl.includes("://")
          ? job.websiteUrl
          : `https://${job.websiteUrl}`,
      );
    } catch {
      throw new Error(`Could not determine a valid domain from ${job.websiteUrl}.`);
    }
    const domain = url.hostname.toLowerCase().replace(/^www\./, "");
    if (domain) {
      domains.set(domain, { domain, reason: "Manual Exclusion" });
    }
  }
  const exclusions = Array.from(domains.values());
  if (exclusions.length === 0) {
    throw new Error("No selected indexing jobs contain a valid domain.");
  }

  let createdCount = 0;
  let updatedCount = 0;
  const batchSize = 1000;
  for (let start = 0; start < exclusions.length; start += batchSize) {
    try {
      const result = await addExcludedDomainsBatch(
        exclusions.slice(start, start + batchSize),
      );
      createdCount += result.created_count;
      updatedCount += result.updated_count;
    } catch (error) {
      const processedCount = createdCount + updatedCount;
      if (processedCount > 0) {
        const detail =
          error instanceof Error ? error.message : "The request failed.";
        throw new Error(
          `Excluded ${processedCount} of ${exclusions.length} domains before a later batch failed: ${detail}`,
        );
      }
      throw error;
    }
  }
  return { createdCount, updatedCount, totalCount: exclusions.length };
}

export function JobQueuePage({ kind }: { kind: QueueKind }) {
  const config = queueConfig[kind];
  const queueLabel =
    kind === "crawler"
      ? "indexing"
      : kind === "pagespeed"
        ? "PageSpeed"
        : kind === "hypestat"
          ? "HypeStat profile"
          : "keyword generation";
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [selectedState, setSelectedState] = useState<{
    kind: QueueKind;
    jobs: Map<string, QueueJob>;
  }>({ kind, jobs: new Map() });
  const selectedJobs =
    selectedState.kind === kind
      ? selectedState.jobs
      : new Map<string, QueueJob>();
  const selectPageRef = useRef<HTMLInputElement>(null);
  const [statusFilterState, setStatusFilterState] = useState<{
    kind: QueueKind;
    status: "all" | QueueJobStatus;
  }>({ kind, status: "all" });
  const statusFilter =
    statusFilterState.kind === kind ? statusFilterState.status : "all";
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [manualCompletionJob, setManualCompletionJob] =
    useState<QueueJob | null>(null);
  const [failureReasonFilterState, setFailureReasonFilterState] = useState<{
    kind: QueueKind;
    reason: string;
  }>({ kind, reason: "" });
  const failureReasonFilter =
    failureReasonFilterState.kind === kind
      ? failureReasonFilterState.reason
      : "";
  const [pageState, setPageState] = useState({ kind, page: 1 });
  const page = pageState.kind === kind ? pageState.page : 1;
  const updatePage = (nextPage: number | ((current: number) => number)) => {
    setPageState((current) => {
      const currentPage = current.kind === kind ? current.page : 1;
      return {
        kind,
        page:
          typeof nextPage === "function"
            ? nextPage(currentPage)
            : nextPage,
      };
    });
  };
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
      setPageState({ kind, page: 1 });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [kind, searchText]);
  const crawlerFailureReasonsQuery = useQuery({
    queryKey: ["crawler", "queue-failure-reasons"],
    queryFn: getWebsiteCrawlJobFailureReasons,
    enabled: kind === "crawler",
    staleTime: 30_000,
  });
  const queueParams: QueueJobsPageParams = {
    page,
    page_size: pageSize,
    search: debouncedSearch,
    ...(kind === "crawler" && failureReasonFilter
      ? { failure_reason: failureReasonFilter }
      : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };
  const crawlerJobsQuery = useQuery({
    queryKey: ["crawler", "queue-jobs", queueParams],
    queryFn: () => getWebsiteCrawlJobsPage(queueParams),
    select: (result) => ({
      ...result,
      items: result.items.map(normalizeCrawlerJob),
    }),
    enabled: kind === "crawler",
  });
  const pageSpeedJobsQuery = useQuery({
    queryKey: ["pagespeed", "queue-jobs", queueParams],
    queryFn: () => getPageSpeedScanJobs(queueParams),
    select: (result) => ({
      ...result,
      items: result.items.map(normalizePageSpeedJob),
    }),
    enabled: kind === "pagespeed",
  });
  const corpusAnalysisJobsQuery = useQuery({
    queryKey: ["website-corpus-analysis", "queue-jobs", queueParams],
    queryFn: () => getWebsiteCorpusAnalysisJobsPage(queueParams),
    select: (result) => ({
      ...result,
      items: result.items.map(normalizeCorpusAnalysisJob),
    }),
    enabled: kind === "keywords",
    refetchInterval: kind === "keywords" ? 5_000 : false,
  });
  const hypestatJobsQuery = useQuery({
    queryKey: ["hypestat", "queue-jobs", queueParams],
    queryFn: () => getWebsiteHypeStatJobsPage(queueParams),
    select: (result) => ({
      ...result,
      items: result.items.map(normalizeHypeStatJob),
    }),
    enabled: kind === "hypestat",
    refetchInterval: kind === "hypestat" ? 5_000 : false,
  });
  const pageSpeedSettingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    enabled: kind === "pagespeed",
    retry: false,
  });
  const jobsQuery =
    kind === "crawler"
      ? crawlerJobsQuery
      : kind === "pagespeed"
        ? pageSpeedJobsQuery
        : kind === "keywords"
          ? corpusAnalysisJobsQuery
          : hypestatJobsQuery;
  const canRetryJobs =
    kind !== "pagespeed" ||
    pageSpeedSettingsQuery.data?.pagespeed_configured === true;
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (kind === "crawler") {
        await retryWebsiteCrawlJob(jobId);
      } else if (kind === "keywords") {
        await retryWebsiteCorpusAnalysisJob(jobId);
      } else if (kind === "hypestat") {
        await retryWebsiteHypeStatJob(jobId);
      } else {
        await retryPageSpeedScanJob(jobId);
      }
    },
    onSuccess: async () => {
      showToast({
        type: "success",
        title: "Retry queued",
        message: `The ${queueLabel} job was returned to the queue.`,
      });
      await jobsQuery.refetch();
      if (kind === "crawler") {
        await queryClient.invalidateQueries({
          queryKey: ["crawler", "queue-failure-reasons"],
        });
      }
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not retry job",
        message: error.message,
      });
    },
  });
  const manualCompletionMutation = useMutation({
    mutationFn: ({
      jobId,
      input,
    }: {
      jobId: string;
      input: ManualWebsiteCrawlCompletionInput;
    }) => completeWebsiteCrawlJobManually(jobId, input),
    onSuccess: async (result) => {
      setManualCompletionJob(null);
      setSelectedState((current) => {
        if (current.kind !== "crawler" || !current.jobs.has(result.job_id)) {
          return current;
        }
        const jobs = new Map(current.jobs);
        jobs.delete(result.job_id);
        return { kind: current.kind, jobs };
      });
      showToast({
        type: "success",
        title: "Manual website data saved",
        message:
          `Ahrefs: ${formatEnrichmentStatus(result.ahrefs_domain_rating)}; ` +
          `HypeStat: ${formatEnrichmentStatus(result.hypestat)}; ` +
          `PageSpeed: ${formatEnrichmentStatus(result.pagespeed)}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({
          queryKey: ["crawler", "queue-failure-reasons"],
        }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
        queryClient.invalidateQueries({ queryKey: ["pagespeed", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["hypestat", "queue-jobs"] }),
      ]);
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not save manual website data",
        message: error.message,
      });
    },
  });
  const excludeDomainMutation = useMutation({
    mutationFn: (job: QueueJob) =>
      addExcludedDomain({
        domain: job.websiteUrl,
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
        queryClient.invalidateQueries({
          queryKey: ["crawler", "queue-failure-reasons"],
        }),
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
  const excludeSelectedDomainsMutation = useMutation({
    mutationFn: excludeQueueJobsInBatches,
    onSuccess: async (result) => {
      setSelectedState({ kind, jobs: new Map() });
      showToast({
        type: "success",
        title: "Selected domains excluded",
        message: `Added ${result.createdCount} and updated ${result.updatedCount} exclusions across ${result.totalCount} unique domains. Matching queued and failed indexing jobs were removed.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({
          queryKey: ["crawler", "queue-failure-reasons"],
        }),
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not exclude selected domains",
        message: error.message,
      });
      void queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] });
    },
  });
  const retryAllMutation = useMutation({
    mutationFn: async (failedJobs: QueueJob[]) => {
      const result =
        kind === "crawler"
          ? await retryWebsiteCrawlJobs(failedJobs.map((job) => job.id))
          : kind === "pagespeed"
            ? await retryPageSpeedScanJobs(failedJobs.map((job) => job.id))
            : kind === "keywords"
              ? await retryWebsiteCorpusAnalysisJobs(
                  failedJobs.map((job) => job.id),
                )
              : await retryWebsiteHypeStatJobs(
                  failedJobs.map((job) => job.id),
                );
      const jobsById = new Map(failedJobs.map((job) => [job.id, job]));

      return {
        total: failedJobs.length,
        retriedCount: result.retried_job_ids.length,
        failures: result.failures.map((failure) => ({
          websiteUrl:
            jobsById.get(failure.job_id)?.websiteUrl ?? failure.job_id,
          message: failure.message,
        })),
        queueLabel,
      };
    },
    onSuccess: async (result) => {
      if (result.failures.length > 0) {
        showToast({
          type: result.retriedCount > 0 ? "warning" : "error",
          title:
            result.retriedCount > 0
              ? "Some retries were not queued"
              : "Could not retry jobs",
          message: `Retried ${result.retriedCount} of ${result.total} failed ${result.queueLabel} jobs. See the details below.`,
        });
      } else {
        showToast({
          type: "success",
          title: "Retries queued",
          message: `${result.retriedCount} failed ${result.queueLabel} jobs were returned to the queue.`,
        });
      }
      await jobsQuery.refetch();
      if (kind === "crawler") {
        await queryClient.invalidateQueries({
          queryKey: ["crawler", "queue-failure-reasons"],
        });
      }
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: `Could not retry failed ${queueLabel} jobs`,
        message: error.message,
      });
    },
  });
  const jobs = jobsQuery.data?.items ?? [];
  const statusCounts = jobsQuery.data?.status_counts ?? {};
  const queuedCount = statusCounts.queued ?? 0;
  const runningCount = statusCounts.running ?? 0;
  const succeededCount = statusCounts.succeeded ?? 0;
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const failedCount = statusCounts.failed ?? 0;
  const manualCount = statusCounts.manual ?? 0;
  const skippedCount = statusCounts.skipped ?? 0;
  const visibleJobs = jobs;
  const selectedCount = selectedJobs.size;
  const selectedPageCount = visibleJobs.filter((job) =>
    selectedJobs.has(job.id),
  ).length;
  const allVisibleSelected =
    visibleJobs.length > 0 && selectedPageCount === visibleJobs.length;
  useEffect(() => {
    if (selectPageRef.current) {
      selectPageRef.current.indeterminate =
        selectedPageCount > 0 && !allVisibleSelected;
    }
  }, [selectedPageCount, allVisibleSelected]);
  const setJobSelected = (job: QueueJob, selected: boolean) => {
    setSelectedState((current) => {
      const jobsForKind =
        current.kind === kind
          ? new Map(current.jobs)
          : new Map<string, QueueJob>();
      if (selected) jobsForKind.set(job.id, job);
      else jobsForKind.delete(job.id);
      return { kind, jobs: jobsForKind };
    });
  };
  const toggleVisibleJobs = () => {
    setSelectedState((current) => {
      const jobsForKind =
        current.kind === kind
          ? new Map(current.jobs)
          : new Map<string, QueueJob>();
      if (allVisibleSelected) {
        visibleJobs.forEach((job) => jobsForKind.delete(job.id));
      } else {
        visibleJobs.forEach((job) => jobsForKind.set(job.id, job));
      }
      return { kind, jobs: jobsForKind };
    });
  };
  const clearSelectedJobs = () => {
    setSelectedState({ kind, jobs: new Map() });
  };
  const totalCount = jobsQuery.data?.total_count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const toggleStatusFilter = (status: QueueJobStatus) => {
    updatePage(1);
    setStatusFilterState((current) => ({
      kind,
      status:
        (current.kind === kind ? current.status : "all") === status
          ? "all"
          : status,
    }));
  };

  return (
    <>
      <header className="page-heading queue-page-heading">
        <div>
          <p className="eyebrow">{config.label}</p>
          <h1>{config.title}</h1>
          <p className="heading-copy">{config.description}</p>
        </div>
        <div className="queue-heading-actions">
          {kind === "crawler" && (
            <Link className="button button-secondary" href="/jobs/import">
              Import CSV
            </Link>
          )}
          <button
            className="button button-secondary"
            disabled={jobsQuery.isFetching}
            onClick={() => {
              void jobsQuery.refetch();
              if (kind === "crawler") {
                void queryClient.invalidateQueries({
                  queryKey: ["crawler", "queue-failure-reasons"],
                });
              }
            }}
            type="button"
          >
            {jobsQuery.isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section
        aria-label="Queue summary"
        className={`queue-stats-grid ${
          kind === "crawler"
            ? "queue-stats-grid-crawler"
            : kind === "keywords" || kind === "hypestat"
              ? "queue-stats-grid-keywords"
              : ""
        }`}
      >
        <QueueStat
          active={statusFilter === "queued"}
          label="Queued"
          onClick={() => toggleStatusFilter("queued")}
          value={queuedCount}
        />
        <QueueStat
          active={statusFilter === "running"}
          label="Running"
          onClick={() => toggleStatusFilter("running")}
          value={runningCount}
        />
        <QueueStat
          active={statusFilter === "succeeded"}
          label="Finished"
          onClick={() => toggleStatusFilter("succeeded")}
          value={succeededCount}
        />
        <QueueStat
          active={statusFilter === "failed"}
          label="Failed"
          onClick={() => toggleStatusFilter("failed")}
          value={failedCount}
        />
        {kind === "crawler" && (
          <QueueStat
            active={statusFilter === "manual"}
            label="Manual data"
            onClick={() => toggleStatusFilter("manual")}
            value={manualCount}
          />
        )}
        {(kind === "keywords" || kind === "hypestat") && (
          <QueueStat
            active={statusFilter === "skipped"}
            label="Skipped"
            onClick={() => toggleStatusFilter("skipped")}
            value={skippedCount}
          />
        )}
      </section>

      {jobsQuery.isError && (
        <p className="alert alert-error" role="alert">
          Could not refresh the queue: {jobsQuery.error.message}
        </p>
      )}
      {kind === "crawler" && crawlerFailureReasonsQuery.isError && (
        <p className="alert alert-error" role="alert">
          Could not load failure-reason filters:{" "}
          {crawlerFailureReasonsQuery.error.message}
        </p>
      )}
      {kind === "pagespeed" &&
        pageSpeedSettingsQuery.isError && (
          <p className="alert alert-warning" role="alert">
            Could not verify your Google PageSpeed API key. PageSpeed retries
            are disabled until settings can be checked.{" "}
            <Link href="/settings?section=pagespeed">Check PageSpeed settings</Link>
          </p>
        )}
      {kind === "pagespeed" &&
        !pageSpeedSettingsQuery.isLoading &&
        !pageSpeedSettingsQuery.isError &&
        pageSpeedSettingsQuery.data?.pagespeed_configured === false && (
          <p className="alert alert-warning" role="alert">
            A Google PageSpeed API key is required to run PageSpeed jobs. Jobs
            will remain queued until the user who created them adds a key.
            Google validates the key when a scan runs.{" "}
            <Link href="/settings?section=pagespeed">Add a PageSpeed key</Link>
          </p>
        )}
      {retryAllMutation.data &&
        retryAllMutation.data.failures.length > 0 && (
          <p className="alert alert-error" role="alert">
            Queued {retryAllMutation.data.retriedCount} of{" "}
            {retryAllMutation.data.total} failed{" "}
            {retryAllMutation.data.queueLabel} jobs for retry.{" "}
            {retryAllMutation.data.failures.length} could not be retried.
            First failure for{" "}
            {retryAllMutation.data.failures[0].websiteUrl}:{" "}
            {retryAllMutation.data.failures[0].message}
          </p>
        )}

      <section aria-labelledby="queue-jobs-heading" className="panel queue-panel">
        <div className="queue-panel-heading">
          <div className="queue-panel-title">
            <h2 id="queue-jobs-heading">
              {kind === "crawler" ? "Indexing activity" : "Recent jobs"}
            </h2>
            <p className="panel-subtitle">
              Showing {jobs.length} on this page.
              {kind === "keywords"
                ? " Status refreshes automatically every five seconds."
                : kind === "hypestat"
                  ? " HypeStat job status refreshes automatically every five seconds."
                  : ""}
            </p>
          </div>
          <span className="queue-total-count">
            <strong>{totalCount}</strong> total
          </span>
        </div>
        <div className="queue-panel-toolbar">
          <div className="queue-panel-controls">
            <input
              aria-label={
                kind === "crawler"
                  ? "Search indexing jobs by URL or failure reason"
                  : `Search ${queueLabel} jobs`
              }
              className="queue-search-input"
              maxLength={300}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={
                kind === "crawler"
                  ? "Search URL or failure reason"
                  : "Search website URL"
              }
              type="search"
              value={searchText}
            />
            {kind === "crawler" && (
              <select
                aria-label="Filter by failure reason"
                className="queue-failure-reason-filter"
                disabled={
                  crawlerFailureReasonsQuery.isLoading ||
                  crawlerFailureReasonsQuery.isError
                }
                onChange={(event) => {
                  setFailureReasonFilterState({
                    kind,
                    reason: event.target.value,
                  });
                  updatePage(1);
                }}
                value={failureReasonFilter}
              >
                <option value="">All failure reasons</option>
                {failureReasonFilter &&
                  !crawlerFailureReasonsQuery.data?.includes(
                    failureReasonFilter,
                  ) && (
                    <option value={failureReasonFilter}>
                      {failureReasonFilter}
                    </option>
                  )}
                {(crawlerFailureReasonsQuery.data ?? []).map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="queue-panel-actions">
            {kind === "crawler" && jobs.length > 0 && (
              <label className="queue-select-page">
                <input
                  aria-label={
                    allVisibleSelected
                      ? "Deselect all indexing jobs on this page"
                      : "Select all indexing jobs on this page"
                  }
                  checked={allVisibleSelected}
                  disabled={
                    excludeSelectedDomainsMutation.isPending ||
                    excludeDomainMutation.isPending
                  }
                  onChange={toggleVisibleJobs}
                  ref={selectPageRef}
                  type="checkbox"
                />
                <span>Select page</span>
              </label>
            )}
            {failedJobs.length > 0 && (
              <button
                className="button button-secondary queue-retry-button"
                disabled={
                  retryAllMutation.isPending ||
                  retryMutation.isPending ||
                  excludeDomainMutation.isPending ||
                  excludeSelectedDomainsMutation.isPending ||
                  !canRetryJobs
                }
                onClick={() => retryAllMutation.mutate(failedJobs)}
                title={`Retry all ${failedJobs.length} failed ${queueLabel} jobs on this page`}
                type="button"
              >
                {retryAllMutation.isPending
                  ? "Retrying all..."
                  : `Retry all on page (${failedJobs.length})`}
              </button>
            )}
          </div>
        </div>

        {kind === "crawler" && selectedCount > 0 && (
          <div
            aria-label="Selected indexing job actions"
            className="queue-selection-toolbar"
            role="region"
          >
            <span>
              {selectedCount} indexing job{selectedCount === 1 ? "" : "s"}{" "}
              selected
              <small>Selection stays active across pages and filters.</small>
            </span>
            <div>
              <button
                className="button button-primary"
                disabled={
                  excludeSelectedDomainsMutation.isPending ||
                  excludeDomainMutation.isPending ||
                  retryMutation.isPending ||
                  retryAllMutation.isPending
                }
                onClick={() =>
                  excludeSelectedDomainsMutation.mutate(
                    Array.from(selectedJobs.values()),
                  )
                }
                type="button"
              >
                {excludeSelectedDomainsMutation.isPending
                  ? "Excluding..."
                  : `Exclude selected (${selectedCount})`}
              </button>
              <button
                className="button button-secondary"
                disabled={excludeSelectedDomainsMutation.isPending}
                onClick={clearSelectedJobs}
                type="button"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {jobsQuery.isLoading ? (
          <TableLoading label={`Loading ${queueLabel} jobs`} rows={5} />
        ) : jobsQuery.isError && jobs.length === 0 ? (
          <p className="empty-copy">Queue jobs could not be loaded.</p>
        ) : jobs.length === 0 ? (
          <p className="empty-copy">
            No {queueLabel} jobs found.
          </p>
        ) : visibleJobs.length === 0 ? (
          <p className="empty-copy">No {queueLabel} jobs match your filters.</p>
        ) : (
          <div className={`pagespeed-job-list queue-job-list-${kind}`}>
            {visibleJobs.map((job) =>
              kind === "crawler" ? (
                <CrawlerQueueCard
                  canRetry={canRetryJobs}
                  isExcluding={
                    excludeDomainMutation.isPending &&
                    excludeDomainMutation.variables?.id === job.id
                  }
                  isRetrying={
                    retryMutation.isPending && retryMutation.variables === job.id
                  }
                  isSelected={selectedJobs.has(job.id)}
                  isSelectionBusy={
                    excludeSelectedDomainsMutation.isPending ||
                    excludeDomainMutation.isPending
                  }
                  isManualBusy={manualCompletionMutation.isPending}
                  isSubmittingManual={
                    manualCompletionMutation.isPending &&
                    manualCompletionMutation.variables?.jobId === job.id
                  }
                  isRetryingAll={retryAllMutation.isPending}
                  job={job}
                  key={job.id}
                  onExclude={() => excludeDomainMutation.mutate(job)}
                  onManual={() => setManualCompletionJob(job)}
                  onRetry={() => retryMutation.mutate(job.id)}
                  onSelect={(selected) => setJobSelected(job, selected)}
                />
              ) : (
                <article
                  className={`pagespeed-job-card queue-job-card queue-job-card-${kind}`}
                  key={job.id}
                >
                  <div className="pagespeed-job-card-heading">
                    <div>
                      <strong>{job.detail}</strong>
                      <a
                        href={job.websiteUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {job.websiteUrl}
                      </a>
                    </div>
                    <div className="queue-job-actions">
                      <span
                        className={`pagespeed-job-status pagespeed-job-status-${job.status}`}
                      >
                        {formatJobStatus(job.status)}
                      </span>
                      {job.status === "failed" && (
                        <button
                          className="button button-secondary queue-retry-button"
                          disabled={
                            retryMutation.isPending ||
                            retryAllMutation.isPending ||
                            !canRetryJobs
                          }
                          onClick={() => retryMutation.mutate(job.id)}
                          type="button"
                        >
                          {retryMutation.isPending &&
                          retryMutation.variables === job.id
                            ? "Retrying..."
                            : "Retry"}
                        </button>
                      )}
                    </div>
                  </div>
                  <dl className="pagespeed-job-times">
                    <div>
                      <dt>Queued</dt>
                      <dd>{formatTimestamp(job.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>
                        {job.startedAt
                          ? formatTimestamp(job.startedAt)
                          : "Not started"}
                      </dd>
                    </div>
                    <div>
                      <dt>Finished</dt>
                      <dd>
                        {job.completedAt
                          ? formatTimestamp(job.completedAt)
                          : "Not finished"}
                      </dd>
                    </div>
                    <div>
                      <dt>Elapsed</dt>
                      <dd>
                        {formatElapsedTime(job.startedAt, job.completedAt)}
                      </dd>
                    </div>
                  </dl>
                  {job.error && (
                    <p className="pagespeed-job-error">
                      <strong>Failure reason:</strong> {job.error}
                    </p>
                  )}
                  {job.skipReason && (
                    <p className="queue-job-skip-reason">
                      <strong>Skip reason:</strong> {job.skipReason}
                    </p>
                  )}
                </article>
              ),
            )}
          </div>
        )}
        {!jobsQuery.isLoading && !jobsQuery.isError && totalCount > 0 && (
          <div className="pagination-controls queue-pagination-controls">
            <span>
              Page {page} of {pageCount}
            </span>
            <label>
              Per page
              <select
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  updatePage(1);
                }}
                value={pageSize}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <button
              className="pagination-button"
              disabled={page <= 1 || jobsQuery.isFetching}
              onClick={() =>
                updatePage((current) => Math.max(1, current - 1))
              }
              type="button"
            >
              Previous
            </button>
            <button
              className="pagination-button"
              disabled={page >= pageCount || jobsQuery.isFetching}
              onClick={() =>
                updatePage((current) => Math.min(pageCount, current + 1))
              }
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>
      {manualCompletionJob && (
        <ManualCrawlEntryDialog
          isSubmitting={manualCompletionMutation.isPending}
          job={manualCompletionJob}
          onClose={() => {
            if (!manualCompletionMutation.isPending) {
              setManualCompletionJob(null);
            }
          }}
          onSubmit={(input) =>
            manualCompletionMutation.mutate({
              jobId: manualCompletionJob.id,
              input,
            })
          }
        />
      )}
    </>
  );
}

function CrawlerQueueCard({
  canRetry,
  isExcluding,
  isManualBusy,
  isRetrying,
  isRetryingAll,
  isSelected,
  isSelectionBusy,
  isSubmittingManual,
  job,
  onExclude,
  onManual,
  onRetry,
  onSelect,
}: {
  canRetry: boolean;
  isExcluding: boolean;
  isManualBusy: boolean;
  isRetrying: boolean;
  isRetryingAll: boolean;
  isSelected: boolean;
  isSelectionBusy: boolean;
  isSubmittingManual: boolean;
  job: QueueJob;
  onExclude: () => void;
  onManual: () => void;
  onRetry: () => void;
  onSelect: (selected: boolean) => void;
}) {
  return (
    <article className="pagespeed-job-card queue-crawler-card">
      <header className="queue-crawler-card-header">
        <label className="queue-crawler-select">
          <input
            aria-label={`Select indexing job for ${job.websiteUrl}`}
            checked={isSelected}
            disabled={isSelectionBusy}
            onChange={(event) => onSelect(event.target.checked)}
            type="checkbox"
          />
          <span className="sr-only">
            Select indexing job for {job.websiteUrl}
          </span>
        </label>
        <div className="queue-crawler-identity">
          <div className="queue-crawler-title-row">
            <strong>Website indexing</strong>
            <span
              className={`pagespeed-job-status pagespeed-job-status-${job.status}`}
            >
              {formatJobStatus(job.status)}
            </span>
          </div>
          <a href={job.websiteUrl} rel="noreferrer" target="_blank">
            {job.websiteUrl}
          </a>
        </div>
        {job.siteType && (
          <span className="queue-crawler-type">
            {formatSiteType(job.siteType)}
          </span>
        )}
      </header>

      {job.error && (
        <p className="queue-crawler-error">
          <strong>
            {job.status === "manual"
              ? "Original crawler failure"
              : "Failure reason"}
          </strong>
          <span>{job.error}</span>
        </p>
      )}
      {job.skipReason && (
        <p className="queue-crawler-error">
          <strong>Skip reason</strong>
          <span>{job.skipReason}</span>
        </p>
      )}

      <div className="queue-crawler-card-footer">
        <dl className="queue-crawler-meta">
          <div>
            <dt>Queued</dt>
            <dd title={formatTimestamp(job.createdAt)}>
              {formatCompactTimestamp(job.createdAt)}
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd title={job.startedAt ? formatTimestamp(job.startedAt) : ""}>
              {job.startedAt ? formatCompactTimestamp(job.startedAt) : "-"}
            </dd>
          </div>
          <div>
            <dt>Finished</dt>
            <dd title={job.completedAt ? formatTimestamp(job.completedAt) : ""}>
              {job.completedAt
                ? formatCompactTimestamp(job.completedAt)
                : "-"}
            </dd>
          </div>
          <div>
            <dt>Elapsed</dt>
            <dd>
              {job.startedAt
                ? formatElapsedTime(job.startedAt, job.completedAt)
                : "-"}
            </dd>
          </div>
        </dl>

        <footer className="queue-crawler-actions">
          {job.status === "failed" && (
            <>
              <button
                className="button button-primary queue-crawler-manual"
                disabled={isManualBusy}
                onClick={onManual}
                type="button"
              >
                {isSubmittingManual ? "Saving..." : "Enter manually"}
              </button>
              <button
                className="button button-secondary queue-crawler-retry"
                disabled={
                  isRetrying ||
                  isRetryingAll ||
                  isExcluding ||
                  isSelectionBusy ||
                  !canRetry
                }
                onClick={onRetry}
                type="button"
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            </>
          )}
          <button
            className="queue-crawler-exclude"
            disabled={
              isExcluding ||
              isSelectionBusy ||
              isRetrying ||
              isRetryingAll
            }
            onClick={onExclude}
            title={`Add ${job.websiteUrl} to Excluded domains`}
            type="button"
          >
            {isExcluding ? "Excluding..." : "Exclude"}
          </button>
        </footer>
      </div>
    </article>
  );
}

function formatCompactTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEnrichmentStatus(
  status: ManualEnrichmentStatus,
): string {
  switch (status) {
    case "queued":
      return "queued";
    case "already_available":
      return "already available";
    case "already_queued":
      return "already queued";
    case "not_configured":
      return "not configured";
    case "disabled":
      return "disabled in settings";
  }
}

function ManualCrawlEntryDialog({
  isSubmitting,
  job,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  job: QueueJob;
  onClose: () => void;
  onSubmit: (input: ManualWebsiteCrawlCompletionInput) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const getValue = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" ? value.trim() : "";
    };
    const getOptional = (name: string) => getValue(name) || null;
    const getList = (name: string) =>
      Array.from(
        new Set(
          getValue(name)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      );
    const input: ManualWebsiteCrawlCompletionInput = {
      site_type: getValue("site_type"),
      website_topics: getList("website_topics"),
      language: getOptional("language"),
      home_page_url: getOptional("home_page_url"),
      home_content: getOptional("home_content"),
      about_page_url: getOptional("about_page_url"),
      about_content: getOptional("about_content"),
      blog_page_url: getOptional("blog_page_url"),
      blog_content: getOptional("blog_content"),
      service_page_url: getOptional("service_page_url"),
      service_content: getOptional("service_content"),
      contact_page_url: getOptional("contact_page_url"),
      contact_content: getOptional("contact_content"),
      goals_page_url: getOptional("goals_page_url"),
      goals_content: getOptional("goals_content"),
      emails: getList("emails"),
      phones: getList("phones"),
      social_links: getList("social_links"),
    };
    onSubmit(input);
  }

  return (
    <dialog
      aria-labelledby="manual-crawl-dialog-title"
      className="crawl-dialog manual-crawl-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <header className="crawl-dialog-header">
        <div>
          <p className="eyebrow">MANUAL INDEXING</p>
          <h2 id="manual-crawl-dialog-title">Add website details</h2>
          <p className="heading-copy">
            Enter what you know for {job.websiteUrl}. The original crawl failure
            stays in the queue history; available enrichment jobs run in the
            background.
          </p>
        </div>
        <button
          aria-label="Close manual website data form"
          className="icon-button crawl-dialog-close"
          disabled={isSubmitting}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </header>
      <form
        className="website-form manual-crawl-form"
        onSubmit={handleSubmit}
      >
        <div className="manual-crawl-fields">
          <label>
            Site type <span aria-hidden="true">*</span>
            <input
              autoFocus
              maxLength={64}
              name="site_type"
              placeholder="For example, B2B SaaS"
              required
            />
          </label>
          <label>
            Topics <span className="manual-crawl-hint">(comma separated)</span>
            <input
              maxLength={1500}
              name="website_topics"
              placeholder="analytics, reporting, automation"
            />
          </label>
          <label>
            Language
            <input maxLength={35} name="language" placeholder="English" />
          </label>
          <label>
            Emails <span className="manual-crawl-hint">(comma separated)</span>
            <input
              maxLength={3200}
              name="emails"
              placeholder="hello@example.com"
            />
          </label>
          <label>
            Phone numbers <span className="manual-crawl-hint">(comma separated)</span>
            <input
              maxLength={5000}
              name="phones"
              placeholder="+1 555 010 1234"
            />
          </label>
          <label>
            Social profile URLs{" "}
            <span className="manual-crawl-hint">(comma separated)</span>
            <input
              maxLength={8000}
              name="social_links"
              placeholder="https://linkedin.com/company/example"
            />
          </label>
        </div>
        <details className="manual-crawl-pages">
          <summary>Optional page URLs and content</summary>
          {(
            [
              ["Home", "home_page_url", "home_content"],
              ["About", "about_page_url", "about_content"],
              ["Blog", "blog_page_url", "blog_content"],
              ["Services", "service_page_url", "service_content"],
              ["Contact", "contact_page_url", "contact_content"],
              ["Goals or mission", "goals_page_url", "goals_content"],
            ] as const
          ).map(([label, urlName, contentName]) => (
            <fieldset key={urlName}>
              <legend>{label}</legend>
              <label>
                Page URL
                <input
                  maxLength={2000}
                  name={urlName}
                  placeholder="https://example.com/page"
                  type="url"
                />
              </label>
              <label>
                Page content or notes
                <textarea
                  maxLength={20000}
                  name={contentName}
                  rows={3}
                />
              </label>
            </fieldset>
          ))}
        </details>
        <footer className="manual-crawl-form-actions">
          <button
            className="button button-secondary"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Save manual data"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function QueueStat({
  active = false,
  label,
  onClick,
  value,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
  value: number;
}) {
  if (onClick) {
    return (
      <button
        aria-label={`${label}: ${value}. ${
          active
            ? "Click to clear the status filter."
            : "Click to filter the queue."
        }`}
        aria-pressed={active}
        className={`stat-card queue-stat-card queue-stat-card-button${
          active ? " is-active" : ""
        }`}
        onClick={onClick}
        type="button"
      >
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    );
  }

  return (
    <article className="stat-card queue-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

