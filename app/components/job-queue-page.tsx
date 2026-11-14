"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getPageSpeedScanJobs,
  getWebsiteCrawlJobs,
  retryPageSpeedScanJob,
  retryWebsiteCrawlJob,
  type PageSpeedScanJob,
  type WebsiteCrawlJobResponse,
} from "@/lib/api";
import {
  formatElapsedTime,
  formatJobStatus,
  formatTimestamp,
  type QueueJobStatus,
} from "@/lib/job-format";
import { formatSiteType } from "@/lib/site-type";

type QueueKind = "crawler" | "pagespeed";

interface QueueJob {
  id: string;
  websiteUrl: string;
  siteType: string | null;
  detail: string;
  status: QueueJobStatus;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const queueConfig = {
  crawler: {
    title: "Website crawler queue",
    description:
      "Track crawl jobs from dispatch through completion, including run times and failures.",
    label: "WEBSITE CRAWLER",
  },
  pagespeed: {
    title: "PageSpeed queue",
    description:
      "Track background PageSpeed scans, their progress, duration, and any failures.",
    label: "PAGESPEED INSIGHTS",
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
    detail: "Website crawl",
    status: job.status,
    error: job.error,
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
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

export function JobQueuePage({ kind }: { kind: QueueKind }) {
  const config = queueConfig[kind];
  const [statusFilter, setStatusFilter] = useState<"all" | QueueJobStatus>(
    "all",
  );
  const jobsQuery = useQuery<QueueJob[]>({
    queryKey: [kind, "queue-jobs"],
    queryFn: async () => {
      if (kind === "crawler") {
        return (await getWebsiteCrawlJobs()).map(normalizeCrawlerJob);
      }
      return (await getPageSpeedScanJobs()).map(normalizePageSpeedJob);
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (kind === "crawler") {
        await retryWebsiteCrawlJob(jobId);
      } else {
        await retryPageSpeedScanJob(jobId);
      }
    },
    onSuccess: async () => {
      await jobsQuery.refetch();
    },
  });
  const jobs = jobsQuery.data ?? [];
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const runningCount = jobs.filter((job) => job.status === "running").length;
  const succeededCount = jobs.filter(
    (job) => job.status === "succeeded",
  ).length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const visibleJobs =
    kind === "crawler" && statusFilter !== "all"
      ? jobs.filter((job) => job.status === statusFilter)
      : jobs;

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{config.label}</p>
          <h1>{config.title}</h1>
          <p className="heading-copy">{config.description}</p>
        </div>
        <button
          className="button button-secondary"
          disabled={jobsQuery.isFetching}
          onClick={() => void jobsQuery.refetch()}
          type="button"
        >
          {jobsQuery.isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section aria-label="Queue summary" className="queue-stats-grid">
        <QueueStat label="Queued" value={queuedCount} />
        <QueueStat label="Running" value={runningCount} />
        <QueueStat label="Finished" value={succeededCount} />
        <QueueStat label="Failed" value={failedCount} />
      </section>

      {jobsQuery.isError && (
        <p className="alert alert-error" role="alert">
          Could not refresh the queue: {jobsQuery.error.message}
        </p>
      )}
      {retryMutation.isError && (
        <p className="alert alert-error" role="alert">
          Could not retry the job: {retryMutation.error.message}
        </p>
      )}

      <section aria-labelledby="queue-jobs-heading" className="panel queue-panel">
        <div className="queue-panel-heading">
          <div>
            <h2 id="queue-jobs-heading">Recent jobs</h2>
            <p className="panel-subtitle">
              Showing {visibleJobs.length} of the latest {jobs.length} jobs.
              This page refreshes
              automatically.
            </p>
          </div>
          {kind === "crawler" && (
            <label className="select-filter queue-status-filter">
              <span className="sr-only">Filter crawl jobs by status</span>
              <select
                onChange={(event) => {
                  const value = event.target.value;
                  setStatusFilter(
                    value === "all" || isQueueJobStatus(value)
                      ? value
                      : "all",
                  );
                }}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="succeeded">Finished</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          )}
        </div>

        {jobsQuery.isLoading ? (
          <p className="empty-copy">Loading queue…</p>
        ) : jobsQuery.isError && jobs.length === 0 ? (
          <p className="empty-copy">Queue jobs could not be loaded.</p>
        ) : jobs.length === 0 ? (
          <p className="empty-copy">
            No {kind === "crawler" ? "crawl" : "PageSpeed"} jobs found.
          </p>
        ) : visibleJobs.length === 0 ? (
          <p className="empty-copy">
            No crawl jobs match the selected status.
          </p>
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
                    {job.status === "failed" && (
                      <button
                        className="button button-secondary queue-retry-button"
                        disabled={retryMutation.isPending}
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
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat-card queue-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function isQueueJobStatus(value: string): value is QueueJobStatus {
  return ["queued", "running", "succeeded", "failed"].includes(value);
}
