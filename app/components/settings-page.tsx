"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  assignGmailAccount,
  changePassword,
  deleteProfilePhoto,
  getAhrefsUsage,
  getApplicationSettings,
  getAuthSession,
  getConnectedGmailAccounts,
  getHypeStatUsage,
  getGoogleGmailAuthorizationUrl,
  getOctoparseTemplates,
  getOctoparseUsage,
  getOrganizationUsers,
  getTavilyUsage,
  removeGmailAssignment,
  updateAccountProfile,
  updateApplicationSettings,
  uploadProfilePhoto,
  type AuthSession,
  type AhrefsUsage,
  type ConnectedGmailAccount,
  type HypeStatUsage,
  type OctoparseTemplateConfiguration,
  type OctoparseTemplateOption,
  type OctoparseUsage,
  type TavilyUsage,
  type TavilySearchDepth,
} from "@/lib/api";
import { TAVILY_COUNTRIES } from "@/lib/discovery-options";
import { DomainChipInput } from "./domain-chip-input";
import { EmailSuppressionSettings } from "./email-suppression-settings";
import { ImageAssetEditor } from "./image-asset-editor";
import { PushNotificationSettings } from "./push-notification-settings";
import { useToast } from "./toast-provider";

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

const tavilySearchDepthOptions: {
  value: TavilySearchDepth;
  label: string;
}[] = [
  { value: "basic", label: "Basic · 1 credit" },
  { value: "fast", label: "Fast · 1 credit" },
  { value: "ultra-fast", label: "Ultra-Fast · 1 credit" },
  { value: "advanced", label: "Advanced · 2 credits" },
];

type SettingsSection =
  | "tavily"
  | "ahrefs"
  | "octoparse"
  | "hypestat"
  | "pagespeed"
  | "gemini"
  | "gmail"
  | "crawler"
  | "suppression"
  | "account"
  | "notifications";

export function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SettingsSection>("tavily");
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [
    tavilyDefaultSearchDepthOverride,
    setTavilyDefaultSearchDepthOverride,
  ] = useState<TavilySearchDepth | null>(null);
  const [tavilyDefaultCountryOverride, setTavilyDefaultCountryOverride] =
    useState<string | null>(null);
  const [
    tavilyDefaultExcludeDomainsOverride,
    setTavilyDefaultExcludeDomainsOverride,
  ] = useState<string[] | null>(null);
  const [octoparseApiKey, setOctoparseApiKey] = useState("");
  const [hypestatApiKey, setHypestatApiKey] = useState("");
  const [pagespeedApiKey, setPagespeedApiKey] = useState("");
  const [ahrefsApiKey, setAhrefsApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [hypestatAutoFetchEnabled, setHypestatAutoFetchEnabled] = useState<
    boolean | null
  >(null);
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [templateDraft, setTemplateDraft] =
    useState<OctoparseTemplateConfiguration | null>(null);
  const [additionalParametersText, setAdditionalParametersText] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState("");
  const settingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    retry: false,
  });
  const tavilyDefaultSearchDepth =
    tavilyDefaultSearchDepthOverride ??
    settingsQuery.data?.tavily_default_search_depth ??
    "basic";
  const tavilyDefaultCountry =
    tavilyDefaultCountryOverride ??
    settingsQuery.data?.tavily_default_country ??
    "";
  const tavilyDefaultExcludeDomains =
    tavilyDefaultExcludeDomainsOverride ??
    settingsQuery.data?.tavily_default_exclude_domains ??
    [];
  const authSessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const isOrganizationAdmin = authSessionQuery.data?.user.role === "admin";
  useEffect(() => {
    if (!requestedSection) return;
    if (
      isSettingsSection(requestedSection) &&
      (requestedSection !== "suppression" ||
        isOrganizationAdmin)
    ) {
      window.requestAnimationFrame(() =>
        setActiveSection(requestedSection),
      );
    }
  }, [isOrganizationAdmin, requestedSection]);
  const gmailStatus = useSyncExternalStore(
    subscribeToLocationChanges,
    getGmailCallbackStatus,
    () => null,
  );
  useEffect(() => {
    if (!gmailStatus) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [gmailStatus]);
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
  const hypestatUsageQuery = useQuery({
    queryKey: ["hypestat-usage"],
    queryFn: getHypeStatUsage,
    enabled: settingsQuery.data?.hypestat_configured === true,
    retry: false,
  });
  const ahrefsUsageQuery = useQuery({
    queryKey: ["ahrefs-usage"],
    queryFn: getAhrefsUsage,
    enabled: settingsQuery.data?.ahrefs_configured === true,
    retry: false,
  });
  const templateSearchMutation = useMutation({
    mutationFn: getOctoparseTemplates,
  });
  const configuredMaxPages =
    maxPages ?? settingsQuery.data?.crawl_max_pages ?? 6;
  const configuredMaxDepth =
    maxDepth ?? settingsQuery.data?.crawl_max_depth ?? 2;
  const configuredHypestatAutoFetch =
    hypestatAutoFetchEnabled ??
    settingsQuery.data?.hypestat_auto_fetch_enabled ??
    true;
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
      setHypestatApiKey("");
      setPagespeedApiKey("");
      setAhrefsApiKey("");
      setGeminiApiKey("");
      setHypestatAutoFetchEnabled(null);
      setMaxPages(null);
      setMaxDepth(null);
      setTavilyDefaultSearchDepthOverride(null);
      setTavilyDefaultCountryOverride(null);
      setTavilyDefaultExcludeDomainsOverride(null);
      setTemplateDraft(null);
      setAdditionalParametersText(null);
      setNotice("Settings saved.");
      queryClient.setQueryData(["application-settings"], settings);
      await queryClient.invalidateQueries({ queryKey: ["tavily-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["hypestat-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["ahrefs-usage"] });
    },
  });

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    saveMutation.mutate({
      tavily_api_key: tavilyApiKey.trim() || null,
    });
  }

  function saveTavilyDefaults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    saveMutation.mutate({
      tavily_default_search_depth: tavilyDefaultSearchDepth,
      tavily_default_country: tavilyDefaultCountry || null,
      tavily_default_exclude_domains: tavilyDefaultExcludeDomains,
    });
  }

  function saveCrawlerSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    saveMutation.mutate({
      crawl_max_pages: configuredMaxPages,
      crawl_max_depth: configuredMaxDepth,
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
          ?.field ??
        inputFields[0]?.field ??
        "",
      additional_parameters: {},
      title_field:
        outputFields.find(({ field }) => /title|name|business/i.test(field))
          ?.field ??
        outputFields[0]?.field ??
        "",
      url_field:
        outputFields.find(({ field }) => /url|link|website/i.test(field))
          ?.field ?? "",
      content_field:
        outputFields.find(({ field }) =>
          /description|content|summary/i.test(field),
        )?.field ?? null,
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
          <h1>Settings</h1>
          <p className="heading-copy">
            Manage providers, website indexing, notifications, and your account.
          </p>
        </div>
        <div className="settings-section-picker">
          <label className="settings-field">
            Settings for
            <select
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isSettingsSection(value)) {
                  setActiveSection(value);
                  router.replace(`/settings?section=${value}`, {
                    scroll: false,
                  });
                }
              }}
              value={activeSection}
            >
              <option value="tavily">Tavily</option>
              <option value="ahrefs">Ahrefs</option>
              <option value="octoparse">Octoparse</option>
              <option value="hypestat">HypeStat</option>
              <option value="pagespeed">PageSpeed</option>
              <option value="gemini">Gemini</option>
              {isOrganizationAdmin && (
                <option value="gmail">Gmail accounts</option>
              )}
              {isOrganizationAdmin && <option value="crawler">Indexing</option>}
              <option value="account">My account</option>
              <option value="notifications">Notifications</option>
              {isOrganizationAdmin && (
                <option value="suppression">Email suppression</option>
              )}
            </select>
          </label>
        </div>
      </section>

      {gmailStatus && (
        <p
          className={`settings-feedback${gmailStatus === "error" || gmailStatus === "already-connected" ? " settings-feedback-error" : ""}`}
          role={
            gmailStatus === "error" || gmailStatus === "already-connected"
              ? "alert"
              : "status"
          }
        >
          {gmailStatus === "connected"
            ? "Gmail account connected."
            : gmailStatus === "already-connected"
              ? "That Gmail account is already connected. Its existing access was not changed."
              : "Google did not complete the Gmail connection. You can try again."}
        </p>
      )}

      {settingsQuery.isPending && (
        <p className="settings-feedback" role="status">
          Loading settings…
        </p>
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
                  The API key is stored by this backend and is never returned to
                  this page.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.tavily_configured ? " is-configured" : ""}`}
              >
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
                  disabled={
                    usageQuery.isFetching ||
                    !settingsQuery.data.tavily_configured
                  }
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
                    Remove personal key
                  </button>
                )}
              </div>
            </form>

            <form
              className="settings-form tavily-default-preferences"
              onSubmit={saveTavilyDefaults}
            >
              <div>
                <p className="eyebrow">DISCOVERY DEFAULTS</p>
                <h3>Default Tavily search preferences</h3>
                <p className="panel-subtitle">
                  These organization defaults prefill the Discover Leads filters.
                </p>
              </div>
              {!isOrganizationAdmin && (
                <p className="settings-feedback">
                  An organization administrator can change these defaults.
                </p>
              )}
              <div className="settings-form-grid">
                <label className="settings-field">
                  Default search depth
                  <select
                    disabled={!isOrganizationAdmin || saveMutation.isPending}
                    onChange={(event) => {
                      const depth = tavilySearchDepthOptions.find(
                        (option) => option.value === event.target.value,
                      );
                      if (depth) {
                        setTavilyDefaultSearchDepthOverride(depth.value);
                      }
                    }}
                    value={tavilyDefaultSearchDepth}
                  >
                    {tavilySearchDepthOptions.map(({ label, value }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  Default country
                  <select
                    disabled={!isOrganizationAdmin || saveMutation.isPending}
                    onChange={(event) =>
                      setTavilyDefaultCountryOverride(event.target.value)
                    }
                    value={tavilyDefaultCountry}
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
              <fieldset disabled={!isOrganizationAdmin || saveMutation.isPending}>
                <DomainChipInput
                  domains={tavilyDefaultExcludeDomains}
                  label="Default excluded domains"
                  maxDomains={150}
                  onChange={setTavilyDefaultExcludeDomainsOverride}
                  placeholder="example.com"
                />
              </fieldset>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={
                    !isOrganizationAdmin ||
                    authSessionQuery.isPending ||
                    saveMutation.isPending
                  }
                  type="submit"
                >
                  {saveMutation.isPending
                    ? "Saving…"
                    : "Save search preferences"}
                </button>
              </div>
            </form>

            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save settings: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
            {usageQuery.isPending && settingsQuery.data.tavily_configured && (
              <p className="settings-feedback" role="status">
                Loading Tavily usage…
              </p>
            )}
            {usageQuery.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
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
                  The API key is never returned to this page.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.octoparse_configured ? " is-configured" : ""}`}
              >
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
                    Remove personal key
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
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not retrieve Octoparse usage:{" "}
                {octoparseUsageQuery.error.message}
              </p>
            )}
            {octoparseUsageQuery.data && (
              <OctoparseUsagePanel usage={octoparseUsageQuery.data} />
            )}

            {isOrganizationAdmin && (
              <>
                <form
                  className="settings-form octoparse-template-search"
                  onSubmit={searchOctoparseTemplates}
                >
                  <label className="settings-field">
                    Find a reusable Octoparse template
                    <input
                      minLength={2}
                      onChange={(event) =>
                        setTemplateKeyword(event.target.value)
                      }
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
                  <p
                    className="settings-feedback settings-feedback-error"
                    role="alert"
                  >
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
                            templateSearchMutation.data
                              .recommended_template_name && (
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
              </>
            )}

            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save settings: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "hypestat"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">HYPESTAT</p>
                <h2>API access and lookup behavior</h2>
                <p className="panel-subtitle">
                  The API key is stored as plaintext in the application
                  database and sent only from the Agent to the indexing service.
                  It is never
                  returned to this page.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.hypestat_configured ? " is-configured" : ""}`}
              >
                {settingsQuery.data.hypestat_configured
                  ? "Configured"
                  : "Not configured"}
              </span>
            </div>
            <p className="settings-feedback">
              Agent-to-indexing-service authentication:{" "}
              <strong>
                {settingsQuery.data.hypestat_service_auth_configured
                  ? "configured"
                  : "not configured"}
              </strong>
              . The shared token is kept in server environment settings and must
              match the indexing-service value; it is not editable here.
            </p>
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("");
                saveMutation.mutate({
                  hypestat_api_key: hypestatApiKey.trim() || null,
                  ...(authSessionQuery.data?.user.role === "admin"
                    ? {
                        hypestat_auto_fetch_enabled:
                          configuredHypestatAutoFetch,
                      }
                    : {}),
                });
              }}
            >
              <label className="settings-field">
                HypeStat API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setHypestatApiKey(event.target.value)}
                  placeholder={
                    settingsQuery.data.hypestat_configured
                      ? "Leave blank to keep the current key"
                      : "Enter your HypeStat API key"
                  }
                  type="password"
                  value={hypestatApiKey}
                />
              </label>
              {authSessionQuery.data?.user.role === "admin" && (
                <label className="settings-checkbox-field">
                  <input
                    checked={configuredHypestatAutoFetch}
                    onChange={(event) =>
                      setHypestatAutoFetchEnabled(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>
                    Automatically fetch HypeStat profiles when websites are
                    saved from discovery
                  </span>
                </label>
              )}
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending}
                  type="submit"
                >
                  {saveMutation.isPending
                    ? "Saving…"
                    : "Save HypeStat settings"}
                </button>
                {settingsQuery.data.hypestat_configured && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      setNotice("");
                      saveMutation.mutate({ hypestat_api_key: "" });
                    }}
                    type="button"
                  >
                    Remove saved key
                  </button>
                )}
              </div>
            </form>
            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save HypeStat settings: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
            {hypestatUsageQuery.isPending &&
              settingsQuery.data.hypestat_configured && (
                <p className="settings-feedback" role="status">
                  Loading HypeStat usage…
                </p>
              )}
            {hypestatUsageQuery.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not retrieve HypeStat usage:{" "}
                {hypestatUsageQuery.error.message}
              </p>
            )}
            {hypestatUsageQuery.data &&
              settingsQuery.data.hypestat_configured && (
                <HypeStatUsagePanel usage={hypestatUsageQuery.data} />
              )}
            {!settingsQuery.data.hypestat_configured && (
              <p className="settings-feedback">
                Add an API key to enable HypeStat lookups. The indexing-service
                shared token remains a server-only deployment setting.
              </p>
            )}
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "ahrefs"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">AHREFS</p>
                <h2>API subscription and usage</h2>
                <p className="panel-subtitle">
                  Your key is stored on the backend and is never returned to
                  this page. Usage is retrieved from Ahrefs without consuming
                  Site Explorer units.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.ahrefs_configured ? " is-configured" : ""}`}
              >
                {settingsQuery.data.ahrefs_configured
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
                  ahrefs_api_key: ahrefsApiKey.trim() || null,
                });
              }}
            >
              <label className="settings-field">
                Ahrefs API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setAhrefsApiKey(event.target.value)}
                  placeholder={
                    settingsQuery.data.ahrefs_configured
                      ? "Leave blank to keep the current key"
                      : "Enter your Ahrefs API key"
                  }
                  type="password"
                  value={ahrefsApiKey}
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
                  disabled={
                    !settingsQuery.data.ahrefs_configured ||
                    ahrefsUsageQuery.isFetching
                  }
                  onClick={() => void ahrefsUsageQuery.refetch()}
                  type="button"
                >
                  {ahrefsUsageQuery.isFetching
                    ? "Refreshing…"
                    : "Refresh usage"}
                </button>
                {settingsQuery.data.ahrefs_configured && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      setNotice("");
                      saveMutation.mutate({ ahrefs_api_key: "" });
                    }}
                    type="button"
                  >
                    Remove saved key
                  </button>
                )}
              </div>
            </form>
            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save Ahrefs settings: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
            {settingsQuery.data.ahrefs_configured &&
              ahrefsUsageQuery.isPending && (
                <p className="settings-feedback" role="status">
                  Loading Ahrefs usage…
                </p>
              )}
            {settingsQuery.data.ahrefs_configured &&
              ahrefsUsageQuery.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not retrieve Ahrefs usage:{" "}
                {ahrefsUsageQuery.error.message}
              </p>
            )}
            {settingsQuery.data.ahrefs_configured &&
              ahrefsUsageQuery.data && (
              <AhrefsUsagePanel usage={ahrefsUsageQuery.data} />
            )}
            {!settingsQuery.data.ahrefs_configured && (
              <p className="settings-feedback">
                Add an API key to view subscription limits and unit usage.
              </p>
            )}
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "crawler"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">WEBSITE INDEXING</p>
                <h2>Indexing limits</h2>
                <p className="panel-subtitle">
                  Applied to new indexing jobs immediately. The indexing deployment
                  still enforces its own maximum limits.
                </p>
              </div>
            </div>
            <form className="settings-form" onSubmit={saveCrawlerSettings}>
              <div className="settings-limit-grid">
                <label className="settings-field">
                  Maximum pages
                  <input
                    max={6}
                    min={1}
                    onChange={(event) =>
                      setMaxPages(Number(event.target.value))
                    }
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
                    onChange={(event) =>
                      setMaxDepth(Number(event.target.value))
                    }
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
                  {saveMutation.isPending ? "Saving…" : "Save indexing limits"}
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
              <h2>Other indexing settings</h2>
              <p className="panel-subtitle">
                These values belong to the indexing service process and take
                effect only when changed in its deployment environment and
                restarted.
              </p>
            </div>
            <ul className="deployment-settings-list">
              {deploymentManagedSettings.map((setting) => (
                <li key={setting}>
                  <code>{setting}</code>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "pagespeed"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">GOOGLE PAGESPEED</p>
                <h2>Your personal API key</h2>
                <p className="panel-subtitle">
                  PageSpeed jobs use the key belonging to the user who created
                  the job. The key is stored as plaintext in the application
                  database and never returned.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.pagespeed_configured ? " is-configured" : ""}`}
              >
                {settingsQuery.data.pagespeed_configured
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
                  pagespeed_api_key: pagespeedApiKey.trim() || null,
                });
              }}
            >
              <label className="settings-field">
                Google PageSpeed API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setPagespeedApiKey(event.target.value)}
                  placeholder="Leave blank to keep the current key"
                  type="password"
                  value={pagespeedApiKey}
                />
              </label>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending}
                  type="submit"
                >
                  Save PageSpeed key
                </button>
                {settingsQuery.data.pagespeed_configured && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      setNotice("");
                      saveMutation.mutate({ pagespeed_api_key: "" });
                    }}
                    type="button"
                  >
                    Remove personal key
                  </button>
                )}
              </div>
            </form>
            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save PageSpeed key: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
          </section>

          <section
            className="panel settings-panel"
            hidden={activeSection !== "gemini"}
          >
            <div className="settings-section-heading">
              <div>
                <p className="eyebrow">GOOGLE GEMINI</p>
                <h2>AI template drafts</h2>
                <p className="panel-subtitle">
                  Use your own Gemini key to create editable drafts from the
                  Templates page. The key is never returned and is stored as
                  plaintext in the application database.
                </p>
              </div>
              <span
                className={`settings-connection-badge${settingsQuery.data.gemini_configured ? " is-configured" : ""}`}
              >
                {settingsQuery.data.gemini_configured
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
                  gemini_api_key: geminiApiKey.trim() || null,
                });
              }}
            >
              <label className="settings-field">
                Gemini API key
                <input
                  autoComplete="new-password"
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                  placeholder={
                    settingsQuery.data.gemini_configured
                      ? "Leave blank to keep the saved key"
                      : "Paste your Gemini API key"
                  }
                  type="password"
                  value={geminiApiKey}
                />
              </label>
              <div className="settings-actions">
                <button
                  className="button button-primary"
                  disabled={saveMutation.isPending || !geminiApiKey.trim()}
                  type="submit"
                >
                  {saveMutation.isPending
                    ? "Saving…"
                    : settingsQuery.data.gemini_configured
                      ? "Update key"
                      : "Save key"}
                </button>
                {settingsQuery.data.gemini_configured && (
                  <button
                    className="button button-secondary"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      setNotice("");
                      saveMutation.mutate({ gemini_api_key: "" });
                    }}
                    type="button"
                  >
                    Remove key
                  </button>
                )}
              </div>
            </form>
            {saveMutation.isError && (
              <p
                className="settings-feedback settings-feedback-error"
                role="alert"
              >
                Could not save Gemini key: {saveMutation.error.message}
              </p>
            )}
            {notice && (
              <p className="settings-feedback" role="status">
                {notice}
              </p>
            )}
          </section>

          {isOrganizationAdmin && (
            <section
              className="panel settings-panel"
              hidden={activeSection !== "suppression"}
            >
              <EmailSuppressionSettings />
            </section>
          )}

          {isOrganizationAdmin && authSessionQuery.data && (
            <section
              className="panel settings-panel"
              hidden={activeSection !== "gmail"}
            >
              <GmailAccountsPanel session={authSessionQuery.data} />
            </section>
          )}

          <section
            className="panel settings-panel settings-account-page"
            hidden={activeSection !== "account"}
          >
            {authSessionQuery.data && (
              <AccountProfilePanel session={authSessionQuery.data} />
            )}
            <ChangePasswordPanel />
          </section>
        </>
      )}
      {activeSection === "notifications" && <PushNotificationSettings />}
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
          ["Index", usage.key.crawl_usage],
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

function HypeStatUsagePanel({ usage }: { usage: HypeStatUsage }) {
  const { limits, used, resets_at: resetsAt } = usage.data;

  return (
    <div className="tavily-usage">
      <article className="tavily-usage-card">
        <span>Requests used today</span>
        <strong>
          {used.today.toLocaleString()} / {limits.requests_per_day.toLocaleString()}
        </strong>
        <progress
          aria-label="HypeStat daily request usage"
          max={Math.max(limits.requests_per_day, 1)}
          value={Math.min(used.today, limits.requests_per_day)}
        />
        <small>
          {usage.meta.requests_left_today.toLocaleString()} requests remaining
        </small>
      </article>
      <article className="tavily-usage-card">
        <span>Analyses used today</span>
        <strong>
          {used.analyses_today.toLocaleString()} /{" "}
          {limits.analyses_per_day.toLocaleString()}
        </strong>
        <small>
          {Math.max(limits.analyses_per_day - used.analyses_today, 0).toLocaleString()}{" "}
          analyses remaining
        </small>
      </article>
      <article className="tavily-usage-card">
        <span>Requests this minute</span>
        <strong>
          {used.this_minute.toLocaleString()} /{" "}
          {limits.requests_per_minute.toLocaleString()}
        </strong>
        <small>
          Resets at {new Date(resetsAt).toLocaleString()}
        </small>
      </article>
    </div>
  );
}

function AhrefsUsagePanel({ usage }: { usage: AhrefsUsage }) {
  const { limits_and_usage: limits } = usage;
  const usageCards = [
    {
      label: "API key units",
      used: limits.units_usage_api_key,
      limit: limits.units_limit_api_key,
    },
    ...(limits.units_usage_workspace !== null
      ? [
          {
            label: "Workspace units",
            used: limits.units_usage_workspace,
            limit: limits.units_limit_workspace,
          },
        ]
      : []),
  ];

  return (
    <div className="tavily-usage">
      <p className="panel-subtitle">
        Subscription: {limits.subscription}. Usage resets{" "}
        {new Date(limits.usage_reset_date).toLocaleDateString()}.
      </p>
      <div className="tavily-usage">
        {usageCards.map(({ label, used, limit }) => (
          <article className="tavily-usage-card" key={label}>
            <span>{label}</span>
            <strong>
              {used.toLocaleString()} /{" "}
              {limit === null ? "unlimited" : limit.toLocaleString()}
            </strong>
            {limit !== null && (
              <>
                <progress
                  aria-label={`Ahrefs ${label.toLowerCase()} usage`}
                  max={Math.max(limit, 1)}
                  value={Math.min(used, limit)}
                />
                <small>
                  {Math.max(limit - used, 0).toLocaleString()} units remaining
                </small>
              </>
            )}
          </article>
        ))}
      </div>
      {limits.api_key_expiration_date && (
        <p className="settings-feedback">
          API key expires{" "}
          {new Date(limits.api_key_expiration_date).toLocaleDateString()}.
        </p>
      )}
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
    return [
      {
        field: rawField,
        required: item.required === true,
      },
    ];
  });
}

function isSettingsSection(value: string): value is SettingsSection {
  return (
    value === "tavily" ||
    value === "ahrefs" ||
    value === "octoparse" ||
    value === "hypestat" ||
    value === "pagespeed" ||
    value === "gemini" ||
    value === "gmail" ||
    value === "crawler" ||
    value === "suppression" ||
    value === "account" ||
    value === "notifications"
  );
}

function subscribeToLocationChanges(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getGmailCallbackStatus():
  | "connected"
  | "error"
  | "already-connected"
  | null {
  const status = new URLSearchParams(window.location.search).get("gmail");
  return status === "connected" ||
    status === "error" ||
    status === "already-connected"
    ? status
    : null;
}

function ChangePasswordPanel() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async (session) => {
      setCurrentPassword("");
      setNewPassword("");
      queryClient.setQueryData(["auth-session"], session);
    },
  });

  return (
    <div className="settings-account-card settings-password-card">
      <div>
        <p className="eyebrow">SECURITY</p>
        <h2>Password</h2>
        <p className="panel-subtitle">
          Update your password to protect this account.
        </p>
      </div>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          passwordMutation.mutate({
            current_password: currentPassword,
            new_password: newPassword,
          });
        }}
      >
        <label className="settings-field">
          Current password
          <input
            autoComplete="current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <label className="settings-field">
          New password
          <input
            autoComplete="new-password"
            minLength={12}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>
        {passwordMutation.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not change password: {passwordMutation.error.message}
          </p>
        )}
        {passwordMutation.isSuccess && (
          <p className="settings-feedback" role="status">
            Password changed. Other active sessions were signed out.
          </p>
        )}
        <div className="settings-actions">
          <button
            className="button button-primary"
            disabled={passwordMutation.isPending}
            type="submit"
          >
            {passwordMutation.isPending ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AccountProfilePanel({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(
    session.user.first_name ?? "",
  );
  const [lastName, setLastName] = useState(
    session.user.last_name ?? "",
  );
  const profileMutation = useMutation({
    mutationFn: updateAccountProfile,
    onSuccess: async (updatedSession) => {
      queryClient.setQueryData(["auth-session"], updatedSession);
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
    },
  });
  const photoMutation = useMutation<
    { url: string } | void,
    Error,
    File | null
  >({
    mutationFn: (file: File | null) =>
      file ? uploadProfilePhoto(file) : deleteProfilePhoto(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-session"] }),
        queryClient.invalidateQueries({ queryKey: ["organization-users"] }),
      ]);
    },
  });
  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
    session.user.email;
  const fallback =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="settings-account-card settings-account-profile">
      <div className="settings-account-profile-heading">
        <div className="settings-account-person">
          <div className="settings-account-avatar">
            {session.user.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${displayName} profile`}
                src={session.user.profile_photo_url}
              />
            ) : (
              <span aria-hidden="true">{fallback}</span>
            )}
          </div>
          <div>
            <p className="eyebrow">PROFILE</p>
            <h2>{displayName}</h2>
            <p className="settings-account-person-meta">
              {session.organization_name} · {session.user.role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
        </div>
        <span className="settings-account-email">{session.user.email}</span>
      </div>
      <div className="settings-profile-photo-row">
        <div>
          <h3>Profile photo</h3>
          <p>Shown beside your name across ProspectLoop.</p>
        </div>
        <ImageAssetEditor
          error={
            photoMutation.isError ? photoMutation.error.message : undefined
          }
          fallback={fallback}
          label="Profile photo"
          onRemove={() => photoMutation.mutate(null)}
          onUpload={(file) => photoMutation.mutate(file)}
          pending={photoMutation.isPending}
          url={session.user.profile_photo_url}
          variant="profile"
        />
      </div>
      <form
        className="settings-form settings-account-name-form"
        onSubmit={(event) => {
          event.preventDefault();
          profileMutation.mutate({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          });
        }}
      >
        <div className="settings-form-grid settings-account-name-grid">
          <label className="settings-field">
            First name
            <input
              autoComplete="given-name"
              disabled={profileMutation.isPending}
              maxLength={100}
              onChange={(event) => {
                setFirstName(event.target.value);
                profileMutation.reset();
              }}
              required
              value={firstName}
            />
          </label>
          <label className="settings-field">
            Last name
            <input
              autoComplete="family-name"
              disabled={profileMutation.isPending}
              maxLength={100}
              onChange={(event) => {
                setLastName(event.target.value);
                profileMutation.reset();
              }}
              required
              value={lastName}
            />
          </label>
        </div>
        {profileMutation.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not update personal details: {profileMutation.error.message}
          </p>
        )}
        {profileMutation.isSuccess && (
          <p className="settings-feedback" role="status">
            Personal details updated.
          </p>
        )}
        <div className="settings-actions">
          <button
            className="button button-primary"
            disabled={profileMutation.isPending}
            type="submit"
          >
            {profileMutation.isPending ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GmailAccountsPanel({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>(
    {},
  );
  const accountsQuery = useQuery({
    queryKey: ["gmail-accounts"],
    queryFn: getConnectedGmailAccounts,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: ["organization-users"],
    queryFn: getOrganizationUsers,
    retry: false,
  });
  const assignMutation = useMutation({
    mutationFn: ({
      gmailAccountId,
      userId,
    }: {
      gmailAccountId: string;
      userId: string;
    }) => assignGmailAccount(gmailAccountId, userId),
    onSuccess: async (_assignment, variables) => {
      setSelectedUsers((current) => ({
        ...current,
        [variables.gmailAccountId]: "",
      }));
      await queryClient.invalidateQueries({ queryKey: ["gmail-accounts"] });
      const accountEmail = accountsQuery.data?.find(
        (account) => account.id === variables.gmailAccountId,
      )?.email_address;
      const userEmail = usersQuery.data?.users.find(
        (user) => user.id === variables.userId,
      )?.email;
      showToast({
        type: "success",
        title: "Gmail account assigned",
        message: `${accountEmail ?? "The Gmail account"} was assigned to ${userEmail ?? "the selected user"}.`,
      });
    },
  });
  const removeMutation = useMutation({
    mutationFn: removeGmailAssignment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gmail-accounts"] });
      showToast({
        type: "success",
        title: "Gmail assignment removed",
        message: "The user no longer has access to that account.",
      });
    },
  });

  function connectGmailAccount() {
    window.location.assign(
      getGoogleGmailAuthorizationUrl(session.organization_id),
    );
  }

  return (
    <>
      <div>
        <p className="eyebrow">GOOGLE WORKSPACE</p>
        <h2>Connected Gmail accounts</h2>
        <p className="panel-subtitle">
          Connect shared inboxes and assign each account to active organization
          users. Assigned users can use the approved Gmail read, modify, and
          send permissions. Member-connected personal accounts stay with their
          connector and cannot be reassigned.
        </p>
      </div>
      <div className="settings-actions">
        <button
          className="button button-primary"
          onClick={connectGmailAccount}
          type="button"
        >
          Connect a Gmail account
        </button>
      </div>
      {accountsQuery.isPending && (
        <p className="settings-feedback" role="status">
          Loading connected Gmail accounts…
        </p>
      )}
      {accountsQuery.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not load Gmail accounts: {accountsQuery.error.message}
        </p>
      )}
      {usersQuery.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not load organization users: {usersQuery.error.message}
        </p>
      )}
      {accountsQuery.data?.length === 0 && (
        <p className="empty-copy">
          No Gmail accounts are connected to this organization yet.
        </p>
      )}
      {accountsQuery.data && usersQuery.data && (
        <div className="gmail-account-list">
          {accountsQuery.data.map((account) => (
            <GmailAccountCard
              account={account}
              assignPending={assignMutation.isPending}
              onAssign={(userId) =>
                assignMutation.mutate({
                  gmailAccountId: account.id,
                  userId,
                })
              }
              onRemoveAssignment={(assignmentId) => {
                if (
                  window.confirm(
                    "Unassign this Gmail account from the user? Their access will stop immediately.",
                  )
                ) {
                  removeMutation.mutate(assignmentId);
                }
              }}
              onUserChange={(userId) =>
                setSelectedUsers((current) => ({
                  ...current,
                  [account.id]: userId,
                }))
              }
              removePending={removeMutation.isPending}
              selectedUserId={selectedUsers[account.id] ?? ""}
              users={usersQuery.data.users}
              key={account.id}
            />
          ))}
        </div>
      )}
      {assignMutation.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not assign the Gmail account: {assignMutation.error.message}
        </p>
      )}
      {removeMutation.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not remove the Gmail assignment: {removeMutation.error.message}
        </p>
      )}
    </>
  );
}

function GmailAccountCard({
  account,
  users,
  selectedUserId,
  assignPending,
  removePending,
  onUserChange,
  onAssign,
  onRemoveAssignment,
}: {
  account: ConnectedGmailAccount;
  users: { id: string; email: string; is_active: boolean }[];
  selectedUserId: string;
  assignPending: boolean;
  removePending: boolean;
  onUserChange: (userId: string) => void;
  onAssign: (userId: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}) {
  const availableUsers = users.filter(
    (user) =>
      user.is_active &&
      !account.assigned_users.some(
        (assignedUser) => assignedUser.user_id === user.id,
      ),
  );
  const ownerEmail = users.find(
      (user) => user.id === account.owner_user_id,
  )?.email;

  return (
    <article className="gmail-account-card">
      <div className="settings-section-heading">
        <div>
          <h3>{account.email_address}</h3>
          {account.owner_user_id && (
            <p className="settings-feedback">
              Personal Gmail{ownerEmail ? ` · owned by ${ownerEmail}` : ""}
            </p>
          )}
          <p className="settings-feedback">
            Refresh token updated{" "}
            {new Date(account.token_updated_at).toLocaleString()}
          </p>
        </div>
        <span className="settings-connection-badge is-configured">
          Connected
        </span>
      </div>
      <div>
        <h4 className="gmail-account-subheading">Assigned users</h4>
        {account.assigned_users.length === 0 ? (
          <p className="settings-feedback">No users are assigned yet.</p>
        ) : (
          <ul className="gmail-assignment-list">
            {account.assigned_users.map((assignedUser) => (
              <li
                className="gmail-assignment-row"
                key={assignedUser.assignment_id}
              >
                <span>{assignedUser.email}</span>
                {!account.owner_user_id && (
                  <button
                    aria-label={`Unassign Gmail from ${assignedUser.email}`}
                    className="button button-secondary"
                    disabled={removePending}
                    onClick={() =>
                      onRemoveAssignment(assignedUser.assignment_id)
                    }
                    type="button"
                  >
                    Unassign
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!account.owner_user_id && (
        <form
          className="gmail-assignment-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedUserId) onAssign(selectedUserId);
          }}
        >
          <label className="settings-field">
            Assign to an organization user
            <select
              disabled={availableUsers.length === 0 || assignPending}
              onChange={(event) => onUserChange(event.target.value)}
              value={selectedUserId}
            >
              <option value="">
                {availableUsers.length === 0
                  ? "No unassigned active users"
                  : "Select a user"}
              </option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            disabled={!selectedUserId || assignPending}
            type="submit"
          >
            {assignPending ? "Assigning…" : "Assign account"}
          </button>
        </form>
      )}
    </article>
  );
}

