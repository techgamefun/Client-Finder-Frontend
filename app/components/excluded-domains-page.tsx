"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import {
  addExcludedDomain,
  addExcludedDomainsBatch,
  deleteExcludedDomain,
  getExcludedDomainCount,
  getExcludedDomains,
  type ExcludedDomainReason,
  type ExcludedDomainRecord,
  type ExcludedDomainInput,
} from "@/lib/api";
import { parseCsvRecords } from "@/lib/csv";
import { formatTimestamp } from "@/lib/job-format";
import { TableLoading } from "./page-loading";
import { useToast } from "./toast-provider";

const excludedDomainReasons: ExcludedDomainReason[] = [
  "Big Tech / Social",
  "Manual Exclusion",
  "Unreachable",
  "Blocked (403/429)",
];
const MAX_CSV_FILE_BYTES = 5_000_000;
const MAX_CSV_ROWS = 1000;
const PAGE_SIZES = [25, 50, 100];

export function ExcludedDomainsPage() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<
    ExcludedDomainReason | "all"
  >("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] =
    useState<ExcludedDomainReason>("Manual Exclusion");
  const [newNote, setNewNote] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<ExcludedDomainInput[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isReadingCsv, setIsReadingCsv] = useState(false);

  const excludedDomainCountQuery = useQuery({
    queryKey: ["excluded-domains", "count", search.trim(), reasonFilter],
    queryFn: () =>
      getExcludedDomainCount(
        search,
        reasonFilter === "all" ? undefined : reasonFilter,
      ),
  });
  const totalCount = excludedDomainCountQuery.data?.total_count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const excludedDomainsQuery = useQuery({
    queryKey: [
      "excluded-domains",
      "list",
      search.trim(),
      reasonFilter,
      visiblePage,
      pageSize,
    ],
    queryFn: () =>
      getExcludedDomains(
        search,
        reasonFilter === "all" ? undefined : reasonFilter,
        pageSize,
        (visiblePage - 1) * pageSize,
      ),
  });
  const domains = excludedDomainsQuery.data ?? [];

  const addExcludedMutation = useMutation({
    mutationFn: addExcludedDomain,
    onSuccess: async (domain) => {
      setNewDomain("");
      setNewNote("");
      setPage(1);
      showToast({
        type: "success",
        title: "Domain excluded",
        message: `${domain.domain} will be skipped by the indexing queue.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
  });

  const removeExcludedMutation = useMutation({
    mutationFn: deleteExcludedDomain,
    onSuccess: async () => {
      showToast({
        type: "success",
        title: "Domain re-enabled",
        message: "New indexing jobs can now be created for this domain.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: addExcludedDomainsBatch,
    onSuccess: async (result) => {
      setCsvRows([]);
      setCsvFileName("");
      setPage(1);
      if (csvInputRef.current) csvInputRef.current.value = "";
      showToast({
        type: "success",
        title: "CSV exclusions imported",
        message: `Added ${result.created_count}, updated ${result.updated_count}, and ignored ${result.duplicate_count} duplicate domains.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["excluded-domains"] }),
        queryClient.invalidateQueries({ queryKey: ["crawler", "queue-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["websites"] }),
      ]);
    },
  });

  async function readExcludedDomainsCsv(file: File | undefined) {
    setCsvFileName(file?.name ?? "");
    setCsvRows([]);
    setCsvError(null);
    importCsvMutation.reset();
    if (!file) return;
    if (file.size > MAX_CSV_FILE_BYTES) {
      setCsvError("CSV files must be 5 MB or smaller.");
      return;
    }

    setIsReadingCsv(true);
    try {
      const records = parseCsvRecords((await file.text()).replace(/^\uFEFF/, ""));
      if (records.length < 2) {
        throw new Error("The CSV must include a header and at least one domain.");
      }

      const headers = records[0].map((header) => header.trim().toLowerCase());
      const domainColumn = headers.findIndex((header) =>
        ["domain", "url", "website_url"].includes(header),
      );
      if (domainColumn < 0) {
        throw new Error("Add a `domain`, `url`, or `website_url` column.");
      }
      const reasonColumn = headers.indexOf("reason");
      const noteColumn = headers.indexOf("note");
      const dataRows = records.slice(1);
      if (dataRows.length > MAX_CSV_ROWS) {
        throw new Error(`The CSV can contain at most ${MAX_CSV_ROWS} domain rows.`);
      }

      const rows = dataRows.map((record, index): ExcludedDomainInput => {
        const rowNumber = index + 2;
        const domain = (record[domainColumn] ?? "").trim();
        if (!domain) {
          throw new Error(`A domain is missing on CSV row ${rowNumber}.`);
        }

        const reasonValue = (record[reasonColumn] ?? "").trim();
        const reason =
          reasonValue === ""
            ? newReason
            : excludedDomainReasons.find((value) => value === reasonValue);
        if (!reason) {
          throw new Error(
            `Invalid reason on CSV row ${rowNumber}. Use one of the reason options on this page.`,
          );
        }
        const note = (record[noteColumn] ?? "").trim();
        return { domain, reason, ...(note ? { note } : {}) };
      });
      setCsvRows(rows);
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : "The CSV file could not be read.",
      );
    } finally {
      setIsReadingCsv(false);
    }
  }

  return (
    <>
      <header className="page-heading excluded-domain-page-heading">
        <div>
          <h1>Excluded domains</h1>
          <p className="heading-copy">Subdomains are excluded automatically.</p>
        </div>
      </header>

      <section
        aria-label="Excluded domains list and controls"
        className="panel queue-panel excluded-domains-panel"
      >
        <div
          aria-label="Excluded domain filters"
          className="excluded-domain-toolbar"
          role="group"
        >
          <input
            aria-label="Search excluded domains"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search domains or notes"
            type="search"
            value={search}
          />
          <select
            aria-label="Filter by exclusion reason"
            onChange={(event) => {
              const reason = excludedDomainReasons.find(
                (value) => value === event.target.value,
              );
              setReasonFilter(reason ?? "all");
              setPage(1);
            }}
            value={reasonFilter}
          >
            <option value="all">All reasons</option>
            {excludedDomainReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <button
            aria-label="Refresh excluded domains"
            className="button button-secondary excluded-domain-refresh"
            disabled={
              excludedDomainsQuery.isFetching ||
              excludedDomainCountQuery.isFetching
            }
            onClick={() =>
              void Promise.all([
                excludedDomainsQuery.refetch(),
                excludedDomainCountQuery.refetch(),
              ])
            }
            title="Refresh"
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={15}
            />
          </button>
        </div>

        <form
          className="excluded-domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            addExcludedMutation.mutate({
              domain: newDomain,
              reason: newReason,
              note: newNote,
            });
          }}
        >
          <label>
            <span className="sr-only">Domain or URL</span>
            <input
              onChange={(event) => setNewDomain(event.target.value)}
              placeholder="Add domain or URL"
              required
              value={newDomain}
            />
          </label>
          <label>
            <span className="sr-only">Exclusion reason</span>
            <select
              aria-label="Default exclusion reason"
              onChange={(event) => {
                const reason = excludedDomainReasons.find(
                  (value) => value === event.target.value,
                );
                if (reason) setNewReason(reason);
              }}
              value={newReason}
            >
              {excludedDomainReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Note, optional</span>
            <input
              aria-label="Optional note"
              maxLength={4000}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="Note (optional)"
              value={newNote}
            />
          </label>
          <button
            className="button button-primary"
            disabled={addExcludedMutation.isPending || !newDomain.trim()}
            type="submit"
          >
            {addExcludedMutation.isPending ? "Adding…" : "Add"}
          </button>
        </form>

        <div className="excluded-domain-import">
          <div className="excluded-domain-import-hint">
            <FileSpreadsheet aria-hidden="true" size={16} />
            <span>
              CSV · domain/url, optional reason/note · up to 1,000 rows
            </span>
          </div>
          <input
            accept=".csv,text/csv"
            className="excluded-domain-csv-input"
            onChange={(event) =>
              void readExcludedDomainsCsv(event.target.files?.[0])
            }
            ref={csvInputRef}
            type="file"
          />
          <div className="excluded-domain-import-actions">
            {csvFileName && (
              <span className="excluded-domain-csv-filename" title={csvFileName}>
                {csvFileName}
              </span>
            )}
            <button
              className="button button-secondary"
              aria-label={csvFileName ? "Choose another CSV" : "Choose CSV"}
              disabled={isReadingCsv || importCsvMutation.isPending}
              onClick={() => csvInputRef.current?.click()}
              type="button"
            >
              {isReadingCsv ? "Reading..." : "Choose CSV"}
            </button>
            {csvRows.length > 0 && (
              <button
                className="button button-primary"
                disabled={importCsvMutation.isPending}
                onClick={() => importCsvMutation.mutate(csvRows)}
                type="button"
              >
                {importCsvMutation.isPending
                  ? "Importing..."
                  : `Import ${csvRows.length}`}
              </button>
            )}
          </div>
          {csvError && (
            <p className="alert alert-error" role="alert">
              {csvError}
            </p>
          )}
          {importCsvMutation.isError && (
            <p className="alert alert-error" role="alert">
              Could not import CSV: {importCsvMutation.error.message}
            </p>
          )}
        </div>

        {addExcludedMutation.isError && (
          <p className="alert alert-error" role="alert">
            Could not add domain: {addExcludedMutation.error.message}
          </p>
        )}
        {removeExcludedMutation.isError && (
          <p className="alert alert-error" role="alert">
            Could not re-enable domain: {removeExcludedMutation.error.message}
          </p>
        )}
        {(excludedDomainsQuery.isError ||
          excludedDomainCountQuery.isError) && (
          <p className="alert alert-error" role="alert">
            Could not load excluded domains:{" "}
            {excludedDomainsQuery.error?.message ??
              excludedDomainCountQuery.error?.message}
          </p>
        )}
        {excludedDomainsQuery.isLoading ||
        excludedDomainCountQuery.isLoading ? (
          <TableLoading label="Loading excluded domains" rows={5} />
        ) : domains.length > 0 ? (
          <>
            <div className="excluded-domain-table-scroll">
              <table className="excluded-domain-table">
                <thead>
                  <tr>
                    <th scope="col">Domain</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Source</th>
                    <th scope="col">Note / Last error</th>
                    <th scope="col">Date added</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <ExcludedDomainRow
                      domain={domain}
                      key={domain.id}
                      onRemove={() => removeExcludedMutation.mutate(domain.id)}
                      removing={removeExcludedMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer excluded-domain-pagination">
              <span>
                Showing {(visiblePage - 1) * pageSize + 1}–
                {Math.min(visiblePage * pageSize, totalCount)} of {totalCount}
              </span>
              <div className="pagination-controls">
                <label>
                  Rows
                  <select
                    aria-label="Rows per page"
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    value={pageSize}
                  >
                    {PAGE_SIZES.map((size) => (
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
                  onClick={() =>
                    setPage((current) => Math.max(1, Math.min(current, pageCount) - 1))
                  }
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
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, Math.min(current, pageCount) + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="empty-copy">
            No excluded domains match these filters.
          </p>
        )}
      </section>
    </>
  );
}

function ExcludedDomainRow({
  domain,
  onRemove,
  removing,
}: {
  domain: ExcludedDomainRecord;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <tr>
      <td className="excluded-domain-name">{domain.domain}</td>
      <td>
        <span className="excluded-domain-reason">{domain.reason}</span>
      </td>
      <td>{formatExcludedDomainSource(domain.source)}</td>
      <td className="excluded-domain-note">{domain.note || "—"}</td>
      <td>{formatTimestamp(domain.created_at)}</td>
      <td>
        <button
          className="button button-secondary excluded-domain-remove"
          disabled={removing}
          onClick={onRemove}
          type="button"
        >
          Remove / Re-enable
        </button>
      </td>
    </tr>
  );
}

function formatExcludedDomainSource(
  source: ExcludedDomainRecord["source"],
): string {
  switch (source) {
    case "system_preset":
      return "System preset";
    case "auto_crawler":
      return "Auto crawler";
    case "user":
      return "User";
  }
}
