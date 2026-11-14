"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  getApplicationSettings,
  getDiscoveryProviderJob,
  getSearchKeywordSuggestions,
  saveDiscoveryWebsites,
  searchCompanies,
  updateApplicationSettings,
} from "@/lib/api";
import type {
  DiscoveryProviderJob,
  DiscoveryProviderId,
  DiscoveryWebsiteSaveInput,
} from "@/lib/api";

export function DiscoveryPage() {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState("");
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    retry: false,
  });
  const suggestionQuery = searchText.trim();
  const suggestionsQuery = useQuery({
    queryKey: ["discovery-keyword-suggestions", suggestionQuery],
    queryFn: () => getSearchKeywordSuggestions(suggestionQuery),
    enabled: suggestionQuery.length >= 2,
  });
  const searchMutation = useMutation({
    mutationFn: searchCompanies,
    onSuccess: () => setSaveResult(null),
  });
  const preferenceMutation = useMutation({
    mutationFn: (selected: DiscoveryProviderId[]) =>
      updateApplicationSettings({ selected_discovery_tools: selected }),
    onSuccess: (settings) => {
      setPreferenceError("");
      queryClient.setQueryData(["application-settings"], settings);
    },
    onError: (error: Error) => setPreferenceError(error.message),
  });
  const saveMutation = useMutation({
    mutationFn: saveDiscoveryWebsites,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["websites"] });
      setSaveResult(
        `Saved ${result.websites_saved} unique domains and queued ${result.crawl_jobs_enqueued} crawl jobs. ${result.crawl_jobs_already_present} domains were already queued or crawled. No companies were created.${result.domains_skipped ? ` Skipped ${result.domains_skipped} duplicate domains.` : ""}`,
      );
    },
  });
  const searchData = searchMutation.data;
  const selectedProviders: DiscoveryProviderId[] =
    settingsQuery.data?.selected_discovery_tools ?? ["tavily"];
  const discoveryProviderJobs = searchData?.provider_jobs ?? [];
  const discoveryProviderJobQueries = useQueries({
    queries: discoveryProviderJobs.map((job) => ({
      queryKey: ["discovery-provider-job", job.id],
      queryFn: () => getDiscoveryProviderJob(job.id),
      enabled: job.status === "running",
      refetchInterval: (query: {
        state: { data: DiscoveryProviderJob | undefined };
      }) => (query.state.data?.status === "running" ? 5000 : false),
      initialData: job,
    })),
  });
  const combinedResults = [
    ...(searchData?.results ?? []),
    ...discoveryProviderJobQueries.flatMap((query) =>
      query.data?.status === "succeeded" ? query.data.results : [],
    ),
  ].filter(
    (result, index, results) =>
      results.findIndex(
        (candidate) => candidate.url === result.url,
      ) === index,
  );
  const providerJobsPending = discoveryProviderJobQueries.some(
    (query) => query.data?.status === "running",
  );
  const providerFailures = [
    ...(searchData?.provider_failures ?? []),
    ...discoveryProviderJobQueries.flatMap((query) =>
      query.data?.status === "failed" && query.data.error
        ? [{ provider: query.data.provider, detail: query.data.error }]
        : [],
    ),
  ];
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveResult(null);
    saveMutation.reset();
    searchMutation.mutate({ query: searchText.trim(), max_results: 20 });
  }

  function handleSave(input: DiscoveryWebsiteSaveInput) {
    saveMutation.mutate(input);
  }

  function setDiscoveryProviders(selected: DiscoveryProviderId[]) {
    if (selected.length === 0) {
      setPreferenceError("Select at least one search engine.");
      return;
    }
    setPreferenceError("");
    preferenceMutation.mutate(selected);
  }

  function toggleDiscoveryProvider(
    provider: DiscoveryProviderId,
    checked: boolean,
  ) {
    const next = checked
      ? [...selectedProviders, provider]
      : selectedProviders.filter((selected) => selected !== provider);
    setDiscoveryProviders([...new Set(next)]);
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">AI-POWERED PROSPECTING</p>
          <h1>Discover websites</h1>
          <p className="heading-copy">
            Find relevant websites, add their canonical domains to the
            registry, and track their crawl status.
          </p>
        </div>
      </section>

      <article className="panel discovery-panel discovery-page-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">WEB SEARCH</p>
            <h2>Describe the websites you want to find</h2>
            <p className="panel-subtitle">
              Be specific about industry, location, company size, or business
              needs. Results stay here until you add them to the website registry.
            </p>
          </div>
          <span className="sparkle" aria-hidden="true">✦</span>
        </div>

        <section className="discovery-tool-selector" aria-label="Discovery tools">
          <div className="discovery-tool-category">
            <div className="discovery-tool-category-heading">
              <div>
                <h3>Search engines</h3>
                <p>Choose one or run both search providers together.</p>
              </div>
              <button
                className="button button-secondary"
                disabled={
                  preferenceMutation.isPending ||
                  !settingsQuery.data?.tavily_configured ||
                  !settingsQuery.data?.octoparse_configured ||
                  !settingsQuery.data?.octoparse_template
                }
                onClick={() =>
                  setDiscoveryProviders(
                    selectedProviders.length === 2
                      ? ["tavily"]
                      : ["tavily", "octoparse"],
                  )
                }
                type="button"
              >
                {selectedProviders.length === 2
                  ? "Use Tavily only"
                  : "Use all search engines"}
              </button>
            </div>
            <div className="discovery-tool-options">
              <label className="discovery-tool-option">
                <input
                  checked={selectedProviders.includes("tavily")}
                  disabled={
                    preferenceMutation.isPending ||
                    (!settingsQuery.data?.tavily_configured &&
                      !selectedProviders.includes("tavily"))
                  }
                  onChange={(event) =>
                    toggleDiscoveryProvider("tavily", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <strong>Tavily</strong>
                  <small>
                    {settingsQuery.data?.tavily_configured
                      ? "Search engine"
                      : "Configure its API key in Settings"}
                  </small>
                </span>
              </label>
              <label className="discovery-tool-option">
                <input
                  checked={selectedProviders.includes("octoparse")}
                  disabled={
                    preferenceMutation.isPending ||
                    (!settingsQuery.data?.octoparse_configured &&
                      !selectedProviders.includes("octoparse")) ||
                    (!settingsQuery.data?.octoparse_template &&
                      !selectedProviders.includes("octoparse"))
                  }
                  onChange={(event) =>
                    toggleDiscoveryProvider("octoparse", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <strong>Octoparse</strong>
                  <small>
                    {settingsQuery.data?.octoparse_template
                      ? "Template configured"
                      : "Configure an API key and template in Settings"}
                  </small>
                </span>
              </label>
            </div>
          </div>
          <div className="discovery-tool-category discovery-tool-coming-soon">
            <div>
              <h3>Business listing websites</h3>
              <p>
                Coming soon. No listing providers have been configured yet.
              </p>
            </div>
          </div>
        </section>
        {settingsQuery.isPending && (
          <p className="settings-feedback" role="status">
            Loading saved search-tool preferences…
          </p>
        )}
        {settingsQuery.isError && (
          <div className="alert alert-error" role="alert">
            Could not load search-tool settings: {settingsQuery.error.message}
          </div>
        )}
        {(preferenceError || preferenceMutation.isError) && (
          <div className="alert alert-error" role="alert">
            Could not save search-tool preferences:{" "}
            {preferenceError ||
              preferenceMutation.error?.message ||
              "Unexpected error."}
          </div>
        )}

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
            disabled={
              searchMutation.isPending ||
              settingsQuery.isPending ||
              settingsQuery.isError ||
              preferenceMutation.isPending ||
              selectedProviders.length === 0
            }
            type="submit"
          >
            {searchMutation.isPending ? "Searching..." : "Find websites"}
            {!searchMutation.isPending && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="search-hint">
          <span>✦</span> Saving results adds unique domains to the website
          registry and queues crawling; it does not create companies.
        </div>

        {searchMutation.isError && (
          <div className="alert alert-error" role="alert">
            {searchMutation.error.message}
          </div>
        )}
        {providerFailures.map(({ provider, detail }, index) => (
          <div className="alert alert-error" key={`${provider}-${index}`} role="alert">
            {provider === "tavily" ? "Tavily" : "Octoparse"}: {detail}
          </div>
        ))}
        {discoveryProviderJobQueries.map((query, index) => (
          query.isError && (
            <div
              className="alert alert-error"
              key={`octoparse-poll-${discoveryProviderJobs[index]?.id}`}
              role="alert"
            >
              Could not refresh Octoparse search status: {query.error.message}
            </div>
          )
        ))}
        {saveMutation.isError && (
          <div className="alert alert-error" role="alert">
            {saveMutation.error.message}
          </div>
        )}
        {saveResult && (
          <div className="alert alert-success" role="status">
            {saveResult}
          </div>
        )}
        {discoveryProviderJobs.map((job, index) => {
          const current = discoveryProviderJobQueries[index]?.data ?? job;
          return (
            <div
              className={`discovery-provider-status discovery-provider-status-${current.status}`}
              key={current.id}
              role={current.status === "failed" ? "alert" : "status"}
            >
              Octoparse {current.status === "running"
                ? "is collecting search results…"
                : current.status === "succeeded"
                  ? "search completed."
                  : "search failed."}
              {current.warning && ` ${current.warning}`}
            </div>
          );
        })}

        {searchData && (
          <div className="results-section">
            <div className="results-heading">
              <div>
                <strong>Search results</strong>
                <span>
                  {combinedResults.length} found for “{searchData.query}”
                </span>
              </div>
              {combinedResults.length > 0 && (
                <button
                  className="button button-secondary"
                  disabled={
                    saveMutation.isPending ||
                    saveMutation.isSuccess ||
                    providerJobsPending
                  }
                  onClick={() =>
                    handleSave({
                      query: searchData.query,
                      max_results: 20,
                      results: combinedResults.map(({ url, provider }) => ({
                        url,
                        provider,
                      })),
                      search_id: searchData.search_id,
                    })
                  }
                  type="button"
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : saveMutation.isSuccess
                      ? "Saved to registry"
                      : "Save websites"}
                </button>
              )}
            </div>
            {combinedResults.length === 0 && providerJobsPending ? (
              <p className="empty-copy">
                Waiting for Octoparse to finish collecting data…
              </p>
            ) : combinedResults.length === 0 ? (
              <p className="empty-copy">
                No companies matched this search. Try a broader query.
              </p>
            ) : (
              <div className="discovery-results">
                {combinedResults.map((result) => (
                  <article
                    className="result-card"
                    key={`${result.provider}-${result.url}`}
                  >
                    <div className="result-score">
                      {Math.round(result.score * 100)}
                      <small>%</small>
                    </div>
                    <div className="result-content">
                      <span className="discovery-result-provider">
                        {result.provider === "tavily" ? "Tavily" : "Octoparse"}
                      </span>
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
