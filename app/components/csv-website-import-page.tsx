"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  crawlWebsites,
  getWebsiteCrawlJobs,
  getWebsites,
} from "@/lib/api";
import { parseCsvRecords } from "@/lib/csv";
import { useToast } from "./toast-provider";

interface CsvWebsiteRow {
  rowNumber: number;
  websiteUrl: string;
  domainKey: string | null;
  error: string | null;
}

interface CsvImportResult {
  queuedUrls: string[];
  excluded: { websiteUrl: string; reason: string }[];
  failures: { websiteUrl: string; message: string }[];
}

const MAX_CSV_FILE_BYTES = 1_000_000;
const MAX_CSV_ROWS = 100;

export function CsvWebsiteImportPage({
  returnToWebsites = false,
}: {
  returnToWebsites?: boolean;
}) {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const hasUploadedCsvRef = useRef(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvFileSize, setCsvFileSize] = useState<number | null>(null);
  const [csvRows, setCsvRows] = useState<CsvWebsiteRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [csvProgressTotal, setCsvProgressTotal] = useState(0);
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const [isCsvReading, setIsCsvReading] = useState(false);
  const [isRefreshingDuplicates, setIsRefreshingDuplicates] = useState(false);
  const [duplicateChecksEnabled, setDuplicateChecksEnabled] = useState(false);

  const websitesQuery = useQuery({
    queryKey: ["websites"],
    queryFn: getWebsites,
    enabled: duplicateChecksEnabled,
  });
  const crawlerJobsQuery = useQuery({
    queryKey: ["crawler", "queue-jobs"],
    queryFn: getWebsiteCrawlJobs,
    enabled: duplicateChecksEnabled,
  });
  const websiteDomains = useMemo(
    () =>
      new Set(
        (websitesQuery.data ?? [])
          .map(
            (website) =>
              getDomainKey(website.website_url) ??
              getDomainKey(website.domain),
          )
          .filter((domain): domain is string => domain !== null),
      ),
    [websitesQuery.data],
  );
  const activeCrawlDomains = useMemo(
    () =>
      new Set(
        (crawlerJobsQuery.data ?? [])
          .filter((job) => job.status === "queued" || job.status === "running")
          .map((job) => getDomainKey(job.website_url))
          .filter((domain): domain is string => domain !== null),
      ),
    [crawlerJobsQuery.data],
  );
  const csvImportMutation = useMutation({
    mutationFn: async (rows: CsvWebsiteRow[]): Promise<CsvImportResult> => {
      setCsvProgressTotal(rows.length);

      try {
        const result = await crawlWebsites(
          rows.map((row) => row.websiteUrl),
        );
        return {
          queuedUrls: result.jobs.map((job) => job.website_url),
          excluded: result.excluded.map((item) => ({
            websiteUrl: item.website_url,
            reason: item.reason,
          })),
          failures: [],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error.";
        return {
          queuedUrls: [],
          excluded: [],
          failures: rows.map((row) => ({
            websiteUrl: row.websiteUrl,
            message,
          })),
        };
      }
    },
    onSuccess: async (result) => {
      if (result.failures.length > 0 || result.excluded.length > 0) {
        showToast({
          type:
            result.failures.length > 0 &&
            result.queuedUrls.length === 0 &&
            result.excluded.length === 0
              ? "error"
              : "warning",
          title:
            result.queuedUrls.length > 0 || result.excluded.length > 0
              ? "Import partially completed"
              : "Import could not be queued",
          message: `Queued ${result.queuedUrls.length}; excluded ${result.excluded.length}; failed ${result.failures.length}. See the import summary for details.`,
        });
      } else {
        showToast({
          type: "success",
          title: "Import queued",
          message: `${result.queuedUrls.length} websites were added to the crawl queue.`,
        });
      }
      await Promise.all([
        crawlerJobsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
  });
  const queuedByImport = new Set(
    (csvImportMutation.data?.queuedUrls ?? [])
      .map((websiteUrl) => getDomainKey(websiteUrl))
      .filter((domain): domain is string => domain !== null),
  );
  const excludedByImport = new Map<string, string>();
  for (const item of csvImportMutation.data?.excluded ?? []) {
    const domain = getDomainKey(item.websiteUrl);
    if (domain !== null) excludedByImport.set(domain, item.reason);
  }
  const duplicateCheckLoading =
    isRefreshingDuplicates ||
    websitesQuery.isFetching ||
    crawlerJobsQuery.isFetching;
  const duplicateCheckError = websitesQuery.isError || crawlerJobsQuery.isError;
  const duplicateChecksReady =
    websitesQuery.isSuccess &&
    crawlerJobsQuery.isSuccess &&
    !duplicateCheckLoading;
  const importableRows = duplicateChecksReady
    ? csvRows.filter(
        (row) =>
          !row.error &&
          row.domainKey !== null &&
          !excludedByImport.has(row.domainKey) &&
          !websiteDomains.has(row.domainKey) &&
          !activeCrawlDomains.has(row.domainKey) &&
          !queuedByImport.has(row.domainKey),
      )
    : [];
  const csvAlreadySavedCount = duplicateChecksReady
    ? csvRows.filter(
        (row) =>
          !row.error &&
          row.domainKey !== null &&
          websiteDomains.has(row.domainKey),
      ).length
    : 0;
  const csvAlreadyQueuedCount = duplicateChecksReady
    ? csvRows.filter(
        (row) =>
          !row.error &&
          row.domainKey !== null &&
          !websiteDomains.has(row.domainKey) &&
          (activeCrawlDomains.has(row.domainKey) ||
            queuedByImport.has(row.domainKey)),
      ).length
    : 0;
  const csvExcludedCount = duplicateChecksReady
    ? csvRows.filter(
        (row) =>
          !row.error &&
          row.domainKey !== null &&
          excludedByImport.has(row.domainKey),
      ).length
    : 0;
  const csvSkippedCount = duplicateChecksReady
    ? csvRows.length -
      importableRows.length -
      csvAlreadySavedCount -
      csvAlreadyQueuedCount -
      csvExcludedCount
    : 0;
  async function loadCsvFile(file: File | undefined) {
    if (
      !file ||
      csvImportMutation.isPending ||
      isCsvReading ||
      duplicateCheckLoading
    ) {
      return;
    }

    const shouldRefreshDuplicateChecks = hasUploadedCsvRef.current;
    hasUploadedCsvRef.current = true;
    setDuplicateChecksEnabled(true);
    setCsvFileName(file.name);
    setCsvFileSize(file.size);
    setCsvRows([]);
    setCsvFileError(null);
    setCsvProgressTotal(0);
    setIsCsvReading(true);
    csvImportMutation.reset();

    try {
      const result = await readCsvFile(file);
      setCsvRows(result.rows);
      setCsvFileError(result.error);
      setIsCsvReading(false);
      if (result.rows.length > 0 && shouldRefreshDuplicateChecks) {
        await refreshDuplicateChecks();
      }
    } catch (error) {
      setCsvFileError(
        error instanceof Error
          ? error.message
          : "The CSV file could not be read.",
      );
    } finally {
      setIsCsvReading(false);
    }
  }

  async function refreshDuplicateChecks() {
    setIsRefreshingDuplicates(true);
    try {
      await Promise.all([
        websitesQuery.refetch({ throwOnError: false }),
        crawlerJobsQuery.refetch({ throwOnError: false }),
      ]);
    } finally {
      setIsRefreshingDuplicates(false);
    }
  }

  function clearCsvFile() {
    setCsvFileName("");
    setCsvFileSize(null);
    setCsvRows([]);
    setCsvFileError(null);
    setCsvProgressTotal(0);
    csvImportMutation.reset();
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  return (
    <div className="queue-csv-page">
      <Link
        className="queue-csv-back-link"
        href={returnToWebsites ? "/websites" : "/jobs?tab=crawler"}
      >
        <ArrowLeft aria-hidden="true" size={15} />
        {returnToWebsites ? "Back to websites" : "Back to jobs"}
      </Link>
      <header className="page-heading queue-csv-page-heading">
        <div>
          <p className="eyebrow">CRAWL QUEUE</p>
          <h1>Import websites</h1>
          <p className="heading-copy">
            Upload a CSV of website URLs to queue crawls.
          </p>
        </div>
      </header>

      <section
        aria-label="CSV website import"
        className="panel queue-csv-import"
      >
        <input
          aria-describedby="queue-csv-guidance"
          aria-label="Choose a CSV file"
          accept=".csv,text/csv"
          className="queue-csv-file-input"
          disabled={
            csvImportMutation.isPending ||
            isCsvReading ||
            duplicateCheckLoading
          }
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void loadCsvFile(file);
          }}
          ref={csvInputRef}
          tabIndex={-1}
          type="file"
        />

        {!csvFileName ? (
          <div
            aria-busy={
              isCsvReading ||
              duplicateCheckLoading ||
              csvImportMutation.isPending
            }
            className={`queue-csv-dropzone${isCsvDragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              if (
                !isCsvReading &&
                !duplicateCheckLoading &&
                !csvImportMutation.isPending
              ) {
                setIsCsvDragging(true);
              }
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (
                nextTarget instanceof Node &&
                event.currentTarget.contains(nextTarget)
              ) {
                return;
              }
              setIsCsvDragging(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsCsvDragging(false);
              void loadCsvFile(event.dataTransfer.files.item(0) ?? undefined);
            }}
          >
            <span aria-hidden="true" className="queue-csv-upload-icon">
              <Upload size={22} />
            </span>
            <div className="queue-csv-dropzone-copy">
              <strong>Drop a CSV file here</strong>
            </div>
            <button
              className="button button-secondary"
              onClick={() => csvInputRef.current?.click()}
              type="button"
            >
              Browse files
            </button>
          </div>
        ) : (
          <div
            aria-busy={
              isCsvReading ||
              duplicateCheckLoading ||
              csvImportMutation.isPending
            }
            className={`queue-csv-file-card${csvFileError ? " is-error" : ""}`}
            role="status"
          >
            <FileSpreadsheet aria-hidden="true" size={20} />
            <div className="queue-csv-file-copy">
              <strong title={csvFileName}>{csvFileName}</strong>
              <span>
                {csvImportMutation.isPending
                  ? `Queueing ${csvProgressTotal} websites…`
                  : isCsvReading
                    ? "Reading file…"
                    : duplicateCheckLoading
                      ? "Checking for duplicates…"
                      : `${csvRows.length} website${csvRows.length === 1 ? "" : "s"} · ${formatFileSize(csvFileSize ?? 0)}`}
              </span>
            </div>
            <div className="queue-csv-file-actions">
              <button
                className="button button-secondary"
                disabled={
                  csvImportMutation.isPending ||
                  isCsvReading ||
                  duplicateCheckLoading
                }
                onClick={() => csvInputRef.current?.click()}
                type="button"
              >
                Change file
              </button>
              <button
                className="button button-quiet"
                disabled={
                  csvImportMutation.isPending ||
                  isCsvReading ||
                  duplicateCheckLoading
                }
                onClick={clearCsvFile}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <p className="queue-csv-guidance" id="queue-csv-guidance">
          CSV <span aria-hidden="true">·</span> {formatFileSize(MAX_CSV_FILE_BYTES)}{" "}
          max <span aria-hidden="true">·</span> up to {MAX_CSV_ROWS} rows{" "}
          <span aria-hidden="true">·</span> header:{" "}
          <code>website_url</code> or <code>url</code>
        </p>

        {csvFileError && (
          <p className="alert alert-error" role="alert">
            {csvFileError}
          </p>
        )}

        {csvFileName && websitesQuery.isError && (
          <div className="queue-csv-query-error alert alert-error" role="alert">
            <span>
              Could not check the saved website list:{" "}
              {websitesQuery.error.message}
            </span>
            <button
              className="button button-secondary"
              onClick={() => void websitesQuery.refetch()}
              type="button"
            >
              Retry check
            </button>
          </div>
        )}
        {csvFileName && crawlerJobsQuery.isError && (
          <div className="queue-csv-query-error alert alert-error" role="alert">
            <span>
              Could not check active crawl jobs:{" "}
              {crawlerJobsQuery.error.message}
            </span>
            <button
              className="button button-secondary"
              onClick={() => void crawlerJobsQuery.refetch()}
              type="button"
            >
              Retry check
            </button>
          </div>
        )}

        {csvRows.length > 0 && (
          <>
            <div
              aria-label="CSV import summary"
              className="queue-csv-summary"
              role="status"
            >
              <div className="queue-csv-summary-card">
                <strong>{duplicateChecksReady ? importableRows.length : "—"}</strong>
                <span>Ready to queue</span>
              </div>
              <div className="queue-csv-summary-card">
                <strong>
                  {duplicateChecksReady ? csvAlreadySavedCount : "—"}
                </strong>
                <span>Already saved</span>
              </div>
              <div className="queue-csv-summary-card">
                <strong>
                  {duplicateChecksReady ? csvAlreadyQueuedCount : "—"}
                </strong>
                <span>Already queued</span>
              </div>
              <div className="queue-csv-summary-card">
                <strong>{duplicateChecksReady ? csvSkippedCount : "—"}</strong>
                <span>Needs attention</span>
              </div>
            </div>
            <div
              aria-label="CSV website preview"
              className="queue-csv-preview"
              role="region"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Website</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row) => {
                    const alreadySaved =
                      duplicateChecksReady &&
                      row.domainKey !== null &&
                      websiteDomains.has(row.domainKey);
                    const alreadyQueued =
                      duplicateChecksReady &&
                      !alreadySaved &&
                      row.domainKey !== null &&
                      activeCrawlDomains.has(row.domainKey);
                    const queuedInThisImport =
                      row.domainKey !== null &&
                      queuedByImport.has(row.domainKey);
                    const exclusionReason =
                      row.domainKey === null
                        ? undefined
                        : excludedByImport.get(row.domainKey);
                    const importFailure =
                      csvImportMutation.data?.failures.find(
                        (failure) => failure.websiteUrl === row.websiteUrl,
                      );
                    const status = row.error
                      ? "issue"
                      : exclusionReason
                        ? "issue"
                        : queuedInThisImport
                          ? "queued"
                          : importFailure
                            ? "issue"
                            : !duplicateChecksReady
                              ? "checking"
                              : alreadySaved
                                ? "existing"
                                : alreadyQueued
                                  ? "already-queued"
                                  : "ready";
                    const statusLabel = row.error
                      ? row.error
                      : exclusionReason
                        ? `Excluded: ${exclusionReason}`
                        : queuedInThisImport
                          ? "Queued"
                          : importFailure
                            ? `Failed to queue: ${importFailure.message}`
                            : !duplicateChecksReady
                              ? duplicateCheckError
                                ? "Duplicate check unavailable"
                                : "Checking duplicates…"
                              : alreadySaved
                                ? "Already in website list"
                                : alreadyQueued
                                  ? "Already queued or running"
                                  : "Ready";

                    return (
                      <tr key={`${row.rowNumber}-${row.websiteUrl}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.websiteUrl || "—"}</td>
                        <td>
                          <span
                            className={`queue-csv-status is-${status}`}
                            title={statusLabel}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {csvImportMutation.data &&
              csvImportMutation.data.failures.length > 0 && (
                <p className="alert alert-error" role="alert">
                  Queued {csvImportMutation.data.queuedUrls.length} of{" "}
                  {csvImportMutation.data.queuedUrls.length +
                    csvImportMutation.data.failures.length}{" "}
                  websites. {csvImportMutation.data.failures.length} failed.
                  Use the queue button to retry the remaining websites.
                </p>
              )}
            <div className="queue-csv-actions">
              <button
                className="button button-primary"
                disabled={
                  importableRows.length === 0 ||
                  !duplicateChecksReady ||
                  duplicateCheckError ||
                  csvImportMutation.isPending ||
                  isCsvReading
                }
                onClick={() => csvImportMutation.mutate(importableRows)}
                type="button"
              >
                {csvImportMutation.isPending
                  ? "Queueing…"
                  : `Queue ${importableRows.length} website${importableRows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function getDomainKey(websiteUrl: string): string | null {
  try {
    const url = new URL(addDefaultHttpScheme(websiteUrl.trim()));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

async function readCsvFile(
  file: File | undefined,
): Promise<{
  fileName: string;
  rows: CsvWebsiteRow[];
  error: string | null;
}> {
  if (!file) return { fileName: "", rows: [], error: null };
  if (file.size > MAX_CSV_FILE_BYTES) {
    return {
      fileName: file.name,
      rows: [],
      error: "CSV files must be 1 MB or smaller.",
    };
  }

  try {
    const records = parseCsvRecords((await file.text()).replace(/^\uFEFF/, ""));
    if (records.length === 0) {
      throw new Error("The CSV file is empty.");
    }

    const headers = records[0].map((header) => header.trim().toLowerCase());
    const urlColumn = headers.findIndex(
      (header) => header === "website_url" || header === "url",
    );
    if (urlColumn < 0) {
      throw new Error("Add a `website_url` or `url` column to the CSV.");
    }

    const dataRows = records.slice(1);
    if (dataRows.length === 0) {
      throw new Error("The CSV has a header but no website rows.");
    }
    if (dataRows.length > MAX_CSV_ROWS) {
      throw new Error(`The CSV can contain at most ${MAX_CSV_ROWS} website rows.`);
    }

    const firstDomainRow = new Map<string, number>();
    const rows = dataRows.map((record, index): CsvWebsiteRow => {
      const rawWebsiteUrl = (record[urlColumn] ?? "").trim();
      const rowNumber = index + 2;
      if (!rawWebsiteUrl) {
        return {
          rowNumber,
          websiteUrl: rawWebsiteUrl,
          domainKey: null,
          error: "Website URL is missing",
        };
      }

      const websiteUrl = addDefaultHttpScheme(rawWebsiteUrl);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(websiteUrl);
      } catch {
        return {
          rowNumber,
          websiteUrl: rawWebsiteUrl,
          domainKey: null,
          error: "Enter a valid website address, such as example.com",
        };
      }
      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        !parsedUrl.hostname ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        return {
          rowNumber,
          websiteUrl,
          domainKey: null,
          error: "Use a public HTTP or HTTPS website URL",
        };
      }

      const domainKey = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
      const firstRow = firstDomainRow.get(domainKey);
      if (firstRow !== undefined) {
        return {
          rowNumber,
          websiteUrl,
          domainKey,
          error: `Duplicate domain (first listed on row ${firstRow})`,
        };
      }
      firstDomainRow.set(domainKey, rowNumber);
      return { rowNumber, websiteUrl, domainKey, error: null };
    });

    return { fileName: file.name, rows, error: null };
  } catch (error) {
    return {
      fileName: file.name,
      rows: [],
      error:
        error instanceof Error ? error.message : "The CSV file could not be read.",
    };
  }
}

function addDefaultHttpScheme(websiteUrl: string): string {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) return websiteUrl;
  return `https://${websiteUrl.replace(/^\/\//, "")}`;
}
