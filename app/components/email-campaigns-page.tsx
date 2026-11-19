"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  PENDING_CAMPAIGN_AUDIENCE_KEY,
  createEmailCampaign,
  deleteEmailCampaign,
  getAssignedGmailAccounts,
  getAuthSession,
  getCompanies,
  getEmailCampaign,
  getEmailCampaigns,
  getEmailTemplates,
  getGmailAccountHealth,
  getQueueEventsWebSocketUrl,
  pauseEmailCampaign,
  previewEmailCampaign,
  resumeEmailCampaign,
  startEmailCampaign,
  type EmailCampaign,
  type EmailCampaignFollowUpStep,
  type EmailCampaignInput,
  type EmailCampaignPreview,
} from "@/lib/api";
import { useToast } from "./toast-provider";

interface CampaignPreviewState {
  campaignId: string;
  companyIds: string[];
  result: EmailCampaignPreview;
}

const initialCampaignInput = (): EmailCampaignInput => ({
  name: "",
  template_id: "",
  gmail_account_ids: [],
  daily_limit_per_account: 40,
  min_delay_seconds: 180,
  max_delay_seconds: 420,
  send_window_start_hour: 9,
  send_window_end_hour: 17,
  timezone: "UTC",
  follow_up_steps: [],
  verify_mx: true,
});

export function EmailCampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldCreateFromQuery = searchParams.get("create") === "1";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [campaignInput, setCampaignInput] = useState<EmailCampaignInput>(
    initialCampaignInput,
  );
  const [companySearch, setCompanySearch] = useState("");
  const [companySelection, setCompanySelection] = useState<{
    campaignId: string | null;
    ids: string[];
  }>({ campaignId: null, ids: [] });
  const [companySelectionError, setCompanySelectionError] = useState("");
  const [pendingAudienceError, setPendingAudienceError] = useState("");
  const [previewState, setPreviewState] =
    useState<CampaignPreviewState | null>(null);
  const [confirmDeleteCampaignId, setConfirmDeleteCampaignId] = useState<
    string | null
  >(null);
  const [eventStreamConnected, setEventStreamConnected] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const organizationId = sessionQuery.data?.organization_id ?? "";
  const isAdmin = sessionQuery.data?.user.role === "admin";

  const campaignsQuery = useQuery({
    queryKey: ["email-campaigns", organizationId],
    queryFn: () => getEmailCampaigns(organizationId),
    enabled: Boolean(organizationId),
    refetchInterval: 15_000,
    retry: false,
  });
  const campaigns = useMemo(
    () => campaignsQuery.data ?? [],
    [campaignsQuery.data],
  );
  const activeCampaignId =
    campaigns.find((campaign) => campaign.id === selectedCampaignId)?.id ??
    campaigns[0]?.id ??
    null;
  const campaignDetailQuery = useQuery({
    queryKey: ["email-campaign", organizationId, activeCampaignId],
    queryFn: () => {
      if (!activeCampaignId) {
        throw new Error("Select a campaign to inspect.");
      }
      return getEmailCampaign(organizationId, activeCampaignId);
    },
    enabled: Boolean(organizationId && activeCampaignId),
    refetchInterval: 15_000,
    retry: false,
  });
  const templatesQuery = useQuery({
    queryKey: ["email-templates", organizationId],
    queryFn: () => getEmailTemplates(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const accountsQuery = useQuery({
    queryKey: ["gmail-assigned-accounts"],
    queryFn: getAssignedGmailAccounts,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const accountHealthQuery = useQuery({
    queryKey: ["gmail-account-health", organizationId],
    queryFn: getGmailAccountHealth,
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
    retry: false,
  });
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled: Boolean(organizationId),
    retry: false,
  });

  const createOpen = shouldCreateFromQuery || manualCreateOpen;
  const templates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data],
  );
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const companies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data]);
  const selectedCompanyIds =
    companySelection.campaignId === activeCampaignId ? companySelection.ids : [];
  const selectedCampaign =
    campaignDetailQuery.data ??
    campaigns.find((campaign) => campaign.id === activeCampaignId) ??
    null;
  const templateNames = useMemo(
    () => new Map(templates.map((template) => [template.id, template.name])),
    [templates],
  );
  const filteredCompanies = useMemo(() => {
    const term = companySearch.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((company) =>
      [company.name, company.domain, company.website]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [companies, companySearch]);

  useEffect(() => {
    if (!organizationId) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    function connect() {
      if (disposed) return;
      socket = new WebSocket(getQueueEventsWebSocketUrl());
      socket.onopen = () => {
        if (!disposed) setEventStreamConnected(true);
      };
      socket.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch (error) {
          console.error("Could not parse a queue event.", error);
          return;
        }
        if (
          typeof payload === "object" &&
          payload !== null &&
          "kind" in payload &&
          typeof payload.kind === "string" &&
          payload.kind.startsWith("email_campaign")
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["email-campaigns", organizationId],
          });
          void queryClient.invalidateQueries({
            queryKey: ["email-campaign", organizationId],
          });
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setEventStreamConnected(false);
        reconnectTimer = window.setTimeout(connect, 5_000);
      };
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
      setEventStreamConnected(false);
    };
  }, [organizationId, queryClient]);

  const invalidateCampaignQueries = async (campaignId?: string) => {
    await queryClient.invalidateQueries({
      queryKey: ["email-campaigns", organizationId],
    });
    if (campaignId) {
      await queryClient.invalidateQueries({
        queryKey: ["email-campaign", organizationId, campaignId],
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: ({
      input,
    }: {
      input: EmailCampaignInput;
      audienceIds: string[] | null;
    }) => createEmailCampaign(organizationId, input),
    onSuccess: async (campaign, variables) => {
      try {
        window.sessionStorage.removeItem(PENDING_CAMPAIGN_AUDIENCE_KEY);
      } catch (error) {
        console.error("Could not clear the selected campaign audience.", error);
      }
      queryClient.setQueryData<EmailCampaign[]>(
        ["email-campaigns", organizationId],
        (current) => [
          campaign,
          ...(current ?? []).filter((item) => item.id !== campaign.id),
        ],
      );
      setManualCreateOpen(false);
      setCampaignInput(initialCampaignInput());
      setSelectedCampaignId(campaign.id);
      setCompanySelection({
        campaignId: campaign.id,
        ids: variables.audienceIds ?? [],
      });
      setPreviewState(null);
      setCompanySelectionError("");
      setPendingAudienceError("");
      router.replace("/campaigns", { scroll: false });
      await invalidateCampaignQueries(campaign.id);
      showToast({
        type: "success",
        title: "Campaign created",
        message: `${campaign.name} is ready to configure.`,
      });
    },
  });
  const previewMutation = useMutation({
    mutationFn: ({
      campaignId,
      companyIds,
    }: {
      campaignId: string;
      companyIds: string[];
    }) => previewEmailCampaign(organizationId, campaignId, companyIds),
    onSuccess: (result, variables) => {
      setPreviewState({
        campaignId: variables.campaignId,
        companyIds: variables.companyIds,
        result,
      });
    },
  });
  const startMutation = useMutation({
    mutationFn: ({
      campaignId,
      companyIds,
    }: {
      campaignId: string;
      companyIds: string[];
    }) => startEmailCampaign(organizationId, campaignId, companyIds),
    onSuccess: async (campaign) => {
      setPreviewState(null);
      setCompanySelection({ campaignId: campaign.id, ids: [] });
      await invalidateCampaignQueries(campaign.id);
      showToast({
        type: "success",
        title: "Campaign started",
        message: `${campaign.name} has been queued for sending.`,
      });
    },
  });
  const pauseMutation = useMutation({
    mutationFn: (campaignId: string) =>
      pauseEmailCampaign(organizationId, campaignId),
    onSuccess: async (campaign) => {
      await invalidateCampaignQueries(campaign.id);
      showToast({
        type: "success",
        title: "Campaign paused",
        message: `${campaign.name} will not send additional messages until resumed.`,
      });
    },
  });
  const resumeMutation = useMutation({
    mutationFn: (campaignId: string) =>
      resumeEmailCampaign(organizationId, campaignId),
    onSuccess: async (campaign) => {
      await invalidateCampaignQueries(campaign.id);
      showToast({
        type: "success",
        title: "Campaign resumed",
        message: `${campaign.name} is active again.`,
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (campaignId: string) =>
      deleteEmailCampaign(organizationId, campaignId),
    onSuccess: async (_result, campaignId) => {
      queryClient.setQueryData<EmailCampaign[]>(
        ["email-campaigns", organizationId],
        (current) => current?.filter((item) => item.id !== campaignId) ?? [],
      );
      setConfirmDeleteCampaignId(null);
      setSelectedCampaignId(null);
      setCompanySelection({ campaignId: null, ids: [] });
      setCompanySelectionError("");
      await invalidateCampaignQueries(campaignId);
      showToast({
        type: "success",
        title: "Campaign deleted",
        message: "The campaign was removed.",
      });
    },
  });

  const selectedCompanyKey = [...selectedCompanyIds].sort().join("|");
  const previewMatchesSelection =
    previewState?.campaignId === selectedCampaign?.id &&
    [...(previewState?.companyIds ?? [])].sort().join("|") ===
      selectedCompanyKey;
  const liveMutationError =
    createMutation.error ??
    previewMutation.error ??
    startMutation.error ??
    pauseMutation.error ??
    resumeMutation.error ??
    deleteMutation.error;

  function updateCampaignInput<K extends keyof EmailCampaignInput>(
    field: K,
    value: EmailCampaignInput[K],
  ) {
    setCampaignInput((current) => ({ ...current, [field]: value }));
  }

  function updateFollowUpStep(
    index: number,
    update: Partial<EmailCampaignFollowUpStep>,
  ) {
    setCampaignInput((current) => ({
      ...current,
      follow_up_steps: current.follow_up_steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...update } : step,
      ),
    }));
  }

  function addFollowUpStep() {
    setCampaignInput((current) =>
      current.follow_up_steps.length >= 10
        ? current
        : {
            ...current,
            follow_up_steps: [
              ...current.follow_up_steps,
              { template_id: "", delay_days: 3 },
            ],
          },
    );
  }

  function removeFollowUpStep(index: number) {
    setCampaignInput((current) => ({
      ...current,
      follow_up_steps: current.follow_up_steps.filter(
        (_, stepIndex) => stepIndex !== index,
      ),
    }));
  }

  function updateSelectedCompanyIds(
    update: (current: string[]) => string[],
  ) {
    setCompanySelection((current) => ({
      campaignId: activeCampaignId,
      ids: update(
        current.campaignId === activeCampaignId ? current.ids : [],
      ),
    }));
  }

  function selectCampaign(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setCompanySelection({ campaignId, ids: [] });
    setCompanySelectionError("");
    setPreviewState(null);
    setConfirmDeleteCampaignId(null);
    previewMutation.reset();
    startMutation.reset();
  }

  function toggleAccount(accountId: string) {
    setCampaignInput((current) => ({
      ...current,
      gmail_account_ids: current.gmail_account_ids.includes(accountId)
        ? current.gmail_account_ids.filter((id) => id !== accountId)
        : [...current.gmail_account_ids, accountId],
    }));
  }

  function toggleCompany(companyId: string) {
    setCompanySelectionError("");
    setPreviewState(null);
    if (
      !selectedCompanyIds.includes(companyId) &&
      selectedCompanyIds.length >= 5_000
    ) {
      setCompanySelectionError(
        "A campaign can target at most 5,000 companies at a time.",
      );
      return;
    }
    updateSelectedCompanyIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId],
    );
  }

  function toggleVisibleCompanies() {
    const visibleIds = filteredCompanies.map((company) => company.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((companyId) => selectedCompanyIds.includes(companyId));
    setPreviewState(null);
    setCompanySelectionError("");
    if (allVisibleSelected) {
      updateSelectedCompanyIds((current) =>
        current.filter((id) => !visibleIds.includes(id)),
      );
      return;
    }
    const next = new Set([...selectedCompanyIds, ...visibleIds]);
    if (next.size > 5_000) {
      setCompanySelectionError(
        "A campaign can target at most 5,000 companies at a time.",
      );
    }
    updateSelectedCompanyIds(() => [...next].slice(0, 5_000));
  }

  function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAudienceError) return;
    let audienceIds: string[] | null = null;
    if (shouldCreateFromQuery) {
      try {
        const savedAudience = window.sessionStorage.getItem(
          PENDING_CAMPAIGN_AUDIENCE_KEY,
        );
        if (savedAudience !== null) {
          const parsedAudience: unknown = JSON.parse(savedAudience);
          if (!Array.isArray(parsedAudience)) {
            throw new Error("The selected campaign audience is invalid.");
          }
          const stringIds = parsedAudience.filter(
            (id): id is string => typeof id === "string",
          );
          if (stringIds.length !== parsedAudience.length) {
            throw new Error("The selected campaign audience is invalid.");
          }
          audienceIds = [...new Set(stringIds)];
          if (audienceIds.length === 0 || audienceIds.length > 5_000) {
            throw new Error("The selected campaign audience is empty or too large.");
          }
        }
      } catch (error) {
        console.error("Could not load the selected campaign audience.", error);
        setPendingAudienceError(
          "Could not load the selected leads. Return to Leads and select them again.",
        );
        return;
      }
    }

    createMutation.mutate({
      input: {
        ...campaignInput,
        name: campaignInput.name.trim(),
      },
      audienceIds,
    });
  }

  function requestPreview() {
    if (!selectedCampaign || selectedCompanyIds.length === 0) return;
    setPreviewState(null);
    previewMutation.mutate({
      campaignId: selectedCampaign.id,
      companyIds: [...selectedCompanyIds],
    });
  }

  function requestStart() {
    if (
      !selectedCampaign ||
      selectedCompanyIds.length === 0 ||
      !previewMatchesSelection
    ) {
      return;
    }
    startMutation.mutate({
      campaignId: selectedCampaign.id,
      companyIds: [...selectedCompanyIds],
    });
  }

  function startNewCampaign() {
    createMutation.reset();
    setCampaignInput(initialCampaignInput());
    setPendingAudienceError("");
    setCompanySelectionError("");
    setManualCreateOpen(true);
  }

  function closeCampaignSetup() {
    setManualCreateOpen(false);
    setPendingAudienceError("");
    setCompanySelectionError("");
    try {
      window.sessionStorage.removeItem(PENDING_CAMPAIGN_AUDIENCE_KEY);
    } catch (error) {
      console.error("Could not clear the selected campaign audience.", error);
    }
    if (shouldCreateFromQuery) {
      router.replace("/campaigns", { scroll: false });
    }
  }

  const anyLifecyclePending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    deleteMutation.isPending;
  const selectedTemplateName = selectedCampaign
    ? (templateNames.get(selectedCampaign.template_id) ?? "Template unavailable")
    : "";
  const previewSkippedCompanies =
    previewState?.result.skipped_company_ids
      .map((companyId) => companies.find((company) => company.id === companyId))
      .filter((company) => company !== undefined) ?? [];

  return (
    <div className="campaigns-page">
      <header className="campaigns-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE / OUTREACH</p>
          <h1>{createOpen && isAdmin ? "Create campaign" : "Drip campaigns"}</h1>
          <p className="heading-copy">
            {createOpen && isAdmin
              ? "Build a reusable sending plan. Choose the audience and review the schedule after saving."
              : "Manage your email sequences, delivery progress, and sender health in one place."}
          </p>
        </div>
        {isAdmin && !createOpen && (
          <button
            className="button button-primary campaign-create-action"
            onClick={startNewCampaign}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            New campaign
          </button>
        )}
      </header>

      {sessionQuery.isError && (
        <div className="campaign-alert campaign-alert-error" role="alert">
          Could not load your workspace: {getErrorMessage(sessionQuery.error)}
        </div>
      )}
      {liveMutationError && (
        <div className="campaign-alert campaign-alert-error" role="alert">
          {getErrorMessage(liveMutationError)}
        </div>
      )}

      {createOpen && isAdmin && (
        <section
          aria-labelledby="campaign-create-title"
          className="panel campaign-create-panel"
        >
          <div className="campaign-section-heading">
            <div>
              <p className="eyebrow">NEW CAMPAIGN</p>
              <h2 id="campaign-create-title">Campaign setup</h2>
              <p className="panel-subtitle">
                Choose an existing template and the Gmail accounts assigned to
                you.{" "}
                {shouldCreateFromQuery
                  ? "Leads selected from the Lead pipeline will be preselected after saving."
                  : "You can pick companies and preview delivery after saving."}
              </p>
            </div>
            <button
              aria-label="Close campaign setup"
              className="campaign-close-button"
              onClick={closeCampaignSetup}
              type="button"
            >
              ×
            </button>
          </div>

          {pendingAudienceError && (
            <div className="campaign-alert campaign-alert-error" role="alert">
              {pendingAudienceError}
            </div>
          )}

          <form className="campaign-form" onSubmit={submitCampaign}>
            <div className="campaign-form-section-title campaign-field-wide">
              <h3>Campaign details</h3>
              <p>Choose a name and the email template for the first message.</p>
            </div>
            <label className="campaign-field campaign-field-wide">
              Campaign name
              <input
                autoComplete="off"
                maxLength={200}
                onChange={(event) =>
                  updateCampaignInput("name", event.target.value)
                }
                placeholder="e.g. Q4 manufacturing outreach"
                required
                value={campaignInput.name}
              />
            </label>

            <label className="campaign-field campaign-field-wide">
              Email template
              <select
                onChange={(event) =>
                  updateCampaignInput("template_id", event.target.value)
                }
                required
                value={campaignInput.template_id}
              >
                <option value="">Choose a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {templatesQuery.isPending && (
                <span className="campaign-field-hint">Loading templates…</span>
              )}
              {templatesQuery.isError && (
                <span className="campaign-field-error" role="alert">
                  Could not load templates:{" "}
                  {getErrorMessage(templatesQuery.error)}
                </span>
              )}
              {templates.length === 0 && templatesQuery.isSuccess && (
                <span className="campaign-field-hint">
                  <Link href="/templates">Create an email template</Link> before
                  setting up a campaign.
                </span>
              )}
            </label>

            <fieldset className="campaign-sequence-field campaign-field-wide">
              <legend>Follow-up sequence</legend>
              <p className="campaign-field-hint">
                Each step uses its selected template after the configured wait.
                Replies and hard bounces stop the remaining steps.
              </p>
              {campaignInput.follow_up_steps.length === 0 && (
                <div className="campaign-follow-up-empty">
                  <strong>No follow-ups added</strong>
                  <span>
                    This campaign will send one email. Add a step to schedule
                    another message if there is no reply.
                  </span>
                </div>
              )}
              {campaignInput.follow_up_steps.map((step, index) => (
                <div className="campaign-follow-up-row" key={index}>
                  <label className="campaign-field">
                    Step {index + 2} template
                    <select
                      onChange={(event) =>
                        updateFollowUpStep(index, {
                          template_id: event.target.value,
                        })
                      }
                      required
                      value={step.template_id}
                    >
                      <option value="">Choose a template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campaign-field">
                    Wait after previous step (days)
                    <input
                      max={365}
                      min={1}
                      onChange={(event) =>
                        updateFollowUpStep(index, {
                          delay_days: Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={step.delay_days}
                    />
                  </label>
                  <button
                    aria-label={`Remove follow-up step ${index + 2}`}
                    className="button button-secondary campaign-remove-step"
                    onClick={() => removeFollowUpStep(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="text-button campaign-add-step"
                disabled={campaignInput.follow_up_steps.length >= 10}
                onClick={addFollowUpStep}
                type="button"
              >
                Add follow-up step
              </button>
            </fieldset>

            <div className="campaign-form-section-title campaign-field-wide">
              <h3>Sender setup</h3>
              <p>Verify recipient mail routing and choose the sending accounts.</p>
            </div>
            <label className="campaign-verification-choice campaign-field-wide">
              <input
                checked={campaignInput.verify_mx}
                onChange={(event) =>
                  updateCampaignInput("verify_mx", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <strong>Verify recipient mail routing before sending</strong>
                <small>
                  Checks DNS MX records (with the standard A/AAAA fallback).
                  Unverifiable addresses are not sent.
                </small>
              </span>
            </label>

            <fieldset className="campaign-account-field campaign-field-wide">
              <legend>Assigned Gmail accounts</legend>
              <p className="campaign-field-hint">
                Recipients rotate across selected accounts in the order shown.
              </p>
              {accountsQuery.isPending && (
                <p className="campaign-field-hint" role="status">
                  Loading assigned accounts…
                </p>
              )}
              {accountsQuery.isError && (
                <p className="campaign-field-error" role="alert">
                  Could not load Gmail accounts:{" "}
                  {getErrorMessage(accountsQuery.error)}
                </p>
              )}
              {accounts.length > 0 ? (
                <div className="campaign-account-options">
                  {accounts.map((account) => (
                    <label className="campaign-choice" key={account.id}>
                      <input
                        checked={campaignInput.gmail_account_ids.includes(
                          account.id,
                        )}
                        onChange={() => toggleAccount(account.id)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{account.email_address}</strong>
                        <small>Assigned to your account</small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                accountsQuery.isSuccess && (
                  <p className="campaign-field-hint">
                    No Gmail accounts are assigned to you. Ask an admin to
                    assign an account in <Link href="/settings">Settings</Link>.
                  </p>
                )
              )}
              {campaignInput.gmail_account_ids.length === 0 && (
                <span className="campaign-field-error">
                  Select at least one assigned Gmail account.
                </span>
              )}
            </fieldset>

            <div className="campaign-form-section-title campaign-field-wide">
              <h3>Delivery settings</h3>
              <p>Set account limits, message pacing, and the sending window.</p>
            </div>
            <label className="campaign-field">
              Daily limit per account
              <input
                max={1000}
                min={1}
                onChange={(event) =>
                  updateCampaignInput(
                    "daily_limit_per_account",
                    Number(event.target.value),
                  )
                }
                required
                type="number"
                value={campaignInput.daily_limit_per_account}
              />
            </label>
            <label className="campaign-field">
              Timezone (IANA)
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateCampaignInput("timezone", event.target.value)
                }
                placeholder="America/Chicago"
                required
                value={campaignInput.timezone}
              />
            </label>
            <label className="campaign-field">
              Minimum delay (seconds)
              <input
                max={86_400}
                min={1}
                onChange={(event) =>
                  updateCampaignInput(
                    "min_delay_seconds",
                    Number(event.target.value),
                  )
                }
                required
                type="number"
                value={campaignInput.min_delay_seconds}
              />
            </label>
            <label className="campaign-field">
              Maximum delay (seconds)
              <input
                max={86_400}
                min={1}
                onChange={(event) =>
                  updateCampaignInput(
                    "max_delay_seconds",
                    Number(event.target.value),
                  )
                }
                required
                type="number"
                value={campaignInput.max_delay_seconds}
              />
            </label>
            <label className="campaign-field">
              Send window starts
              <select
                onChange={(event) =>
                  updateCampaignInput(
                    "send_window_start_hour",
                    Number(event.target.value),
                  )
                }
                value={campaignInput.send_window_start_hour}
              >
                {Array.from({ length: 23 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </label>
            <label className="campaign-field">
              Send window ends
              <select
                onChange={(event) =>
                  updateCampaignInput(
                    "send_window_end_hour",
                    Number(event.target.value),
                  )
                }
                value={campaignInput.send_window_end_hour}
              >
                {Array.from({ length: 23 }, (_, index) => index + 1).map(
                  (hour) => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ),
                )}
              </select>
            </label>
            {campaignInput.min_delay_seconds >
              campaignInput.max_delay_seconds && (
              <p className="campaign-field-error campaign-field-wide" role="alert">
                Minimum delay cannot exceed maximum delay.
              </p>
            )}
            {campaignInput.send_window_start_hour >=
              campaignInput.send_window_end_hour && (
              <p className="campaign-field-error campaign-field-wide" role="alert">
                The send window must end after it starts.
              </p>
            )}

            {createMutation.isError && (
              <p className="campaign-field-error campaign-field-wide" role="alert">
                Could not create campaign:{" "}
                {getErrorMessage(createMutation.error)}
              </p>
            )}
            <div className="campaign-form-actions campaign-field-wide">
              <button
                className="button button-secondary"
                onClick={closeCampaignSetup}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={
                  createMutation.isPending ||
                  Boolean(pendingAudienceError) ||
                  campaignInput.gmail_account_ids.length === 0 ||
                  campaignInput.min_delay_seconds >
                    campaignInput.max_delay_seconds ||
                  campaignInput.send_window_start_hour >=
                    campaignInput.send_window_end_hour
                }
                type="submit"
              >
                {createMutation.isPending ? "Saving draft…" : "Save draft"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!createOpen && (
        <div className="campaign-dashboard">
          <section
            aria-label="Campaign library"
            className="panel campaign-library"
          >
          <div className="campaign-library-heading">
            <div>
              <p className="eyebrow">OUTREACH</p>
              <h2>Your campaigns</h2>
            </div>
            <div
              className={`campaign-live-indicator${eventStreamConnected ? " is-connected" : ""}`}
              role="status"
            >
              <span />
              {eventStreamConnected ? "Live updates" : "Auto-refresh"}
            </div>
          </div>
          {campaignsQuery.isPending && (
            <p className="campaign-empty-state" role="status">
              Loading campaigns…
            </p>
          )}
          {campaignsQuery.isError && (
            <div className="campaign-empty-state campaign-error-state" role="alert">
              <strong>Could not load campaigns.</strong>
              <span>{getErrorMessage(campaignsQuery.error)}</span>
              <button
                className="button button-secondary"
                onClick={() => void campaignsQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          )}
          {campaignsQuery.isSuccess && campaigns.length === 0 && (
            <div className="campaign-empty-state">
              <span aria-hidden="true" className="campaign-empty-icon">
                ↗
              </span>
              <strong>No campaigns yet</strong>
              <span>
                {isAdmin
                  ? "Create a campaign to schedule your first outreach."
                  : "An organization admin can create and launch campaigns."}
              </span>
              {isAdmin && (
                <button
                  className="button button-secondary"
                  onClick={startNewCampaign}
                  type="button"
                >
                  Create campaign
                </button>
              )}
            </div>
          )}
          {campaigns.length > 0 && (
            <div className="campaign-list">
              {campaigns.map((campaign) => (
                <CampaignListItem
                  active={campaign.id === activeCampaignId}
                  campaign={campaign}
                  key={campaign.id}
                  onSelect={() => selectCampaign(campaign.id)}
                  templateName={
                    templateNames.get(campaign.template_id) ?? "Email template"
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Selected campaign details"
          className="panel campaign-detail"
        >
          {campaignDetailQuery.isPending && activeCampaignId && (
            <p className="campaign-empty-state" role="status">
              Loading campaign details…
            </p>
          )}
          {campaignDetailQuery.isError && (
            <div className="campaign-empty-state campaign-error-state" role="alert">
              <strong>Could not load campaign details.</strong>
              <span>{getErrorMessage(campaignDetailQuery.error)}</span>
              <button
                className="button button-secondary"
                onClick={() => void campaignDetailQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          )}
          {!selectedCampaign && !campaignDetailQuery.isPending && (
            <div className="campaign-empty-state">
              <span aria-hidden="true" className="campaign-empty-icon">
                ◷
              </span>
              <strong>Select a campaign</strong>
              <span>Campaign settings and delivery progress will appear here.</span>
            </div>
          )}
          {selectedCampaign && (
            <>
              <div className="campaign-detail-heading">
                <div>
                  <p className="eyebrow">CAMPAIGN DETAILS</p>
                  <h2>{selectedCampaign.name}</h2>
                  {selectedTemplateName !== selectedCampaign.name && (
                    <p className="campaign-template-name">
                      {selectedTemplateName}
                    </p>
                  )}
                </div>
                <div className="campaign-heading-actions">
                  <span
                    className={`campaign-status campaign-status-${selectedCampaign.status}`}
                  >
                    {formatStatus(selectedCampaign.status)}
                  </span>
                  {selectedCampaign.status === "running" && isAdmin && (
                    <button
                      className="button button-secondary"
                      disabled={anyLifecyclePending}
                      onClick={() => pauseMutation.mutate(selectedCampaign.id)}
                      type="button"
                    >
                      {pauseMutation.isPending ? "Pausing…" : "Pause"}
                    </button>
                  )}
                  {selectedCampaign.status === "paused" && isAdmin && (
                    <button
                      className="button button-primary"
                      disabled={anyLifecyclePending}
                      onClick={() => resumeMutation.mutate(selectedCampaign.id)}
                      type="button"
                    >
                      {resumeMutation.isPending ? "Resuming…" : "Resume"}
                    </button>
                  )}
                </div>
              </div>

              <div aria-label="Campaign sending summary" className="campaign-summary-strip">
                <CampaignMeta
                  label="Sequence"
                  value={`${selectedCampaign.follow_up_steps.length + 1}-step sequence`}
                />
                <CampaignMeta
                  label="Sender accounts"
                  value={`${selectedCampaign.gmail_account_ids.length} Gmail ${selectedCampaign.gmail_account_ids.length === 1 ? "account" : "accounts"}`}
                />
                <CampaignMeta
                  label="Recipient check"
                  value={selectedCampaign.verify_mx ? "DNS verification on" : "DNS verification off"}
                />
              </div>

              <details className="campaign-settings-disclosure">
                <summary>
                  <strong>Delivery settings</strong>
                  <span>Daily limit, send window, and timezone</span>
                </summary>
                <div className="campaign-meta-grid">
                <CampaignMeta
                  label="Daily limit"
                  value={`${selectedCampaign.daily_limit_per_account} / account`}
                />
                <CampaignMeta
                  label="Send window"
                  value={`${formatHour(selectedCampaign.send_window_start_hour)}–${formatHour(selectedCampaign.send_window_end_hour)}`}
                />
                <CampaignMeta
                  label="Timezone"
                  value={selectedCampaign.timezone}
                />
                </div>
              </details>

              <div aria-label="Recipient delivery counts" className="campaign-counts">
                <CampaignCount
                  label="Messages sent"
                  value={selectedCampaign.recipient_counts.sent_messages}
                  tone="success"
                />
                <CampaignCount
                  label="Pending"
                  value={selectedCampaign.recipient_counts.pending}
                />
                <CampaignCount
                  label="Replied"
                  value={selectedCampaign.recipient_counts.replied}
                  tone="success"
                />
                <CampaignCount
                  label="Bounced"
                  value={selectedCampaign.recipient_counts.bounced}
                  tone="error"
                />
              </div>
              <details className="campaign-outcomes-disclosure">
                <summary>
                  <strong>More recipient outcomes</strong>
                  <span>Processing, sent, failed, unverified, cancelled</span>
                </summary>
                <div className="campaign-counts">
                  <CampaignCount
                    label="Processing"
                    value={selectedCampaign.recipient_counts.processing}
                  />
                  <CampaignCount
                    label="Recipients sent"
                    value={selectedCampaign.recipient_counts.sent}
                    tone="success"
                  />
                  <CampaignCount
                    label="Failed"
                    value={selectedCampaign.recipient_counts.failed}
                    tone="error"
                  />
                  <CampaignCount
                    label="Unverified"
                    value={selectedCampaign.recipient_counts.unverified}
                    tone="error"
                  />
                  <CampaignCount
                    label="Cancelled"
                    value={selectedCampaign.recipient_counts.cancelled}
                  />
                </div>
              </details>

              <details aria-label="Sending account health" className="campaign-health">
                <summary className="campaign-health-summary">
                  <span>
                    <strong>Sending account health</strong>
                    <small>Recent activity for {selectedCampaign.gmail_account_ids.length} selected Gmail accounts</small>
                  </span>
                  <span aria-hidden="true" className="campaign-disclosure-icon" />
                </summary>
                <div className="campaign-health-content">
                  {accountHealthQuery.isPending && (
                    <p className="campaign-field-hint" role="status">
                      Loading account health…
                    </p>
                  )}
                  {accountHealthQuery.isError && (
                    <p className="campaign-field-error" role="alert">
                      Could not load account health:{" "}
                      {getErrorMessage(accountHealthQuery.error)}
                    </p>
                  )}
                  {accountHealthQuery.data
                    ?.filter((account) =>
                      selectedCampaign.gmail_account_ids.includes(account.id),
                    )
                    .map((account) => (
                      <div className="campaign-health-row" key={account.id}>
                        <div className="campaign-health-heading">
                          <strong>{account.email_address}</strong>
                          <span
                            className={
                              account.last_monitor_error
                                ? "campaign-health-state is-error"
                                : "campaign-health-state"
                            }
                          >
                            {account.last_monitor_error
                              ? "Needs attention"
                              : account.last_monitor_at
                                ? "Monitoring active"
                                : "Waiting for first check"}
                          </span>
                        </div>
                        <span className="campaign-health-last-check">
                          {account.last_monitor_at
                            ? `Last checked ${formatDateTime(account.last_monitor_at)}`
                            : "No Gmail activity check has completed yet."}
                        </span>
                        <div className="campaign-health-metrics">
                          <span>{account.sent_30d} sent</span>
                          <span>{account.replies_30d} replies</span>
                          <span>{account.bounces_30d} bounces</span>
                          <span>{account.unverified_30d} unverified</span>
                          <span>{account.failures_30d} failed</span>
                        </div>
                        {account.last_monitor_error && (
                          <p className="campaign-field-error" role="status">
                            {account.last_monitor_error}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </details>

              {selectedCampaign.status === "draft" && isAdmin && (
                <section className="campaign-audience">
                  <div className="campaign-section-heading">
                    <div>
                      <p className="eyebrow">AUDIENCE</p>
                      <h3>Choose companies</h3>
                      <p className="panel-subtitle">
                        All contacts with a valid business email are queued.
                        Contacts without an email are skipped.
                      </p>
                    </div>
                    <span className="campaign-selection-count">
                      {selectedCompanyIds.length} selected
                    </span>
                  </div>

                  {companiesQuery.isError && (
                    <p className="campaign-field-error" role="alert">
                      Could not load companies:{" "}
                      {getErrorMessage(companiesQuery.error)}
                    </p>
                  )}
                  {companiesQuery.isPending && (
                    <p className="campaign-field-hint" role="status">
                      Loading companies…
                    </p>
                  )}
                  {companiesQuery.isSuccess && companies.length === 0 && (
                    <p className="campaign-field-hint">
                      Add companies and contacts before creating a campaign.
                    </p>
                  )}
                  {companies.length > 0 && (
                    <>
                      <div className="campaign-company-tools">
                        <label className="campaign-search">
                          <span className="sr-only">Search companies</span>
                          <span aria-hidden="true">⌕</span>
                          <input
                            onChange={(event) =>
                              setCompanySearch(event.target.value)
                            }
                            placeholder="Search companies or domains"
                            value={companySearch}
                          />
                        </label>
                        <button
                          className="text-button"
                          onClick={toggleVisibleCompanies}
                          type="button"
                        >
                          {filteredCompanies.length > 0 &&
                          filteredCompanies.every((company) =>
                            selectedCompanyIds.includes(company.id),
                          )
                            ? "Clear visible"
                            : "Select visible"}
                        </button>
                      </div>
                      <div
                        aria-label="Companies to include"
                        className="campaign-company-list"
                      >
                        {filteredCompanies.map((company) => {
                          const validEmailCount = company.contacts.filter(
                            (contact) =>
                              Boolean(contact.business_email?.trim()),
                          ).length;
                          return (
                            <label
                              className="campaign-company-option"
                              key={company.id}
                            >
                              <input
                                checked={selectedCompanyIds.includes(
                                  company.id,
                                )}
                                onChange={() => toggleCompany(company.id)}
                                type="checkbox"
                              />
                              <span className="campaign-company-copy">
                                <strong>{company.name}</strong>
                                <small>
                                  {company.domain ?? company.website ?? "No domain"}
                                </small>
                              </span>
                              <span
                                className={`campaign-contact-count${validEmailCount === 0 ? " is-empty" : ""}`}
                              >
                                {validEmailCount} email
                                {validEmailCount === 1 ? "" : "s"}
                              </span>
                            </label>
                          );
                        })}
                        {filteredCompanies.length === 0 && (
                          <p className="campaign-field-hint">
                            No companies match that search.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {companySelectionError && (
                    <p className="campaign-field-error" role="alert">
                      {companySelectionError}
                    </p>
                  )}
                  {previewMutation.isError && (
                    <p className="campaign-field-error" role="alert">
                      Could not preview the audience:{" "}
                      {getErrorMessage(previewMutation.error)}
                    </p>
                  )}

                  <div className="campaign-audience-actions">
                    <button
                      className="button button-secondary"
                      disabled={
                        selectedCompanyIds.length === 0 ||
                        previewMutation.isPending ||
                        companiesQuery.isError
                      }
                      onClick={requestPreview}
                      type="button"
                    >
                      {previewMutation.isPending
                        ? "Calculating…"
                        : "Preview schedule"}
                    </button>
                    {previewMatchesSelection && previewState && (
                      <button
                        className="button button-primary"
                        disabled={
                          startMutation.isPending ||
                          previewState.result.eligible_contact_count === 0
                        }
                        onClick={requestStart}
                        type="button"
                      >
                        {startMutation.isPending
                          ? "Starting…"
                          : "Start campaign"}
                      </button>
                    )}
                  </div>

                  {previewMatchesSelection && previewState && (
                    <div className="campaign-preview-card">
                      <div className="campaign-preview-heading">
                        <div>
                          <strong>Ready to review</strong>
                          <span>
                            Estimated completion{" "}
                            {formatDateTime(
                              previewState.result.estimated_completion_at,
                              selectedCampaign.timezone,
                            )}
                          </span>
                        </div>
                        <span className="campaign-preview-capacity">
                          {previewState.result.daily_capacity_per_day} emails/day
                        </span>
                      </div>
                      <div className="campaign-preview-stats">
                        <CampaignCount
                          label="Eligible contacts"
                          value={previewState.result.eligible_contact_count}
                        />
                        <CampaignCount
                          label="Companies skipped"
                          value={
                            previewState.result.skipped_companies_without_email
                          }
                        />
                        <CampaignCount
                          label="Suppressed contacts"
                          value={
                            previewState.result.skipped_suppressed_contacts
                          }
                        />
                      </div>
                      {previewSkippedCompanies.length > 0 && (
                        <div className="campaign-skipped-list">
                          <strong>Companies without an email contact</strong>
                          <span>
                            {previewSkippedCompanies
                              .map((company) => company.name)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      {previewState.result.eligible_contact_count === 0 && (
                        <p className="campaign-field-error" role="alert">
                          {previewState.result.skipped_suppressed_contacts > 0
                            ? "No eligible contacts were found. Suppressed addresses are excluded to honor opt-outs and do-not-contact requests."
                            : "No eligible contacts were found. Add business emails before starting this campaign."}
                        </p>
                      )}
                    </div>
                  )}
                  {startMutation.isError && (
                    <p className="campaign-field-error" role="alert">
                      Could not start campaign:{" "}
                      {getErrorMessage(startMutation.error)}
                    </p>
                  )}
                </section>
              )}

              {selectedCampaign.status === "draft" && !isAdmin && (
                <p className="campaign-admin-hint">
                  An organization admin can choose the audience and launch this
                  campaign.
                </p>
              )}

              <div className="campaign-detail-footer">
                <span>
                  Created {formatDateTime(selectedCampaign.created_at)}
                </span>
                <div className="campaign-actions">
                  {(selectedCampaign.status === "draft" ||
                    selectedCampaign.status === "paused") &&
                    isAdmin && (
                      <button
                        className="button button-danger"
                        disabled={anyLifecyclePending}
                        onClick={() =>
                          setConfirmDeleteCampaignId(selectedCampaign.id)
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    )}
                </div>
              </div>
              {confirmDeleteCampaignId === selectedCampaign.id && (
                <div className="campaign-delete-confirm" role="alert">
                  <span>
                    Delete this {selectedCampaign.status} campaign? This cannot
                    be undone.
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={deleteMutation.isPending}
                    onClick={() => setConfirmDeleteCampaignId(null)}
                    type="button"
                  >
                    Keep campaign
                  </button>
                  <button
                    className="button button-danger"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      deleteMutation.mutate(selectedCampaign.id)
                    }
                    type="button"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              )}
            </>
          )}
          </section>
        </div>
      )}
    </div>
  );
}

function CampaignListItem({
  active,
  campaign,
  onSelect,
  templateName,
}: {
  active: boolean;
  campaign: EmailCampaign;
  onSelect: () => void;
  templateName: string;
}) {
  return (
    <button
      aria-pressed={active}
      className={`campaign-list-item${active ? " is-active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="campaign-list-top">
        <span className={`campaign-status campaign-status-${campaign.status}`}>
          {formatStatus(campaign.status)}
        </span>
        <span className="campaign-list-date">
          {formatDateTime(campaign.updated_at)}
        </span>
      </span>
      <strong className="campaign-list-name">{campaign.name}</strong>
      {templateName !== campaign.name && (
        <span className="campaign-list-template">{templateName}</span>
      )}
      <span className="campaign-list-counts">
        <span>{campaign.recipient_counts.sent_messages} messages sent</span>
        <span>{campaign.recipient_counts.replied} replies</span>
        <span>{campaign.recipient_counts.bounced} bounces</span>
      </span>
    </button>
  );
}

function CampaignMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="campaign-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CampaignCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "error";
}) {
  return (
    <div className={`campaign-count${tone ? ` tone-${tone}` : ""}`}>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatStatus(status: EmailCampaign["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatDateTime(
  value: string | null,
  timezone?: string,
): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
