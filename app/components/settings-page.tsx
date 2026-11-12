"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  getApplicationSettings,
  getTavilyUsage,
  updateApplicationSettings,
  type TavilyUsage,
} from "@/lib/api";

const deploymentManagedSettings = [
  "HTTP_ADDR",
  "CHROME_EXECUTABLE_PATH",
  "CRAWL_REQUEST_TIMEOUT",
  "CRAWL_TIMEOUT",
  "CRAWL_MAX_RESPONSE_BYTES",
  "CRAWL_MAX_QUEUE",
  "CRAWL_MAX_RETRIES",
  "CRAWL_RETRY_MAX_DELAY",
  "CRAWL_DOMAIN_DELAY",
  "CRAWL_RATE_LIMIT_PER_MINUTE",
  "CRAWL_USER_AGENT",
  "GOMEMLIMIT",
  "GOMAXPROCS",
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const settingsQuery = useQuery({
    queryKey: ["application-settings", connectionEpoch],
    queryFn: () => getApplicationSettings(adminToken),
    enabled: Boolean(adminToken),
    retry: false,
  });
  const usageQuery = useQuery({
    queryKey: ["tavily-usage", connectionEpoch],
    queryFn: () => getTavilyUsage(adminToken),
    enabled: Boolean(adminToken) && settingsQuery.data?.tavily_configured === true,
    retry: false,
  });
  const configuredMaxPages =
    maxPages ?? settingsQuery.data?.crawl_max_pages ?? 6;
  const configuredMaxDepth =
    maxDepth ?? settingsQuery.data?.crawl_max_depth ?? 2;
  const saveMutation = useMutation({
    mutationFn: (input: {
      crawl_max_pages: number;
      crawl_max_depth: number;
      tavily_api_key: string | null;
    }) => updateApplicationSettings(adminToken, input),
    onSuccess: async (settings) => {
      setTavilyApiKey("");
      setMaxPages(null);
      setMaxDepth(null);
      setNotice("Settings saved.");
      queryClient.setQueryData(
        ["application-settings", connectionEpoch],
        settings,
      );
      await queryClient.invalidateQueries({
        queryKey: ["tavily-usage", connectionEpoch],
      });
    },
  });

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setMaxPages(null);
    setMaxDepth(null);
    setAdminToken(adminTokenInput.trim());
    setConnectionEpoch((epoch) => epoch + 1);
  }

  function disconnect() {
    setAdminToken("");
    setAdminTokenInput("");
    setConnectionEpoch((epoch) => epoch + 1);
    setNotice("");
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    saveMutation.mutate({
      crawl_max_pages: configuredMaxPages,
      crawl_max_depth: configuredMaxDepth,
      tavily_api_key: tavilyApiKey.trim() || null,
    });
  }

  function resetTavilyKey() {
    setNotice("");
    saveMutation.mutate({
      crawl_max_pages: configuredMaxPages,
      crawl_max_depth: configuredMaxDepth,
      tavily_api_key: "",
    });
  }

  return (
    <>
      <section className="page-heading settings-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="heading-copy">
            Manage Tavily access and safe per-crawl limits for this application.
          </p>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">ADMIN ACCESS</p>
            <h2>{adminToken ? "Administrator connected" : "Connect as administrator"}</h2>
          </div>
          {adminToken && (
            <button
              className="button button-secondary"
              onClick={disconnect}
              type="button"
            >
              Disconnect
            </button>
          )}
        </div>
        {!adminToken && (
          <form className="settings-admin-form" onSubmit={connect}>
            <label className="settings-field">
              Admin token
              <input
                autoComplete="off"
                onChange={(event) => setAdminTokenInput(event.target.value)}
                required
                type="password"
                value={adminTokenInput}
              />
            </label>
            <button className="button button-primary" type="submit">
              Connect
            </button>
          </form>
        )}
        {settingsQuery.isPending && adminToken && (
          <p className="settings-feedback" role="status">
            Checking administrator access…
          </p>
        )}
        {settingsQuery.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not load settings: {settingsQuery.error.message}
          </p>
        )}
      </section>

      {settingsQuery.data && (
        <>
          <section className="panel settings-panel">
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">TAVILY</p>
                <h2>Search provider and usage</h2>
                <p className="panel-subtitle">
                  The API key is encrypted before it is stored and is never
                  returned to this page.
                </p>
              </div>
              <span className={`settings-connection-badge${settingsQuery.data.tavily_configured ? " is-configured" : ""}`}>
                {settingsQuery.data.tavily_configured
                  ? `Connected via ${settingsQuery.data.tavily_key_source}`
                  : "Not configured"}
              </span>
            </div>

            <form className="settings-form" onSubmit={saveSettings}>
              <label className="settings-field">
                Replace Tavily API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setTavilyApiKey(event.target.value)}
                  placeholder="Leave blank to keep the current key"
                  type="password"
                  value={tavilyApiKey}
                />
              </label>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending}
                  type="submit"
                >
                  {saveMutation.isPending ? "Saving…" : "Save API key"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={usageQuery.isFetching || !settingsQuery.data.tavily_configured}
                  onClick={() => void usageQuery.refetch()}
                  type="button"
                >
                  {usageQuery.isFetching ? "Refreshing…" : "Refresh usage"}
                </button>
                {settingsQuery.data.tavily_key_source === "database" && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={resetTavilyKey}
                    type="button"
                  >
                    Use deployment key
                  </button>
                )}
              </div>
            </form>

            {saveMutation.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not save settings: {saveMutation.error.message}
              </p>
            )}
            {notice && <p className="settings-feedback" role="status">{notice}</p>}
            {usageQuery.isPending && settingsQuery.data.tavily_configured && (
              <p className="settings-feedback" role="status">
                Loading Tavily usage…
              </p>
            )}
            {usageQuery.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not retrieve Tavily usage: {usageQuery.error.message}
              </p>
            )}
            {usageQuery.data && <TavilyUsagePanel usage={usageQuery.data} />}
          </section>

          <section className="panel settings-panel">
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">WEBSITE CRAWLER</p>
                <h2>Per-crawl limits</h2>
                <p className="panel-subtitle">
                  Applied to new crawls immediately. The crawler deployment
                  still enforces its own maximum limits.
                </p>
              </div>
            </div>
            <form className="settings-form" onSubmit={saveSettings}>
              <div className="settings-limit-grid">
                <label className="settings-field">
                  Maximum pages
                  <input
                    max={6}
                    min={1}
                    onChange={(event) => setMaxPages(Number(event.target.value))}
                    required
                    type="number"
                    value={configuredMaxPages}
                  />
                </label>
                <label className="settings-field">
                  Maximum depth
                  <input
                    max={2}
                    min={0}
                    onChange={(event) => setMaxDepth(Number(event.target.value))}
                    required
                    type="number"
                    value={configuredMaxDepth}
                  />
                </label>
              </div>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending}
                  type="submit"
                >
                  {saveMutation.isPending ? "Saving…" : "Save crawl limits"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel settings-panel">
            <div>
              <p className="eyebrow">DEPLOYMENT-MANAGED</p>
              <h2>Other crawler settings</h2>
              <p className="panel-subtitle">
                These values belong to the crawler service process and take
                effect only when changed in its deployment environment and
                restarted.
              </p>
            </div>
            <ul className="deployment-settings-list">
              {deploymentManagedSettings.map((setting) => (
                <li key={setting}><code>{setting}</code></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

function TavilyUsagePanel({ usage }: { usage: TavilyUsage }) {
  const keyUsageLabel =
    usage.key.limit === null
      ? `${usage.key.usage.toLocaleString()} credits used · unlimited key`
      : `${usage.key.usage.toLocaleString()} / ${usage.key.limit.toLocaleString()} credits`;
  const account = usage.account;

  return (
    <div className="tavily-usage">
      <article className="tavily-usage-card">
        <span>Current key usage</span>
        <strong>{keyUsageLabel}</strong>
        {usage.key.limit !== null && (
          <progress
            aria-label="Tavily API key credit usage"
            max={Math.max(usage.key.limit, 1)}
            value={Math.min(usage.key.usage, usage.key.limit)}
          />
        )}
      </article>
      {account && (
        <article className="tavily-usage-card">
          <span>Account plan</span>
          <strong>{account.current_plan ?? "Plan unavailable"}</strong>
          <small>
            {account.plan_usage !== null && account.plan_limit !== null
              ? `${account.plan_usage.toLocaleString()} / ${account.plan_limit.toLocaleString()} plan credits`
              : "Plan usage limit unavailable"}
          </small>
          {account.paygo_usage !== null && account.paygo_limit !== null && (
            <small>
              Pay-as-you-go: {account.paygo_usage.toLocaleString()} /{" "}
              {account.paygo_limit.toLocaleString()}
            </small>
          )}
        </article>
      )}
      <div className="tavily-usage-breakdown">
        {[
          ["Search", usage.key.search_usage],
          ["Extract", usage.key.extract_usage],
          ["Crawl", usage.key.crawl_usage],
          ["Map", usage.key.map_usage],
          ["Research", usage.key.research_usage],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {typeof count === "number" ? count.toLocaleString() : "—"}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
