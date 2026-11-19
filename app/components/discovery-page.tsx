"use client";

import Link from "next/link";
import Image from "next/image";
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
  getWebsites,
  saveDiscoveryWebsites,
  searchCompanies,
  updateApplicationSettings,
} from "@/lib/api";
import type {
  DiscoveryProviderJob,
  DiscoveryProviderId,
  DiscoveryResponse,
  DiscoverySearchInput,
  DiscoveryWebsiteSaveInput,
  DiscoveryWebsiteSaveResponse,
  TavilySearchDepth,
  TavilyTimeRange,
  TavilyTopic,
} from "@/lib/api";
import { TAVILY_COUNTRIES, TAVILY_DIRECTORY_BLOCKLIST } from "@/lib/discovery-options";
import { DomainChipInput } from "./domain-chip-input";
import { useToast } from "./toast-provider";

const suggestedQueries = [
  "B2B SaaS companies in Austin",
  "Independent dental clinics in Chicago",
  "Commercial cleaning companies in Seattle",
];

export function DiscoveryPage() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [searchText, setSearchText] = useState("");
  const [saveResult, setSaveResult] =
    useState<DiscoveryWebsiteSaveResponse | null>(null);
  const [savedDomains, setSavedDomains] = useState<Set<string>>(new Set());
  const [preferenceError, setPreferenceError] = useState("");
  const [searchDepthOverride, setSearchDepthOverride] =
    useState<TavilySearchDepth | null>(null);
  const [topic, setTopic] = useState<TavilyTopic>("general");
  const [maxResults, setMaxResults] = useState(20);
  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const [includeDomains, setIncludeDomains] = useState<string[]>([]);
  const [includeDomainsMode, setIncludeDomainsMode] =
    useState<"restrict" | "prefer">("restrict");
  const [excludeDomainsOverride, setExcludeDomainsOverride] = useState<
    string[] | null
  >(null);
  const [dateMode, setDateMode] = useState<"relative" | "custom">("relative");
  const [timeRange, setTimeRange] = useState<TavilyTimeRange | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterByPublishedDate, setFilterByPublishedDate] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [includeAnswer, setIncludeAnswer] = useState(false);
  const [autoParameters, setAutoParameters] = useState(false);
  const [autoFindMore, setAutoFindMore] = useState(false);
  const [lastSearchInput, setLastSearchInput] =
    useState<DiscoverySearchInput | null>(null);
  const [moreResults, setMoreResults] = useState<DiscoveryResponse["results"]>([]);
  const [additionalCredits, setAdditionalCredits] = useState(0);
  const [saveProgress, setSaveProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    retry: false,
  });
  const searchDepth =
    searchDepthOverride ??
    settingsQuery.data?.tavily_default_search_depth ??
    "basic";
  const country =
    countryOverride ?? settingsQuery.data?.tavily_default_country ?? "";
  const excludeDomains =
    excludeDomainsOverride ??
    settingsQuery.data?.tavily_default_exclude_domains ??
    [];
  const suggestionQuery = searchText.trim();
  const suggestionsQuery = useQuery({
    queryKey: ["discovery-keyword-suggestions", suggestionQuery],
    queryFn: () => getSearchKeywordSuggestions(suggestionQuery),
    enabled: suggestionQuery.length >= 2,
  });
  const findMoreMutation = useMutation({
    mutationFn: async ({
      input,
      visibleDomains,
      fetchAll,
    }: {
      input: DiscoverySearchInput;
      visibleDomains: string[];
      fetchAll: boolean;
    }) => {
      const savedWebsites = await getWebsites();
      const excludedDomains = [
        ...new Set([
          ...(input.exclude_domains ?? []),
          ...visibleDomains,
          ...savedWebsites.map((website) => website.domain.toLowerCase()),
        ]),
      ];
      const seenDomains = new Set(excludedDomains);
      const results: DiscoveryResponse["results"] = [];
      let creditsUsed = 0;

      while (true) {
        const response = await searchCompanies({
          ...input,
          providers: ["tavily"],
          exclude_domains: [...seenDomains].slice(0, 150),
        });
        creditsUsed += response.credits_used ?? 0;
        const newResults = response.results.filter((result) => {
          const domain = getResultDomain(result.url);
          if (seenDomains.has(domain)) return false;
          seenDomains.add(domain);
          return true;
        });
        results.push(...newResults);

        if (!fetchAll || newResults.length === 0) break;
      }

      return { results, creditsUsed };
    },
    onSuccess: (response) => {
      setMoreResults((current) =>
        mergeUniqueResults([...current, ...response.results]),
      );
      setAdditionalCredits((current) => current + response.creditsUsed);
    },
  });
  const searchMutation = useMutation({
    mutationFn: ({ input }: { input: DiscoverySearchInput; autoFindMore: boolean }) =>
      searchCompanies(input),
    onSuccess: (response, variables) => {
      if (variables.autoFindMore && settingsQuery.data?.tavily_configured) {
        findMoreMutation.mutate({
          input: variables.input,
          visibleDomains: response.results.map((result) =>
            getResultDomain(result.url),
          ),
          fetchAll: true,
        });
      }
    },
  });
  const preferenceMutation = useMutation({
    mutationFn: (selected: DiscoveryProviderId[]) =>
      updateApplicationSettings({ selected_discovery_tools: selected }),
    onSuccess: (settings) => {
      setPreferenceError("");
      queryClient.setQueryData(["application-settings"], settings);
      showToast({
        type: "success",
        title: "Discovery preferences saved",
        message: "Your selected search providers are ready to use.",
      });
    },
    onError: (error: Error) => setPreferenceError(error.message),
  });
  const saveMutation = useMutation({
    mutationFn: async (input: DiscoveryWebsiteSaveInput) => {
      const aggregate = createEmptySaveResponse(input.query);
      setSaveResult(null);
      setSaveProgress({ completed: 0, total: input.results.length });

      for (let index = 0; index < input.results.length; index += 100) {
        const results = input.results.slice(index, index + 100);
        const response = await saveDiscoveryWebsites({
          ...input,
          max_results: results.length,
          results,
        });
        addSaveResponse(aggregate, response);
        setSavedDomains((current) =>
          new Set([
            ...current,
            ...results.map(({ url }) => getResultDomain(url)),
          ]),
        );
        setSaveProgress({
          completed: Math.min(index + results.length, input.results.length),
          total: input.results.length,
        });
      }

      return aggregate;
    },
    onSuccess: async (result, input) => {
      setSavedDomains((current) =>
        new Set([
          ...current,
          ...input.results.map(({ url }) => getResultDomain(url)),
        ]),
      );
      setSaveProgress(null);
      await queryClient.invalidateQueries({ queryKey: ["websites"] });
      setSaveResult(result);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ["websites"] });
    },
  });
  const searchData = searchMutation.data;
  const selectedProviders: DiscoveryProviderId[] =
    settingsQuery.data?.selected_discovery_tools ?? ["tavily"];
  const configuredSelectedProviders = settingsQuery.data
    ? selectedProviders.filter((provider) =>
        provider === "tavily"
          ? settingsQuery.data.tavily_configured
          : settingsQuery.data.octoparse_configured &&
            settingsQuery.data.octoparse_template !== null,
      )
    : [];
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
  const combinedResults = mergeUniqueResults([
    ...(searchData?.results ?? []),
    ...discoveryProviderJobQueries.flatMap((query) =>
      query.data?.status === "succeeded" ? query.data.results : [],
    ),
    ...moreResults,
  ]);
  const unsavedResults = combinedResults.filter(
    (result) => !savedDomains.has(getResultDomain(result.url)),
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
    const request: DiscoverySearchInput = {
      query: searchText.trim(),
      max_results: maxResults,
      search_depth: searchDepth,
      topic,
      chunks_per_source: 3,
      ...(topic === "general" && country ? { country } : {}),
      ...(includeDomains.length > 0
        ? { include_domains: includeDomains, include_domains_mode: includeDomainsMode }
        : {}),
      ...(excludeDomains.length > 0 ? { exclude_domains: excludeDomains } : {}),
      ...(dateMode === "relative" && timeRange ? { time_range: timeRange } : {}),
      ...(dateMode === "custom" && startDate ? { start_date: startDate } : {}),
      ...(dateMode === "custom" && endDate ? { end_date: endDate } : {}),
      filter_by_published_date: filterByPublishedDate,
      include_answer: includeAnswer ? "basic" : false,
      include_favicon: true,
      auto_parameters: autoParameters,
      min_score: minScore,
    };
    setSaveResult(null);
    setSavedDomains(new Set());
    setSaveProgress(null);
    setMoreResults([]);
    setAdditionalCredits(0);
    saveMutation.reset();
    findMoreMutation.reset();
    setLastSearchInput(request);
    searchMutation.mutate({ input: request, autoFindMore });
  }

  function toggleDirectoryPreset() {
    const hasPreset = TAVILY_DIRECTORY_BLOCKLIST.every((domain) =>
      excludeDomains.includes(domain),
    );
    setExcludeDomainsOverride(
      hasPreset
        ? excludeDomains.filter(
            (domain) => !TAVILY_DIRECTORY_BLOCKLIST.includes(domain),
          )
        : [...new Set([...excludeDomains, ...TAVILY_DIRECTORY_BLOCKLIST])].slice(
            0,
            150,
          ),
    );
  }

  function findMoreResults() {
    if (!lastSearchInput) return;
    findMoreMutation.mutate({
      input: lastSearchInput,
      visibleDomains: combinedResults.map((result) =>
        getResultDomain(result.url),
      ),
      fetchAll: false,
    });
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

  const searchSourcesLabel = selectedProviders
    .map((provider) => (provider === "tavily" ? "Tavily" : "Octoparse"))
    .join(" + ");

  return (
    <div className={`discovery-page${searchData ? " has-results" : ""}`}>
      <section className="discovery-search-home">
        <h1>Discover websites</h1>
        <p>Find businesses and websites across the web</p>

        <form className="discovery-form" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="discovery-query">
            Describe the websites you want to find
          </label>
          <span className="search-symbol" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.2 4.2" />
            </svg>
          </span>
          <input
            autoComplete="off"
            id="discovery-query"
            list="discovery-keyword-suggestions"
            maxLength={300}
            minLength={3}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search for companies, industries, or locations"
            required
            value={searchText}
          />
          {searchText && (
            <button
              aria-label="Clear search"
              className="discovery-clear-search"
              onClick={() => setSearchText("")}
              type="button"
            >
              ×
            </button>
          )}
          <datalist id="discovery-keyword-suggestions">
            {suggestionsQuery.data?.map(({ id, keyword }) => (
              <option key={id} value={keyword} />
            ))}
          </datalist>
          <button
            className="button button-primary search-button"
            disabled={
              searchMutation.isPending ||
              findMoreMutation.isPending ||
              saveMutation.isPending ||
              settingsQuery.isPending ||
              settingsQuery.isError ||
              preferenceMutation.isPending ||
              configuredSelectedProviders.length === 0
            }
            type="submit"
          >
            {searchMutation.isPending ? "Searching..." : "Search"}
          </button>
        </form>

        <details className="discovery-advanced-filters">
          <summary>
            <span>Advanced Search Filters</span>
            <span className="discovery-advanced-summary">
              {topic === "general" ? "General" : topic}
              {" · "}
              {searchDepth}
              {" · "}
              {maxResults} results
            </span>
            <span aria-hidden="true" className="discovery-source-summary-chevron">
              ▾
            </span>
          </summary>
          <div className="discovery-advanced-content">
            <div className="discovery-filter-grid">
              <label className="discovery-filter-field">
                Topic
                <select
                  onChange={(event) =>
                    setTopic(event.target.value as TavilyTopic)
                  }
                  value={topic}
                >
                  <option value="general">General</option>
                  <option value="news">News</option>
                  <option value="finance">Finance</option>
                </select>
              </label>
              <label className="discovery-filter-field">
                Search depth
                <select
                  onChange={(event) =>
                    setSearchDepthOverride(
                      event.target.value as TavilySearchDepth,
                    )
                  }
                  value={searchDepth}
                >
                  <option value="basic">Basic · 1 credit</option>
                  <option value="fast">Fast · 1 credit</option>
                  <option value="ultra-fast">Ultra-Fast · 1 credit</option>
                  <option value="advanced">Advanced · 2 credits</option>
                </select>
              </label>
              <label className="discovery-filter-field">
                Max results
                <select
                  onChange={(event) =>
                    setMaxResults(Number(event.target.value))
                  }
                  value={maxResults}
                >
                  {[5, 10, 15, 20].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="discovery-filter-field">
                Target country
                <select
                  disabled={topic !== "general"}
                  onChange={(event) =>
                    setCountryOverride(event.target.value)
                  }
                  value={country}
                >
                  <option value="">Any country</option>
                  {TAVILY_COUNTRIES.map(({ label, value }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="discovery-domain-filters">
              <div>
                <DomainChipInput
                  domains={includeDomains}
                  label="Include domains"
                  maxDomains={300}
                  onChange={setIncludeDomains}
                  placeholder="example.com or *.example.com"
                />
                <div
                  aria-label="Included domains behavior"
                  className="discovery-filter-toggle"
                  role="group"
                >
                  <button
                    aria-pressed={includeDomainsMode === "restrict"}
                    className={includeDomainsMode === "restrict" ? "is-active" : ""}
                    onClick={() => setIncludeDomainsMode("restrict")}
                    type="button"
                  >
                    Restrict
                  </button>
                  <button
                    aria-pressed={includeDomainsMode === "prefer"}
                    className={includeDomainsMode === "prefer" ? "is-active" : ""}
                    onClick={() => setIncludeDomainsMode("prefer")}
                    type="button"
                  >
                    Prefer
                  </button>
                </div>
              </div>
              <div>
                <DomainChipInput
                  domains={excludeDomains}
                  label="Exclude domains"
                  maxDomains={150}
                  onChange={setExcludeDomainsOverride}
                  placeholder="directory.example"
                />
                <button
                  aria-pressed={TAVILY_DIRECTORY_BLOCKLIST.every((domain) =>
                    excludeDomains.includes(domain),
                  )}
                  className="discovery-preset-toggle"
                  onClick={toggleDirectoryPreset}
                  type="button"
                >
                  {TAVILY_DIRECTORY_BLOCKLIST.every((domain) =>
                    excludeDomains.includes(domain),
                  )
                    ? "Remove directory & social sites"
                    : "Exclude directories & social sites"}
                </button>
              </div>
            </div>

            <section className="discovery-date-filters">
              <div className="discovery-filter-section-heading">
                <strong>Date & relevance</strong>
                <div
                  aria-label="Date filter type"
                  className="discovery-filter-toggle"
                  role="group"
                >
                  <button
                    aria-pressed={dateMode === "relative"}
                    className={dateMode === "relative" ? "is-active" : ""}
                    onClick={() => setDateMode("relative")}
                    type="button"
                  >
                    Relative time
                  </button>
                  <button
                    aria-pressed={dateMode === "custom"}
                    className={dateMode === "custom" ? "is-active" : ""}
                    onClick={() => setDateMode("custom")}
                    type="button"
                  >
                    Custom dates
                  </button>
                </div>
              </div>
              {dateMode === "relative" ? (
                <label className="discovery-filter-field discovery-filter-date">
                  Time range
                  <select
                    onChange={(event) =>
                      setTimeRange(event.target.value as TavilyTimeRange | "")
                    }
                    value={timeRange}
                  >
                    <option value="">Any time</option>
                    <option value="day">Past 24 hours</option>
                    <option value="week">Past week</option>
                    <option value="month">Past month</option>
                    <option value="year">Past year</option>
                  </select>
                </label>
              ) : (
                <div className="discovery-filter-grid discovery-custom-dates">
                  <label className="discovery-filter-field">
                    Start date
                    <input
                      max={endDate || undefined}
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                  </label>
                  <label className="discovery-filter-field">
                    End date
                    <input
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      type="date"
                      value={endDate}
                    />
                  </label>
                </div>
              )}
              <label className="discovery-range-field">
                <span>Minimum relevance score</span>
                <strong>{minScore.toFixed(1)}</strong>
                <input
                  max={1}
                  min={0}
                  onChange={(event) => setMinScore(Number(event.target.value))}
                  step={0.1}
                  type="range"
                  value={minScore}
                />
              </label>
              <label className="discovery-toggle-field">
                <input
                  checked={filterByPublishedDate}
                  onChange={(event) =>
                    setFilterByPublishedDate(event.target.checked)
                  }
                  type="checkbox"
                />
                Only include results with a published date
              </label>
            </section>

            <div className="discovery-search-toggles">
              <label className="discovery-toggle-field">
                <input
                  checked={includeAnswer}
                  onChange={(event) => setIncludeAnswer(event.target.checked)}
                  type="checkbox"
                />
                AI Market Summary
              </label>
              <label className="discovery-toggle-field">
                <input
                  checked={autoParameters}
                  onChange={(event) => setAutoParameters(event.target.checked)}
                  type="checkbox"
                />
                Auto-tune parameters
              </label>
              <label className="discovery-toggle-field discovery-auto-find-more">
                <input
                  checked={autoFindMore}
                  disabled={
                    !settingsQuery.data?.tavily_configured ||
                    searchMutation.isPending ||
                    findMoreMutation.isPending ||
                    saveMutation.isPending
                  }
                  onChange={(event) => setAutoFindMore(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Auto Find More Results</strong>
                  <small>
                    Keep searching until no new websites are found. Each
                    additional search uses Tavily credits.
                  </small>
                </span>
              </label>
            </div>
          </div>
        </details>

        <details className="discovery-source-picker">
          <summary>
            <span className="discovery-source-summary-label">Sources</span>
            <span className="discovery-source-summary-value">
              {settingsQuery.isPending ? "Loading..." : searchSourcesLabel || "None selected"}
            </span>
            <span className="discovery-source-summary-chevron" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div aria-busy={settingsQuery.isPending} className="discovery-source-options">
            <label className="discovery-source-option">
              <input
                checked={selectedProviders.includes("tavily")}
                disabled={
                  settingsQuery.isPending ||
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
                    ? "Ready"
                    : "Configure in Settings"}
                </small>
              </span>
            </label>
            <label className="discovery-source-option">
              <input
                checked={selectedProviders.includes("octoparse")}
                disabled={
                  settingsQuery.isPending ||
                  preferenceMutation.isPending ||
                  ((!settingsQuery.data?.octoparse_configured ||
                    !settingsQuery.data?.octoparse_template) &&
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
                  {settingsQuery.data?.octoparse_configured &&
                  settingsQuery.data.octoparse_template
                    ? settingsQuery.data.octoparse_template.template_name
                    : "Configure in Settings"}
                </small>
              </span>
            </label>
            <Link className="discovery-source-settings" href="/settings">
              Configure sources
            </Link>
          </div>
        </details>

        {suggestedQueries.length > 0 && !searchData && (
          <div className="discovery-examples">
            <span>Try</span>
            {suggestedQueries.map((query) => (
              <button
                className="discovery-example-chip"
                key={query}
                onClick={() => setSearchText(query)}
                type="button"
              >
                {query}
              </button>
            ))}
          </div>
        )}
      </section>

      {settingsQuery.isError && (
        <div className="alert alert-error discovery-alert" role="alert">
          Could not load search settings: {settingsQuery.error.message}
        </div>
      )}
      {(preferenceError || preferenceMutation.isError) && (
        <div className="alert alert-error discovery-alert" role="alert">
          Could not save search sources:{" "}
          {preferenceError ||
            preferenceMutation.error?.message ||
            "Unexpected error."}
        </div>
      )}
      {settingsQuery.isSuccess &&
        configuredSelectedProviders.length === 0 && (
          <div className="discovery-setup-banner">
            No selected search source is ready.
            <Link href="/settings">Configure a source</Link>
          </div>
        )}

      {searchMutation.isPending && (
        <div className="discovery-search-progress" role="status">
          <span className="discovery-spinner" aria-hidden="true" />
          <span>Searching selected sources...</span>
        </div>
      )}
      {searchMutation.isError && (
        <div className="alert alert-error discovery-alert" role="alert">
          {searchMutation.error.message}
        </div>
      )}
      {providerFailures.map(({ provider, detail }, index) => (
        <div
          className="alert alert-error discovery-alert"
          key={`${provider}-${index}`}
          role="alert"
        >
          {provider === "tavily" ? "Tavily" : "Octoparse"}: {detail}
        </div>
      ))}
      {discoveryProviderJobQueries.map((query, index) =>
        query.isError ? (
          <div
            className="alert alert-error discovery-alert"
            key={`octoparse-poll-${discoveryProviderJobs[index]?.id}`}
            role="alert"
          >
            Could not refresh Octoparse status: {query.error.message}
          </div>
        ) : null,
      )}
      {saveMutation.isError && (
        <div className="alert alert-error discovery-alert" role="alert">
          {saveProgress && saveProgress.completed > 0
            ? `Added ${saveProgress.completed} of ${saveProgress.total} websites before the next batch failed. `
            : ""}
          {saveMutation.error.message}
        </div>
      )}
      {findMoreMutation.isError && (
        <div className="alert alert-error discovery-alert" role="alert">
          Could not find more results: {findMoreMutation.error.message}
        </div>
      )}
      {saveResult && (
        <section
          aria-label="Websites saved"
          className="discovery-save-summary"
          role="status"
        >
          <span className="discovery-save-check" aria-hidden="true">✓</span>
          <div>
            <strong>
              {saveResult.websites_saved}{" "}
              {saveResult.websites_saved === 1 ? "website" : "websites"} added
              to the registry
            </strong>
            <p>
              {saveResult.crawl_jobs_enqueued} indexing jobs queued ·{" "}
              {saveResult.crawl_jobs_already_present} already queued or indexed
              {saveResult.domains_skipped > 0 &&
                ` · ${saveResult.domains_skipped} duplicates skipped`}
            </p>
          </div>
          <Link href="/websites">View registry</Link>
        </section>
      )}
      {discoveryProviderJobs.map((job, index) => {
        const current = discoveryProviderJobQueries[index]?.data ?? job;
        return (
          <div
            className={`discovery-provider-status discovery-provider-status-${current.status}`}
            key={current.id}
            role={current.status === "failed" ? "alert" : "status"}
          >
            Octoparse{" "}
            {current.status === "running"
              ? "is collecting results..."
              : current.status === "succeeded"
                ? "search completed."
                : "search failed."}
            {current.warning && ` ${current.warning}`}
          </div>
        );
      })}

      {searchData && (
        <section
          aria-busy={providerJobsPending || findMoreMutation.isPending}
          className="results-section"
        >
          {searchData.answer && (
            <details className="discovery-answer-card">
              <summary>AI Market Summary</summary>
              <p>{searchData.answer}</p>
            </details>
          )}
          <div className="results-heading">
            <div>
              <strong>Results</strong>
              <span>
                {combinedResults.length} found for “{searchData.query}”
                {providerJobsPending ? " · searching..." : ""}
              </span>
              {(searchData.credits_used !== null ||
                additionalCredits > 0) && (
                <span className="discovery-credits-badge">
                  {((searchData.credits_used ?? 0) + additionalCredits).toLocaleString()}{" "}
                  Tavily credits used
                </span>
              )}
            </div>
            {combinedResults.length > 0 && (
              <button
                className="button button-secondary discovery-save-button"
                disabled={
                  saveMutation.isPending ||
                  unsavedResults.length === 0 ||
                  providerJobsPending
                }
                onClick={() =>
                  handleSave({
                    query: searchData.query,
                    max_results: Math.min(unsavedResults.length, 100),
                    results: unsavedResults.map(({ url, provider }) => ({
                      url,
                      provider,
                    })),
                    search_id: searchData.search_id,
                  })
                }
                type="button"
              >
                {saveMutation.isPending
                  ? `Adding ${saveProgress?.completed ?? 0} of ${saveProgress?.total ?? unsavedResults.length}...`
                  : unsavedResults.length === 0
                    ? "All added"
                    : `Add ${unsavedResults.length} to registry`}
              </button>
            )}
          </div>

          {combinedResults.length === 0 && providerJobsPending ? (
            <p className="empty-copy">Waiting for Octoparse results...</p>
          ) : combinedResults.length === 0 ? (
            <p className="empty-copy">
              No websites found. Try a broader search.
            </p>
          ) : (
            <div className="discovery-results">
              {combinedResults.map((result) => (
                <article
                  className="discovery-result"
                  key={`${result.provider}-${result.url}`}
                >
                  <div className="discovery-result-site">
                    <span aria-hidden="true" className="discovery-result-favicon">
                      <span className="discovery-result-favicon-fallback">
                        {getResultDomain(result.url).charAt(0).toUpperCase()}
                      </span>
                      <Image
                        alt=""
                        className="discovery-result-favicon-image"
                        height={16}
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                        src={result.favicon ?? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(result.url)}&sz=64`}
                        unoptimized
                        width={16}
                      />
                    </span>
                    <span>
                      <strong>{getResultDomain(result.url)}</strong>
                      <small>{result.url}</small>
                    </span>
                    <span className="discovery-result-score">
                      {Math.round(result.score * 100)}% match
                    </span>
                  </div>
                  <a
                    className="discovery-result-title"
                    href={result.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {result.title}
                  </a>
                  {result.published_date && (
                    <span className="discovery-result-published">
                      Published {formatPublishedDate(result.published_date)}
                    </span>
                  )}
                  <p>{result.content}</p>
                  <div className="discovery-result-footer">
                    <span className="discovery-result-source">
                      {result.provider === "tavily" ? "Tavily" : "Octoparse"}
                    </span>
                    <button
                      className="discovery-result-add"
                      disabled={
                        savedDomains.has(getResultDomain(result.url)) ||
                        saveMutation.isPending ||
                        providerJobsPending
                      }
                      onClick={() =>
                        handleSave({
                          query: searchData.query,
                          max_results: 1,
                          results: [{ url: result.url, provider: result.provider }],
                          search_id: searchData.search_id,
                        })
                      }
                      type="button"
                    >
                      {savedDomains.has(getResultDomain(result.url))
                        ? "Added"
                        : saveMutation.isPending
                          ? "Adding..."
                          : "Add to registry"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {settingsQuery.data?.tavily_configured && (
            <button
              className="discovery-more-results"
              disabled={
                findMoreMutation.isPending ||
                providerJobsPending ||
                !lastSearchInput
              }
              onClick={findMoreResults}
              type="button"
            >
              {findMoreMutation.isPending
                ? findMoreMutation.variables?.fetchAll
                  ? "Automatically finding all results..."
                  : "Searching for more..."
                : "Find More Results"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function getResultDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function mergeUniqueResults(results: DiscoveryResponse["results"]) {
  const seenDomains = new Set<string>();
  return results.filter((result) => {
    const domain = getResultDomain(result.url);
    if (seenDomains.has(domain)) return false;
    seenDomains.add(domain);
    return true;
  });
}

function formatPublishedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function createEmptySaveResponse(query: string): DiscoveryWebsiteSaveResponse {
  return {
    query,
    results_found: 0,
    websites_saved: 0,
    crawl_jobs_enqueued: 0,
    crawl_jobs_already_present: 0,
    domains_skipped: 0,
    hypestat_profiles_requested: 0,
    hypestat_profiles_reused: 0,
    hypestat_profiles_succeeded: 0,
    hypestat_profiles_queued: 0,
    hypestat_profiles_failed: 0,
  };
}

function addSaveResponse(
  total: DiscoveryWebsiteSaveResponse,
  batch: DiscoveryWebsiteSaveResponse,
) {
  total.results_found += batch.results_found;
  total.websites_saved += batch.websites_saved;
  total.crawl_jobs_enqueued += batch.crawl_jobs_enqueued;
  total.crawl_jobs_already_present += batch.crawl_jobs_already_present;
  total.domains_skipped += batch.domains_skipped;
  total.hypestat_profiles_requested += batch.hypestat_profiles_requested;
  total.hypestat_profiles_reused += batch.hypestat_profiles_reused;
  total.hypestat_profiles_succeeded += batch.hypestat_profiles_succeeded;
  total.hypestat_profiles_queued += batch.hypestat_profiles_queued;
  total.hypestat_profiles_failed += batch.hypestat_profiles_failed;
}
