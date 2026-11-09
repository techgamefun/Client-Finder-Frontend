"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  getSearchKeywordSuggestions,
  ingestCompanies,
  searchCompanies,
} from "@/lib/api";
import type { DiscoveryIngestInput } from "@/lib/api";

export function DiscoveryPage() {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const suggestionQuery = searchText.trim();
  const suggestionsQuery = useQuery({
    queryKey: ["discovery-keyword-suggestions", suggestionQuery],
    queryFn: () => getSearchKeywordSuggestions(suggestionQuery),
    enabled: suggestionQuery.length >= 2,
  });
  const searchMutation = useMutation({
    mutationFn: searchCompanies,
    onSuccess: () => setIngestResult(null),
  });
  const ingestMutation = useMutation({
    mutationFn: ingestCompanies,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      const failures = result.crawl_failures.length
        ? ` Crawl failures (sources were saved without enrichment): ${result.crawl_failures
            .map(({ source_url, detail }) => `${source_url}: ${detail}`)
            .join("; ")}.`
        : "";
      const pagespeedFailures = result.pagespeed_failures.length
        ? ` PageSpeed failures: ${result.pagespeed_failures
            .map(
              ({ website_url, strategy, detail }) =>
                `${website_url} (${strategy}): ${detail}`,
            )
            .join("; ")}.`
        : "";
      setIngestResult(
        `Saved ${result.sources_added} sources, created ${result.candidates_created} new leads, crawled ${result.websites_crawled} websites, saved ${result.pagespeed_scans_saved} detailed PageSpeed reports, enriched ${result.companies_enriched} companies, and added ${result.contacts_added} public email contacts. Skipped ${result.results_skipped} duplicates.${failures}${pagespeedFailures}`,
      );
    },
  });
  const searchData = searchMutation.data;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIngestResult(null);
    ingestMutation.reset();
    searchMutation.mutate({ query: searchText.trim(), max_results: 5 });
  }

  function handleIngest(input: DiscoveryIngestInput) {
    ingestMutation.mutate(input);
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">AI-POWERED PROSPECTING</p>
          <h1>Discover leads</h1>
          <p className="heading-copy">
            Search the web for businesses that match your ideal customer, review
            the sources, then save them to your pipeline.
          </p>
        </div>
      </section>

      <article className="panel discovery-panel discovery-page-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">WEB SEARCH</p>
            <h2>Describe your ideal companies</h2>
            <p className="panel-subtitle">
              Be specific about industry, location, company size, or business
              needs. Results are saved as leads for your review.
            </p>
          </div>
          <span className="sparkle" aria-hidden="true">✦</span>
        </div>

        <form className="discovery-form" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="discovery-query">
            Describe the companies you want to find
          </label>
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            id="discovery-query"
            list="discovery-keyword-suggestions"
            maxLength={300}
            minLength={3}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="e.g. SaaS companies in Austin looking to scale"
            required
            value={searchText}
          />
          <datalist id="discovery-keyword-suggestions">
            {suggestionsQuery.data?.map(({ id, keyword }) => (
              <option key={id} value={keyword} />
            ))}
          </datalist>
          <button
            className="button button-primary search-button"
            disabled={searchMutation.isPending}
            type="submit"
          >
            {searchMutation.isPending ? "Searching..." : "Find leads"}
            {!searchMutation.isPending && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="search-hint">
          <span>✦</span> Review each source before saving prospects to your
          pipeline.
        </div>

        {searchMutation.isError && (
          <div className="alert alert-error" role="alert">
            {searchMutation.error.message}
          </div>
        )}
        {ingestMutation.isError && (
          <div className="alert alert-error" role="alert">
            {ingestMutation.error.message}
          </div>
        )}
        {ingestResult && (
          <div className="alert alert-success" role="status">
            {ingestResult}
          </div>
        )}

        {searchData && (
          <div className="results-section">
            <div className="results-heading">
              <div>
                <strong>Search results</strong>
                <span>
                  {searchData.results.length} found for “{searchData.query}”
                </span>
              </div>
              {searchData.results.length > 0 && (
                <button
                  className="button button-secondary"
                  disabled={
                    ingestMutation.isPending || ingestMutation.isSuccess
                  }
                  onClick={() =>
                    handleIngest({
                      query: searchData.query,
                      max_results: 5,
                      results: searchData.results,
                      search_id: searchData.search_id,
                    })
                  }
                  type="button"
                >
                  {ingestMutation.isPending
                    ? "Saving..."
                    : ingestMutation.isSuccess
                      ? "Saved to pipeline"
                      : "Save to pipeline"}
                </button>
              )}
            </div>
            {searchData.results.length === 0 ? (
              <p className="empty-copy">
                No companies matched this search. Try a broader query.
              </p>
            ) : (
              <div className="discovery-results">
                {searchData.results.map((result) => (
                  <article className="result-card" key={result.url}>
                    <div className="result-score">
                      {Math.round(result.score * 100)}
                      <small>%</small>
                    </div>
                    <div className="result-content">
                      <a
                        className="result-title"
                        href={result.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {result.title}
                        <span aria-hidden="true">↗</span>
                      </a>
                      <p>{result.content}</p>
                      <span className="result-url">{result.url}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </article>
    </>
  );
}
