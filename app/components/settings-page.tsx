"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  getApplicationSettings,
  getOctoparseTemplates,
  getOctoparseUsage,
  getTavilyUsage,
  updateApplicationSettings,
  type OctoparseTemplateConfiguration,
  type OctoparseTemplateOption,
  type OctoparseUsage,
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

type SettingsSection = "tavily" | "octoparse" | "crawler";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("tavily");
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [octoparseApiKey, setOctoparseApiKey] = useState("");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [templateDraft, setTemplateDraft] =
    useState<OctoparseTemplateConfiguration | null>(null);
  const [additionalParametersText, setAdditionalParametersText] =
    useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    retry: false,
  });
  const usageQuery = useQuery({
    queryKey: ["tavily-usage"],
    queryFn: getTavilyUsage,
    enabled: settingsQuery.data?.tavily_configured === true,
    retry: false,
  });
  const octoparseUsageQuery = useQuery({
    queryKey: ["octoparse-usage"],
    queryFn: getOctoparseUsage,
    enabled: settingsQuery.data !== undefined,
    retry: false,
  });
  const templateSearchMutation = useMutation({
    mutationFn: getOctoparseTemplates,
  });
  const configuredMaxPages =
    maxPages ?? settingsQuery.data?.crawl_max_pages ?? 6;
  const configuredMaxDepth =
    maxDepth ?? settingsQuery.data?.crawl_max_depth ?? 2;
  const activeOctoparseTemplate =
    templateDraft ?? settingsQuery.data?.octoparse_template ?? null;
  const selectedTemplateMetadata =
    templateSearchMutation.data?.templates.find(
      (template) =>
        template.template_name === activeOctoparseTemplate?.template_name,
    ) ?? null;
  const octoparseInputFields = getTemplateFields(
    selectedTemplateMetadata?.input_schema ?? [],
  );
  const octoparseOutputFields = getTemplateFields(
    selectedTemplateMetadata?.output_schema ?? [],
  );
  const saveMutation = useMutation({
    mutationFn: updateApplicationSettings,
    onSuccess: async (settings) => {
      setTavilyApiKey("");
      setOctoparseApiKey("");
      setMaxPages(null);
      setMaxDepth(null);
      setTemplateDraft(null);
      setAdditionalParametersText(null);
      setNotice("Settings saved.");
      queryClient.setQueryData(["application-settings"], settings);
      await queryClient.invalidateQueries({ queryKey: ["tavily-usage"] });
    },
  });

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
      tavily_api_key: "",
    });
  }

  function resetOctoparseKey() {
    setNotice("");
    saveMutation.mutate({ octoparse_api_key: "" });
  }

  function searchOctoparseTemplates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    templateSearchMutation.mutate(templateKeyword.trim());
  }

  function selectOctoparseTemplate(template: OctoparseTemplateOption) {
    const inputFields = getTemplateFields(template.input_schema);
    const outputFields = getTemplateFields(template.output_schema);
    setTemplateDraft({
      template_name: template.template_name,
      query_field:
        inputFields.find(({ field }) => /query|keyword|search/i.test(field))
          ?.field ?? inputFields[0]?.field ?? "",
      additional_parameters: {},
      title_field:
        outputFields.find(({ field }) => /title|name|business/i.test(field))
          ?.field ?? outputFields[0]?.field ?? "",
      url_field:
        outputFields.find(({ field }) => /url|link|website/i.test(field))
          ?.field ?? "",
      content_field:
        outputFields.find(({ field }) => /description|content|summary/i.test(field))
          ?.field ?? null,
      score_field: null,
    });
    setAdditionalParametersText("{}");
  }

  function updateTemplateField(
    field: "query_field" | "title_field" | "url_field",
    value: string,
  ) {
    const current = templateDraft ?? settingsQuery.data?.octoparse_template;
    if (!current) return;
    if (field === "query_field") {
      setTemplateDraft({ ...current, query_field: value });
    } else if (field === "title_field") {
      setTemplateDraft({ ...current, title_field: value });
    } else {
      setTemplateDraft({ ...current, url_field: value });
    }
  }

  function updateOptionalTemplateField(
    field: "content_field" | "score_field",
    value: string,
  ) {
    const current = templateDraft ?? settingsQuery.data?.octoparse_template;
    if (!current) return;
    const optionalValue = value || null;
    if (field === "content_field") {
      setTemplateDraft({ ...current, content_field: optionalValue });
    } else {
      setTemplateDraft({ ...current, score_field: optionalValue });
    }
  }

  function saveOctoparseTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const current = templateDraft ?? settingsQuery.data?.octoparse_template;
    if (!current) return;

    let additionalParameters: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(
        additionalParametersText ??
          JSON.stringify(current.additional_parameters ?? {}),
      );
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        setNotice("Additional parameters must be a JSON object.");
        return;
      }
      additionalParameters = Object.fromEntries(Object.entries(parsed));
    } catch {
      setNotice("Additional parameters must be valid JSON.");
      return;
    }

    saveMutation.mutate({
      octoparse_template: {
        ...current,
        additional_parameters: additionalParameters,
      },
    });
  }

  return (
    <>
      <section className="page-heading settings-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="heading-copy">
            Manage discovery providers and crawler settings for this application.
          </p>
        </div>
      </section>

      <div className="settings-section-picker">
        <label className="settings-field">
          Show settings for
          <select
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isSettingsSection(value)) setActiveSection(value);
            }}
            value={activeSection}
          >
            <option value="tavily">Tavily</option>
            <option value="octoparse">Octoparse</option>
            <option value="crawler">Crawler</option>
          </select>
        </label>
      </div>

      {settingsQuery.isPending && (
        <p className="settings-feedback" role="status">Loading settings…</p>
      )}
      {settingsQuery.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not load settings: {settingsQuery.error.message}
        </p>
      )}

      {settingsQuery.data && (
        <>
          <section
            className="panel settings-panel"
            hidden={activeSection !== "tavily"}
          >
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
                  ? "Configured"
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

          <section
            className="panel settings-panel"
            hidden={activeSection !== "octoparse"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">OCTOPARSE SEARCH ENGINE</p>
                <h2>API key and scraper template</h2>
                <p className="panel-subtitle">
                  Octoparse runs a configured cloud template for each search.
                  The API key is encrypted at rest and never returned.
                </p>
              </div>
              <span className={`settings-connection-badge${settingsQuery.data.octoparse_configured ? " is-configured" : ""}`}>
                {settingsQuery.data.octoparse_configured
                  ? "Configured"
                  : "Not configured"}
              </span>
            </div>

            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("");
                saveMutation.mutate({
                  octoparse_api_key: octoparseApiKey.trim() || null,
                });
              }}
            >
              <label className="settings-field">
                Replace Octoparse API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setOctoparseApiKey(event.target.value)}
                  placeholder="Leave blank to keep the current key"
                  type="password"
                  value={octoparseApiKey}
                />
              </label>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending}
                  type="submit"
                >
                  {saveMutation.isPending ? "Saving…" : "Save Octoparse key"}
                </button>
                {settingsQuery.data.octoparse_key_source === "database" && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={resetOctoparseKey}
                    type="button"
                  >
                    Use deployment key
                  </button>
                )}
              </div>
            </form>

            <div className="settings-actions">
              <button
                className="button button-secondary"
                disabled={octoparseUsageQuery.isFetching}
                onClick={() => void octoparseUsageQuery.refetch()}
                type="button"
              >
                {octoparseUsageQuery.isFetching
                  ? "Refreshing usage…"
                  : "Refresh Octoparse usage"}
              </button>
            </div>
            {octoparseUsageQuery.isPending && (
              <p className="settings-feedback" role="status">
                Loading Octoparse usage…
              </p>
            )}
            {octoparseUsageQuery.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not retrieve Octoparse usage:{" "}
                {octoparseUsageQuery.error.message}
              </p>
            )}
            {octoparseUsageQuery.data && (
              <OctoparseUsagePanel usage={octoparseUsageQuery.data} />
            )}

            <form
              className="settings-form octoparse-template-search"
              onSubmit={searchOctoparseTemplates}
            >
              <label className="settings-field">
                Find a reusable Octoparse template
                <input
                  minLength={2}
                  onChange={(event) => setTemplateKeyword(event.target.value)}
                  placeholder="e.g. business directory search"
                  required
                  value={templateKeyword}
                />
              </label>
              <div className="settings-actions">
                <button
                  className="button button-secondary"
                  disabled={
                    !settingsQuery.data.octoparse_configured ||
                    templateSearchMutation.isPending
                  }
                  type="submit"
                >
                  {templateSearchMutation.isPending
                    ? "Searching templates…"
                    : "Find templates"}
                </button>
              </div>
            </form>

            {templateSearchMutation.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not search Octoparse templates:{" "}
                {templateSearchMutation.error.message}
              </p>
            )}
            {templateSearchMutation.data && (
              <div className="octoparse-template-list">
                {templateSearchMutation.data.templates.length === 0 ? (
                  <p className="empty-copy">
                    No templates matched. Try a different keyword.
                  </p>
                ) : (
                  templateSearchMutation.data.templates.map((template) => (
                    <button
                      aria-pressed={
                        activeOctoparseTemplate?.template_name ===
                        template.template_name
                      }
                      className="octoparse-template-option"
                      key={template.template_name}
                      onClick={() => selectOctoparseTemplate(template)}
                      type="button"
                    >
                      <strong>{template.template_name}</strong>
                      {template.template_name ===
                        templateSearchMutation.data.recommended_template_name && (
                        <span>Recommended</span>
                      )}
                      {template.description && (
                        <small>{template.description}</small>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {activeOctoparseTemplate && (
              <form
                className="settings-form octoparse-template-config"
                onSubmit={saveOctoparseTemplate}
              >
                <p className="settings-feedback">
                  Selected template:{" "}
                  <strong>{activeOctoparseTemplate.template_name}</strong>
                </p>
                {selectedTemplateMetadata && (
                  <>
                    <p className="panel-subtitle">
                      Template inputs:{" "}
                      {octoparseInputFields
                        .map(({ field, required }) =>
                          required ? `${field} (required)` : field,
                        )
                        .join(", ") || "No input fields returned"}
                    </p>
                    <p className="panel-subtitle">
                      Output fields:{" "}
                      {octoparseOutputFields
                        .map(({ field }) => field)
                        .join(", ") || "No output fields returned"}
                    </p>
                  </>
                )}
                <label className="settings-field">
                  Search query input field
                  <input
                    list="octoparse-input-fields"
                    onChange={(event) =>
                      updateTemplateField("query_field", event.target.value)
                    }
                    required
                    value={activeOctoparseTemplate.query_field}
                  />
                </label>
                <datalist id="octoparse-input-fields">
                  {octoparseInputFields.map(({ field }) => (
                    <option key={field} value={field} />
                  ))}
                </datalist>
                <label className="settings-field">
                  Additional template parameters (JSON object)
                  <textarea
                    onChange={(event) =>
                      setAdditionalParametersText(event.target.value)
                    }
                    rows={4}
                    value={
                      additionalParametersText ??
                      JSON.stringify(
                        activeOctoparseTemplate.additional_parameters,
                        null,
                        2,
                      )
                    }
                  />
                </label>
                <label className="settings-field">
                  Result title field
                  <input
                    list="octoparse-output-fields"
                    onChange={(event) =>
                      updateTemplateField("title_field", event.target.value)
                    }
                    required
                    value={activeOctoparseTemplate.title_field}
                  />
                </label>
                <label className="settings-field">
                  Result URL field
                  <input
                    list="octoparse-output-fields"
                    onChange={(event) =>
                      updateTemplateField("url_field", event.target.value)
                    }
                    required
                    value={activeOctoparseTemplate.url_field}
                  />
                </label>
                <datalist id="octoparse-output-fields">
                  {octoparseOutputFields.map(({ field }) => (
                    <option key={field} value={field} />
                  ))}
                </datalist>
                <label className="settings-field">
                  Result description field (optional)
                  <input
                    list="octoparse-output-fields"
                    onChange={(event) =>
                      updateOptionalTemplateField(
                        "content_field",
                        event.target.value,
                      )
                    }
                    value={activeOctoparseTemplate.content_field ?? ""}
                  />
                </label>
                <label className="settings-field">
                  Result score field (optional, 0 to 1)
                  <input
                    list="octoparse-output-fields"
                    onChange={(event) =>
                      updateOptionalTemplateField(
                        "score_field",
                        event.target.value,
                      )
                    }
                    value={activeOctoparseTemplate.score_field ?? ""}
                  />
                </label>
                <div className="settings-actions">
                  <button
                    className="button button-primary"
                    disabled={saveMutation.isPending}
                    type="submit"
                  >
                    {saveMutation.isPending
                      ? "Saving…"
                      : "Save Octoparse template"}
                  </button>
                </div>
              </form>
            )}

            {saveMutation.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not save settings: {saveMutation.error.message}
              </p>
            )}
            {notice && <p className="settings-feedback" role="status">{notice}</p>}
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "crawler"}
          >
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

          <section
            className="panel settings-panel"
            hidden={activeSection !== "crawler"}
          >
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

function OctoparseUsagePanel({ usage }: { usage: OctoparseUsage }) {
  const period = new Date(usage.period_start).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="octoparse-usage">
      <p className="panel-subtitle">
        App-tracked tasks for {period} (UTC). Account-wide plan usage and
        remaining quota are not retrieved by this integration; check your
        Octoparse account for those totals.
      </p>
      <div className="octoparse-usage-grid">
        {[
          ["Tasks started", usage.tasks_started],
          ["Running", usage.tasks_running],
          ["Succeeded", usage.tasks_succeeded],
          ["Failed", usage.tasks_failed],
          ["All-time tasks", usage.all_time_tasks_started],
        ].map(([label, count]) => (
          <article className="octoparse-usage-card" key={label}>
            <span>{label}</span>
            <strong>{count.toLocaleString()}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function getTemplateFields(
  schema: Record<string, unknown>[],
): { field: string; required: boolean }[] {
  return schema.flatMap((item) => {
    const rawField = item.field ?? item.name ?? item.key;
    if (typeof rawField !== "string" || !rawField.trim()) return [];
    return [{
      field: rawField,
      required: item.required === true,
    }];
  });
}

function isSettingsSection(value: string): value is SettingsSection {
  return value === "tavily" || value === "octoparse" || value === "crawler";
}
