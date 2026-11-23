"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getApplicationSettings,
  getPageSpeedScanJobs,
  getWebsiteCorpusAnalysisJobsPage,
  getWebsiteCrawlJobsPage,
  getWebsiteHypeStatJobsPage,
  type QueueJobsPageParams,
} from "@/lib/api";
import { JobQueuePage } from "./job-queue-page";

type JobQueueKind = "crawler" | "pagespeed" | "keywords" | "hypestat";

const firstQueuePage: QueueJobsPageParams = {
  page: 1,
  page_size: 25,
  search: "",
};

function prefetchQueue(
  kind: JobQueueKind,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  if (kind === "crawler") {
    void queryClient.prefetchQuery({
      queryKey: ["crawler", "queue-jobs", firstQueuePage],
      queryFn: () => getWebsiteCrawlJobsPage(firstQueuePage),
      staleTime: 30_000,
    });
  } else if (kind === "pagespeed") {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["pagespeed", "queue-jobs", firstQueuePage],
        queryFn: () => getPageSpeedScanJobs(firstQueuePage),
        staleTime: 30_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["application-settings"],
        queryFn: getApplicationSettings,
        staleTime: 30_000,
      }),
    ]);
  } else if (kind === "keywords") {
    void queryClient.prefetchQuery({
      queryKey: ["website-corpus-analysis", "queue-jobs", firstQueuePage],
      queryFn: () => getWebsiteCorpusAnalysisJobsPage(firstQueuePage),
      staleTime: 30_000,
    });
  } else {
    void queryClient.prefetchQuery({
      queryKey: ["hypestat", "queue-jobs", firstQueuePage],
      queryFn: () => getWebsiteHypeStatJobsPage(firstQueuePage),
      staleTime: 30_000,
    });
  }
}

export function JobsPage({ kind: initialKind }: { kind: JobQueueKind }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tab = searchParams.get("tab");
  const kind: JobQueueKind =
    tab === "pagespeed"
      ? "pagespeed"
      : tab === "keywords"
        ? "keywords"
        : tab === "hypestat"
          ? "hypestat"
        : tab === "crawler"
          ? "crawler"
          : initialKind;
  const tabs: { kind: JobQueueKind; label: string }[] = [
    { kind: "crawler", label: "Indexing" },
    { kind: "pagespeed", label: "PageSpeed" },
    { kind: "hypestat", label: "HypeStat" },
    { kind: "keywords", label: "Keywords" },
  ];

  return (
    <>
      <nav aria-label="Job queue type" className="jobs-tabs">
        {tabs.map((tabOption) => (
          <Link
            aria-current={kind === tabOption.kind ? "page" : undefined}
            className={kind === tabOption.kind ? "is-active" : ""}
            href={`/jobs?tab=${tabOption.kind}`}
            key={tabOption.kind}
            prefetch={false}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              if (kind === tabOption.kind) return;
              window.history.pushState(
                null,
                "",
                `/jobs?tab=${tabOption.kind}`,
              );
            }}
            onFocus={() => prefetchQueue(tabOption.kind, queryClient)}
            onMouseEnter={() => prefetchQueue(tabOption.kind, queryClient)}
          >
            {tabOption.label}
          </Link>
        ))}
      </nav>
      <JobQueuePage kind={kind} key={kind} />
    </>
  );
}
