"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { crawlWebsite, crawlWebsites } from "@/lib/api";
import { useToast } from "./toast-provider";

const MAX_WEBSITES_PER_BATCH = 100;

export function CrawlWebsiteDialog({
  onClose,
  onWebsiteQueued,
}: {
  onClose: () => void;
  onWebsiteQueued?: () => void;
}) {
  const showToast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [websiteUrls, setWebsiteUrls] = useState("");
  const [websiteInputError, setWebsiteInputError] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const crawlMutation = useMutation({
    mutationFn: crawlWebsite,
    onSuccess: () => {
      onWebsiteQueued?.();
      showToast({
        type: "success",
        title: "Website added",
        message: "Queued for indexing.",
      });
      onClose();
    },
  });
  const batchMutation = useMutation({
    mutationFn: crawlWebsites,
    onSuccess: (result) => {
      onWebsiteQueued?.();
      if (result.excluded.length > 0) {
        showToast({
          type: "warning",
          title: "Some websites were skipped",
          message: `Queued ${result.jobs.length}; excluded ${result.excluded.length}. Review the details below.`,
        });
        return;
      }

      showToast({
        type: "success",
        title: "Websites added",
        message: `${result.jobs.length} websites queued for indexing.`,
      });
      onClose();
    },
  });
  const isCrawlPending = crawlMutation.isPending || batchMutation.isPending;
  const enteredWebsiteCount = websiteUrls
    .split(/\r?\n/)
    .filter((websiteUrl) => websiteUrl.trim().length > 0).length;

  function handleCrawlWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    crawlMutation.reset();
    batchMutation.reset();
    const parsed = parseWebsiteList(websiteUrls);
    setWebsiteInputError(parsed.error);
    if (parsed.error) return;
    if (parsed.urls.length === 1) {
      crawlMutation.mutate({ website_url: parsed.urls[0] });
    } else {
      batchMutation.mutate(parsed.urls);
    }
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
          <h2 id="crawl-dialog-title">Add websites</h2>
        </div>
        <button
          aria-label="Close indexing dialog"
          className="icon-button crawl-dialog-close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </header>

      <section
        aria-labelledby="crawl-dialog-title"
        className="crawl-dialog-content"
      >
        <form className="crawl-dialog-form" onSubmit={handleCrawlWebsite}>
          <div className="crawl-dialog-url-field">
            <label htmlFor="website-urls">URLs</label>
            <textarea
              aria-describedby="crawl-dialog-url-hint"
              id="website-urls"
              onChange={(event) => {
                setWebsiteUrls(event.target.value);
                setWebsiteInputError(null);
              }}
              placeholder={"example.com\nhttps://another-example.com"}
              required
              rows={5}
              value={websiteUrls}
            />
            <span id="crawl-dialog-url-hint">
              One URL per line · Up to {MAX_WEBSITES_PER_BATCH} · HTTPS by
              default
            </span>
          </div>
          <div className="crawl-dialog-actions">
            <Link
              className="button button-secondary crawl-csv-link"
              href="/websites/import"
              onClick={onClose}
            >
              <FileSpreadsheet aria-hidden="true" size={15} />
              Import CSV
            </Link>
            <button
              className="button button-primary"
              disabled={isCrawlPending}
              type="submit"
            >
              {isCrawlPending
                ? "Adding..."
                : enteredWebsiteCount === 1
                  ? "Add website"
                  : "Add websites"}
              {!isCrawlPending && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>

        {websiteInputError && (
          <div className="alert alert-error" role="alert">
            {websiteInputError}
          </div>
        )}

        {isCrawlPending && (
          <div className="alert" role="status">
            {batchMutation.isPending
              ? `Adding ${enteredWebsiteCount} websites to the queue…`
              : "Adding website to the queue…"}
          </div>
        )}

        {crawlMutation.isError && (
          <div className="alert alert-error" role="alert">
            {crawlMutation.error.message}
          </div>
        )}

        {batchMutation.isError && (
          <div className="alert alert-error" role="alert">
            Could not queue websites: {batchMutation.error.message}
          </div>
        )}

        {batchMutation.data && (
          <div className="alert" role="status">
            <p>
              {batchMutation.data.jobs.length} queued
              {batchMutation.data.excluded.length > 0 &&
                ` · ${batchMutation.data.excluded.length} excluded`}
            </p>
            {batchMutation.data.excluded.length > 0 && (
              <ul>
                {batchMutation.data.excluded.map((item) => (
                  <li key={`${item.website_url}-${item.reason}`}>
                    {item.website_url}: {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </section>
    </dialog>
  );
}

function parseWebsiteList(value: string): {
  urls: string[];
  error: string | null;
} {
  const entries = value
    .split(/\r?\n/)
    .map((websiteUrl, index) => ({
      line: index + 1,
      value: websiteUrl.trim(),
    }))
    .filter((entry) => entry.value.length > 0);

  if (entries.length === 0) {
    return { urls: [], error: "Enter at least one website URL." };
  }
  if (entries.length > MAX_WEBSITES_PER_BATCH) {
    return {
      urls: [],
      error: `Add no more than ${MAX_WEBSITES_PER_BATCH} websites at a time.`,
    };
  }

  const seenDomains = new Set<string>();
  const urls: string[] = [];
  for (const entry of entries) {
    const websiteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(entry.value)
      ? entry.value
      : `https://${entry.value.replace(/^\/\//, "")}`;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(websiteUrl);
    } catch {
      return {
        urls: [],
        error: `Line ${entry.line}: enter a valid website URL.`,
      };
    }
    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return {
        urls: [],
        error: `Line ${entry.line}: use a public HTTP or HTTPS website URL.`,
      };
    }

    const domain = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (seenDomains.has(domain)) {
      return {
        urls: [],
        error: `Line ${entry.line}: ${domain} is listed more than once.`,
      };
    }
    seenDomains.add(domain);
    urls.push(parsedUrl.toString());
  }

  return { urls, error: null };
}
