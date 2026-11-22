"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addExcludedDomain,
  getWebsiteCorpusAnalysisJobsPage,
  getApplicationSettings,
  getPageSpeedScanJobs,
  getWebsiteCrawlJobsPage,
  retryWebsiteCorpusAnalysisJob,
  retryWebsiteCorpusAnalysisJobs,
  retryPageSpeedScanJob,
  retryPageSpeedScanJobs,
  retryWebsiteCrawlJob,
  retryWebsiteCrawlJobs,
  type PageSpeedScanJob,
  type QueueJobsPageParams,
  type WebsiteCorpusAnalysisJob,
  type WebsiteCrawlJobResponse,
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

type QueueKind = "crawler" | "pagespeed" | "keywords";

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
    description:
      "Track indexing jobs from dispatch through completion, including run times and failures.",
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

export function JobQueuePage({ kind }: { kind: QueueKind }) {
  const config = queueConfig[kind];
  const queueLabel =
    kind === "crawler"
      ? "indexing"
      : kind === "pagespeed"
        ? "PageSpeed"
        : "keyword generation";
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [statusFilterState, setStatusFilterState] = useState<{
    kind: QueueKind;
    status: "all" | QueueJobStatus;
  }>({ kind, status: "all" });
  const statusFilter =
    statusFilterState.kind === kind ? statusFilterState.status : "all";
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const queueParams: QueueJobsPageParams = {
    page,
    page_size: pageSize,
    search: debouncedSearch,
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
        : corpusAnalysisJobsQuery;
  const canRetryJobs =
    kind !== "pagespeed" ||
    pageSpeedSettingsQuery.data?.pagespeed_configured === true;
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (kind === "crawler") {
        await retryWebsiteCrawlJob(jobId);
      } else if (kind === "keywords") {
        await retryWebsiteCorpusAnalysisJob(jobId);
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
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not retry job",
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
        message: `${domain.domain} was excluded and its queued indexing jobs were removed.`,
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
  const retryAllMutation = useMutation({
    mutationFn: async (failedJobs: QueueJob[]) => {
      const result =
        kind === "crawler"
          ? await retryWebsiteCrawlJobs(failedJobs.map((job) => job.id))
          : kind === "pagespeed"
            ? await retryPageSpeedScanJobs(failedJobs.map((job) => job.id))
            : await retryWebsiteCorpusAnalysisJobs(
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
  const skippedCount = statusCounts.skipped ?? 0;
  const visibleJobs = jobs;
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
      <header className="page-heading">
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
            onClick={() => void jobsQuery.refetch()}
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
            : kind === "keywords"
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
        {kind === "keywords" && (
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
          <div>
            <h2 id="queue-jobs-heading">Recent jobs</h2>
            <p className="panel-subtitle">
              Showing {jobs.length} of {totalCount} matching jobs.
              {kind === "keywords"
                ? " Status refreshes automatically every five seconds."
                : " Job status updates are streamed in real time."}
            </p>
          </div>
          <div className="queue-panel-controls">
            <input
              aria-label={`Search ${queueLabel} jobs`}
              className="queue-search-input"
              maxLength={300}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search website URL"
              type="search"
              value={searchText}
            />
            {failedJobs.length > 0 && (
              <button
                className="button button-secondary queue-retry-button"
                disabled={
                  retryAllMutation.isPending ||
                  retryMutation.isPending ||
                  excludeDomainMutation.isPending ||
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
          <div className="pagespeed-job-list">
            {visibleJobs.map((job) => (
              <article className="pagespeed-job-card" key={job.id}>
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
                    {kind === "crawler" && (
                      <button
                        className="button button-secondary queue-exclude-button"
                        disabled={
                          excludeDomainMutation.isPending ||
                          retryMutation.isPending ||
                          retryAllMutation.isPending
                        }
                        onClick={() => excludeDomainMutation.mutate(job)}
                        title={`Add ${job.websiteUrl} to Excluded domains`}
                        type="button"
                      >
                        {excludeDomainMutation.isPending &&
                        excludeDomainMutation.variables?.id === job.id
                          ? "Excluding..."
                          : "Exclude domain"}
                      </button>
                    )}
                    {job.status === "failed" && (
                      <button
                        className="button button-secondary queue-retry-button"
                        disabled={
                          retryMutation.isPending ||
                          retryAllMutation.isPending ||
                          excludeDomainMutation.isPending ||
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
                    <dd>{job.startedAt ? formatTimestamp(job.startedAt) : "Not started"}</dd>
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
                {job.siteType && (
                  <p className="queue-job-site-type">
                    Site type: <strong>{formatSiteType(job.siteType)}</strong>
                  </p>
                )}
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
            ))}
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
    </>
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

