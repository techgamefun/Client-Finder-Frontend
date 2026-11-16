"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ScanSearch, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { crawlWebsite, getWebsiteCrawlJob } from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";

export function CrawlWebsiteDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const crawlMutation = useMutation({
    mutationFn: crawlWebsite,
    onMutate: () => setJobId(null),
    onSuccess: (job) => setJobId(job.id),
  });
  const jobQuery = useQuery({
    queryKey: ["website-crawl-job", jobId],
    queryFn: () => {
      if (jobId === null) {
        throw new Error("A crawl job must be queued before checking status.");
      }
      return getWebsiteCrawlJob(jobId);
    },
    enabled: jobId !== null,
  });
  const crawlJob = jobQuery.data;
  const crawlResult = crawlJob?.result;
  const isCrawlPending =
    crawlMutation.isPending ||
    crawlJob?.status === "queued" ||
    crawlJob?.status === "running";
  const crawledPages = crawlResult
    ? [
        {
          label: "Home",
          url: crawlResult.home_page_url,
          content: crawlResult.home_content,
        },
        {
          label: "About",
          url: crawlResult.about_page_url,
          content: crawlResult.about_content,
        },
        {
          label: "Blog",
          url: crawlResult.blog_page_url,
          content: crawlResult.blog_content,
        },
        {
          label: "Services",
          url: crawlResult.service_page_url,
          content: crawlResult.service_content,
        },
        {
          label: "Contact",
          url: crawlResult.contact_page_url,
          content: crawlResult.contact_content,
        },
        {
          label: "Mission & goals",
          url: crawlResult.goals_page_url,
          content: crawlResult.goals_content,
        },
      ].filter((page) => page.url || page.content)
    : [];

  function handleCrawlWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    crawlMutation.mutate({ website_url: websiteUrl.trim() });
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      aria-labelledby="crawl-dialog-title"
      className="crawl-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleDialogClick}
      ref={dialogRef}
    >
      <header className="crawl-dialog-header">
        <div>
          <p className="eyebrow">WEBSITE RESEARCH</p>
          <h2 id="crawl-dialog-title">Crawl a website</h2>
          <p className="heading-copy">
            Collect public company information from its homepage and relevant
            About, Blog, Services, Contact, and Mission pages.
          </p>
        </div>
        <button
          aria-label="Close crawl dialog"
          className="icon-button crawl-dialog-close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </header>

      <article className="panel crawler-panel crawler-page-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PUBLIC WEBSITE CRAWLER</p>
            <h2>Enter a company website</h2>
            <p className="panel-subtitle">
              The crawler visits a small number of pages on the same public
              website and extracts page text, email addresses, and social links.
            </p>
          </div>
          <ScanSearch aria-hidden="true" className="sparkle" size={22} />
        </div>

        <form className="crawler-form" onSubmit={handleCrawlWebsite}>
          <label htmlFor="website-url">
            Website URL
            <input
              autoComplete="url"
              id="website-url"
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              required
              type="url"
              value={websiteUrl}
            />
          </label>
          <button
            className="button button-primary"
            disabled={isCrawlPending}
            type="submit"
          >
            {isCrawlPending ? "Crawling..." : "Crawl website"}
            {!isCrawlPending && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {isCrawlPending && (
          <div className="alert" role="status">
            Crawl job {crawlJob?.status ?? "queued"}. This page will update
            when it finishes.
          </div>
        )}

        {crawlMutation.isError && (
          <div className="alert alert-error" role="alert">
            {crawlMutation.error.message}
          </div>
        )}

        {jobQuery.isError && (
          <div className="alert alert-error" role="alert">
            Could not check crawl status: {jobQuery.error.message}
          </div>
        )}

        {crawlJob?.status === "failed" && (
          <div className="alert alert-error" role="alert">
            Crawl failed: {crawlJob.error || "The crawl job failed."}
          </div>
        )}

        {crawlJob?.status === "succeeded" && crawlResult && (
          <div className="crawl-result" role="status">
            <div className="crawl-result-heading">
              <div>
                <strong>Crawl saved</strong>
                <a
                  href={crawlResult.website_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {crawlResult.website_url}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </div>
              <span>{new Date(crawlResult.crawled_at).toLocaleString()}</span>
            </div>
            <p className="crawl-site-type">
              Site type: <strong>{formatSiteType(crawlResult.site_type)}</strong>
            </p>

            {crawledPages.length > 0 ? (
              <div className="crawl-pages">
                {crawledPages.map((page) => (
                  <article className="crawl-page" key={page.label}>
                    <div>
                      <strong>{page.label}</strong>
                      {page.url && (
                        <a href={page.url} rel="noreferrer" target="_blank">
                          Open page ↗
                        </a>
                      )}
                    </div>
                    <p>{page.content || "No page text was extracted."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-copy">
                No page text was extracted.
              </p>
            )}

            <div className="crawl-extracted">
              <ExtractedList
                title="Email addresses"
                values={crawlResult.emails}
                href={(email) => `mailto:${email}`}
              />
              <ExtractedList
                title="Social links"
                values={crawlResult.social_links}
                href={(url) => url}
                external
              />
            </div>
          </div>
        )}
      </article>
    </dialog>
  );
}

function ExtractedList({
  title,
  values,
  href,
  external = false,
}: {
  title: string;
  values: string[];
  href: (value: string) => string;
  external?: boolean;
}) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>
              <a
                href={href(value)}
                rel={external ? "noreferrer" : undefined}
                target={external ? "_blank" : undefined}
              >
                {value}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>None found</p>
      )}
    </div>
  );
}
