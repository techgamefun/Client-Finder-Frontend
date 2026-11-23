"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { useToast } from "./toast-provider";
import {
  createCompany,
  createLeadBatch,
  deleteCompany,
  getAuthSession,
  getCompanyPipeline,
  getCompanyPipelineSelection,
  getLeadBatches,
  getQueueEventsWebSocketUrl,
  PENDING_CAMPAIGN_AUDIENCE_KEY,
  updateLeadBatch,
  updateLeadBatchMembers,
  updateCompany,
  updateLeadStatus,
} from "@/lib/api";
import type {
  Company,
  CompanyInput,
  CompanyPipelineFilters,
  CompanyUpdateInput,
  LeadBatchMembershipAction,
} from "@/lib/api";
import { CompanyName } from "./overview-page";
import { TableLoading } from "./page-loading";

const noCompanies: Company[] = [];
const maxCampaignCompanies = 5_000;
const leadStatuses = [
  "new",
  "needs_review",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
];
const pageSizes = [10, 25, 50] as const;
const pipelineQueryChangedEvent = "lead-pipeline-query-change";
const emptyCompany: CompanyInput = {
  name: "",
  website: "",
  domain: "",
  industry: "",
  city: "",
  state: "",
  software_need: "",
};

function isPageSize(value: number): value is (typeof pageSizes)[number] {
  return value === 10 || value === 25 || value === 50;
}

function subscribeToPipelineQuery(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(pipelineQueryChangedEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(pipelineQueryChangedEvent, onChange);
  };
}

function getPipelineSearchSnapshot() {
  return window.location.search;
}

function getServerPipelineSearchSnapshot() {
  return "";
}

function updatePipelineQuery(updates: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(pipelineQueryChangedEvent));
}

export function LeadsPage({
  view = "leads",
}: {
  view?: "companies" | "leads";
}) {
  const isCompanyDatabaseView = view === "companies";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenAddCompany =
    isCompanyDatabaseView && searchParams.get("add") === "1";
  const pipelineSearch = useSyncExternalStore(
    subscribeToPipelineQuery,
    getPipelineSearchSnapshot,
    getServerPipelineSearchSnapshot,
  );
  const pipelineParams = new URLSearchParams(pipelineSearch);
  const companyFilter = pipelineParams.get("q") ?? "";
  const requestedStatus = pipelineParams.get("status");
  const statusFilter =
    requestedStatus && leadStatuses.includes(requestedStatus)
      ? requestedStatus
      : "all";
  const requestedBatch = pipelineParams.get("batch");
  const batchFilter =
    requestedBatch && requestedBatch !== "ungrouped"
      ? requestedBatch
      : "all";
  const ungroupedFilter = requestedBatch === "ungrouped";
  const requestedEmailStatus = pipelineParams.get("email_status");
  const emailStatusFilter =
    requestedEmailStatus === "contacted" ||
    requestedEmailStatus === "not_contacted"
      ? requestedEmailStatus
      : "all";
  const requestedWebsite = pipelineParams.get("website");
  const websiteFilter =
    requestedWebsite === "with_website" ||
    requestedWebsite === "without_website"
      ? requestedWebsite
      : "all";
  const requestedPage = Number(pipelineParams.get("page"));
  const currentPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const requestedPageSize = Number(pipelineParams.get("pageSize"));
  const pageSize = isPageSize(requestedPageSize)
    ? requestedPageSize
    : 10;
  const [debouncedCompanyFilter, setDebouncedCompanyFilter] =
    useState(companyFilter);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCompanyFilter(companyFilter),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [companyFilter]);
  const companyPipelineFilters: CompanyPipelineFilters = {
    view: isCompanyDatabaseView ? "companies" : "leads",
    query: debouncedCompanyFilter,
    status: statusFilter === "all" ? null : statusFilter,
    email_status: emailStatusFilter,
    website: websiteFilter,
    batch_id: isCompanyDatabaseView || batchFilter === "all" ? null : batchFilter,
    ungrouped: !isCompanyDatabaseView && ungroupedFilter,
    page: currentPage,
    page_size: pageSize,
  };
  const [companyForm, setCompanyForm] = useState<CompanyInput>(emptyCompany);
  const addCompanyDialogRef = useRef<HTMLDialogElement>(null);
  const leadBatchDialogRef = useRef<HTMLDialogElement>(null);
  const leadActionsMenuRef = useRef<HTMLDetailsElement>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CompanyUpdateInput>({});
  const [newLeadBatchName, setNewLeadBatchName] = useState("");
  const [targetLeadBatchId, setTargetLeadBatchId] = useState("");

  useEffect(() => {
    if (!shouldOpenAddCompany) return;
    const dialog = addCompanyDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    router.replace("/companies", { scroll: false });
  }, [router, shouldOpenAddCompany]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedLeadCompanyIds, setSelectedLeadCompanyIds] = useState<
    string[]
  >([]);
  const [campaignAudienceError, setCampaignAudienceError] = useState("");
  const companiesQuery = useQuery({
    queryKey: ["companies", "pipeline", companyPipelineFilters],
    queryFn: () => getCompanyPipeline(companyPipelineFilters),
  });
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    enabled: !isCompanyDatabaseView,
    retry: false,
  });
  const leadBatchesQuery = useQuery({
    queryKey: ["companies", "lead-batches"],
    queryFn: getLeadBatches,
    enabled: !isCompanyDatabaseView,
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setCompanyForm(emptyCompany);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      companyId,
      input,
    }: {
      companyId: string;
      input: CompanyUpdateInput;
    }) => updateCompany(companyId, input),
    onSuccess: async (updatedCompany) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setEditingCompanyId(null);
      showToast({
        type: "success",
        title: "Company updated",
        message: `${updatedCompany.name} changes were saved.`,
      });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({
      companyId,
      leadStatus,
    }: {
      companyId: string;
      leadStatus: string;
    }) => updateLeadStatus(companyId, leadStatus),
    onSuccess: async (updatedCompany) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      showToast({
        type: "success",
        title: "Lead status updated",
        message: `${updatedCompany.name} is now marked ${updatedCompany.lead_status.replaceAll("_", " ")}.`,
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setConfirmDeleteId(null);
      setExpandedCompanyId(null);
      showToast({
        type: "success",
        title: "Company deleted",
        message: "The company was removed from your pipeline.",
      });
    },
  });
  const createLeadBatchMutation = useMutation({
    mutationFn: createLeadBatch,
    onSuccess: async (batch) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setTargetLeadBatchId(batch.id);
      setNewLeadBatchName("");
      leadBatchDialogRef.current?.close();
      showToast({
        type: "success",
        title: "Group created",
        message: `${batch.name} is ready to organize leads.`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not create group",
        message: error.message,
      });
    },
  });
  const updateLeadBatchMutation = useMutation({
    mutationFn: ({
      batchId,
      name,
    }: {
      batchId: string;
      name: string;
    }) => updateLeadBatch(batchId, name),
    onSuccess: async (batch) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      showToast({
        type: "success",
        title: "Group renamed",
        message: `The group is now named ${batch.name}.`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not rename group",
        message: error.message,
      });
    },
  });
  const leadBatchMembershipMutation = useMutation({
    mutationFn: updateLeadBatchMembers,
    onSuccess: async ({ updated_count: updatedCount }, variables) => {
      leadActionsMenuRef.current?.removeAttribute("open");
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      showToast({
        type: "success",
        title: "Lead groups updated",
        message:
          updatedCount === 0
            ? "Those leads already have the requested group membership."
            : `${updatedCount.toLocaleString()} lead${updatedCount === 1 ? "" : "s"} ${variables.action === "ungroup" ? "ungrouped" : variables.action === "move" ? "moved" : "added to the group"}.`,
      });
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not update lead groups",
        message: error.message,
      });
    },
  });
  const filteredSelectionMutation = useMutation({
    mutationFn: () =>
      getCompanyPipelineSelection({
        view: "leads",
        query: debouncedCompanyFilter,
        status: statusFilter === "all" ? null : statusFilter,
        email_status: emailStatusFilter,
        website: websiteFilter,
        batch_id: batchFilter === "all" ? null : batchFilter,
        ungrouped: ungroupedFilter,
      }),
    onSuccess: (selection) => {
      setCampaignAudienceError("");
      if (selection.total_count > maxCampaignCompanies) {
        setCampaignAudienceError(
          `Select no more than ${maxCampaignCompanies.toLocaleString()} companies for one campaign.`,
        );
        return;
      }
      const next = new Set([...selectedLeadCompanyIds, ...selection.company_ids]);
      if (next.size > maxCampaignCompanies) {
        setCampaignAudienceError(
          `Select no more than ${maxCampaignCompanies.toLocaleString()} companies for one campaign.`,
        );
        return;
      }
      setSelectedLeadCompanyIds([...next]);
    },
    onError: (error: Error) => {
      setCampaignAudienceError(
        `Could not select filtered leads: ${error.message}`,
      );
    },
  });

  useEffect(() => {
    if (isCompanyDatabaseView) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    function connect() {
      if (disposed) return;
      socket = new WebSocket(getQueueEventsWebSocketUrl());
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
          payload.kind === "email_campaign_recipient" &&
          "status" in payload &&
          payload.status === "sent"
        ) {
          void queryClient.invalidateQueries({ queryKey: ["companies"] });
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!disposed) reconnectTimer = window.setTimeout(connect, 5_000);
      };
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [isCompanyDatabaseView, queryClient]);

  const pipelineData = companiesQuery.data;
  const companies = pipelineData?.items ?? noCompanies;
  const filteredCount = pipelineData?.total_count ?? 0;
  const eligibleCount = pipelineData?.eligible_count ?? 0;
  const companyCount = pipelineData?.company_count ?? 0;
  const statusCounts = pipelineData?.status_counts ?? {};
  const websiteCount = pipelineData?.with_website_count ?? 0;
  const contactedCompanyCount = pipelineData?.contacted_count ?? 0;
  const pageCount = pipelineData?.page_count ?? 1;
  const visiblePage = pipelineData?.page ?? currentPage;
  const paginatedCompanies = companies;
  const selectedLeadCompanyIdSet = new Set(selectedLeadCompanyIds);
  const allPageLeadsSelected =
    paginatedCompanies.length > 0 &&
    paginatedCompanies.every((company) =>
      selectedLeadCompanyIdSet.has(company.id),
    );
  const isAdmin = sessionQuery.data?.user.role === "admin";
  const activeExtraFilterCount = [
    websiteFilter !== "all",
    !isCompanyDatabaseView && emailStatusFilter !== "all",
    !isCompanyDatabaseView &&
      (batchFilter !== "all" || ungroupedFilter),
  ].filter(Boolean).length;
  const emptyStateTitle =
    eligibleCount > 0
      ? isCompanyDatabaseView
        ? "No companies match your filters"
        : "No leads match your filters"
      : isCompanyDatabaseView
        ? "Your company database is empty"
        : companyCount > 0
          ? "No leads yet"
          : "No companies yet";
  const emptyStateDescription =
    eligibleCount > 0
      ? "Try a different search term or filter."
      : isCompanyDatabaseView
        ? "Discover companies or add one manually to build your database."
        : companyCount > 0
          ? "Add a contact to a company in Companies. It will appear here automatically."
          : "Add or discover a company in Companies. Leads appear once a company has a contact.";

  useEffect(() => {
    if (!pipelineData || pipelineData.page === currentPage) return;
    updatePipelineQuery({
      page:
        pipelineData.page === 1 ? null : String(pipelineData.page),
    });
  }, [currentPage, pipelineData]);

  function toggleLeadSelection(companyId: string) {
    setCampaignAudienceError("");
    if (selectedLeadCompanyIdSet.has(companyId)) {
      setSelectedLeadCompanyIds((current) =>
        current.filter((id) => id !== companyId),
      );
      return;
    }
    if (selectedLeadCompanyIds.length >= maxCampaignCompanies) {
      setCampaignAudienceError(
        `A campaign can include at most ${maxCampaignCompanies.toLocaleString()} companies.`,
      );
      return;
    }
    setSelectedLeadCompanyIds((current) => [...current, companyId]);
  }

  function togglePageLeadSelection() {
    setCampaignAudienceError("");
    const pageIds = paginatedCompanies.map((company) => company.id);
    if (allPageLeadsSelected) {
      setSelectedLeadCompanyIds((current) =>
        current.filter((id) => !pageIds.includes(id)),
      );
      return;
    }

    const next = new Set([...selectedLeadCompanyIds, ...pageIds]);
    if (next.size > maxCampaignCompanies) {
      setCampaignAudienceError(
        `A campaign can include at most ${maxCampaignCompanies.toLocaleString()} companies.`,
      );
      return;
    }
    setSelectedLeadCompanyIds([...next]);
  }

  function selectFilteredLeads() {
    setCampaignAudienceError("");
    filteredSelectionMutation.mutate();
  }

  function clearLeadSelection() {
    setSelectedLeadCompanyIds([]);
    setCampaignAudienceError("");
  }

  function handleCreateLeadBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createLeadBatchMutation.mutate({
      name: newLeadBatchName.trim(),
      company_ids: selectedLeadCompanyIds,
    });
  }

  function handleRenameLeadBatch(
    event: FormEvent<HTMLFormElement>,
    batchId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    updateLeadBatchMutation.mutate({ batchId, name });
  }

  function updateSelectedLeadGroups(
    action: LeadBatchMembershipAction,
  ) {
    if (selectedLeadCompanyIds.length === 0) return;
    if (action !== "ungroup" && !targetLeadBatchId) return;
    leadBatchMembershipMutation.mutate({
      action,
      company_ids: selectedLeadCompanyIds,
      ...(action === "ungroup" ? {} : { batch_id: targetLeadBatchId }),
    });
  }

  function createCampaignFromLeads() {
    if (!isAdmin || selectedLeadCompanyIds.length === 0) return;
    try {
      window.sessionStorage.setItem(
        PENDING_CAMPAIGN_AUDIENCE_KEY,
        JSON.stringify(selectedLeadCompanyIds),
      );
    } catch (error) {
      console.error("Could not save the selected campaign audience.", error);
      setCampaignAudienceError(
        "Could not carry the selected leads into campaign setup. Please try again.",
      );
      return;
    }
    router.push("/campaigns?create=1");
  }

  function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      name: companyForm.name.trim(),
      website: cleanText(companyForm.website),
      domain: cleanText(companyForm.domain),
      industry: cleanText(companyForm.industry),
      city: cleanText(companyForm.city),
      state: cleanText(companyForm.state),
      software_need: cleanText(companyForm.software_need),
    });
  }

  function startEditing(company: Company) {
    setExpandedCompanyId(company.id);
    setEditingCompanyId(company.id);
    setConfirmDeleteId(null);
    setEditingForm({
      name: company.name,
      website: company.website,
      domain: company.domain,
      industry: company.industry,
      city: company.city,
      state: company.state,
      software_need: company.software_need,
      lead_score: company.lead_score,
    });
  }

  function handleUpdateCompany(
    event: FormEvent<HTMLFormElement>,
    companyId: string,
  ) {
    event.preventDefault();
    updateMutation.mutate({
      companyId,
      input: {
        ...editingForm,
        name: editingForm.name?.trim(),
        website: cleanText(editingForm.website),
        domain: cleanText(editingForm.domain),
        industry: cleanText(editingForm.industry),
        city: cleanText(editingForm.city),
        state: cleanText(editingForm.state),
        software_need: cleanText(editingForm.software_need),
      },
    });
  }

  function updateField<K extends keyof CompanyInput>(
    key: K,
    value: CompanyInput[K],
  ) {
    setCompanyForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditingField<K extends keyof CompanyUpdateInput>(
    key: K,
    value: CompanyUpdateInput[K],
  ) {
    setEditingForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section className="panel pipeline-panel leads-panel">
        <div className="leads-filter-section">
          <div className="leads-filter-heading">
            <div>
              <h1>{isCompanyDatabaseView ? "Companies" : "Lead pipeline"}</h1>
              <p className="heading-copy">
                {isCompanyDatabaseView
                  ? "Your complete company database, including companies without contacts."
                  : "Companies with at least one contact, ready for your pipeline."}
              </p>
            </div>
            {isCompanyDatabaseView ? null : (
              <Link className="button button-secondary" href="/companies">
                Manage companies <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <div>
            <div className="pipeline-tools leads-filter-controls">
              <label className="filter-input">
                <span aria-hidden="true">⌕</span>
                <span className="sr-only">
                  Search {isCompanyDatabaseView ? "companies" : "leads"}, domains, and URLs
                </span>
                <input
                  onChange={(event) =>
                    updatePipelineQuery({
                      q: event.target.value || null,
                      page: null,
                    })
                  }
                  placeholder={
                    isCompanyDatabaseView
                      ? "Search companies or domains"
                      : "Search leads or domains"
                  }
                  value={companyFilter}
                />
              </label>
              <label className="select-filter">
                <span className="sr-only">Filter by lead status</span>
                <select
                  onChange={(event) =>
                    updatePipelineQuery({
                      status:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                    })
                  }
                  value={statusFilter}
                >
                  <option value="all">All statuses ({eligibleCount})</option>
                  {leadStatuses.map((leadStatus) => {
                    const count = statusCounts[leadStatus] ?? 0;
                    return (
                      <option key={leadStatus} value={leadStatus}>
                        {leadStatus.replaceAll("_", " ")} ({count})
                      </option>
                    );
                  })}
                </select>
              </label>
              <details className="lead-extra-filters">
                <summary>
                  More filters
                  {activeExtraFilterCount > 0 && (
                    <span>{activeExtraFilterCount}</span>
                  )}
                </summary>
                <div className="lead-extra-filter-panel">
                  <label className="lead-extra-filter">
                    <span>Website</span>
                    <select
                      onChange={(event) =>
                        updatePipelineQuery({
                          website:
                            event.target.value === "all"
                              ? null
                              : event.target.value,
                          page: null,
                        })
                      }
                      value={websiteFilter}
                    >
                      <option value="all">Any website ({eligibleCount})</option>
                      <option value="with_website">
                        Has a website ({websiteCount})
                      </option>
                      <option value="without_website">
                        No website ({eligibleCount - websiteCount})
                      </option>
                    </select>
                  </label>
                  {!isCompanyDatabaseView && (
                    <label className="lead-extra-filter">
                      <span>Email outreach</span>
                      <select
                        onChange={(event) =>
                          updatePipelineQuery({
                            email_status:
                              event.target.value === "all"
                                ? null
                                : event.target.value,
                            page: null,
                          })
                        }
                        value={emailStatusFilter}
                      >
                        <option value="all">
                          Any outreach ({eligibleCount})
                        </option>
                        <option value="contacted">
                          Contacted ({contactedCompanyCount})
                        </option>
                        <option value="not_contacted">
                          Not contacted ({eligibleCount - contactedCompanyCount})
                        </option>
                      </select>
                    </label>
                  )}
                  {!isCompanyDatabaseView && (
                    <div className="lead-group-filter-field">
                      <label className="lead-extra-filter">
                        <span>Lead group</span>
                        <select
                          disabled={leadBatchesQuery.isLoading}
                          onChange={(event) =>
                            updatePipelineQuery({
                              batch:
                                event.target.value === "all"
                                  ? null
                                  : event.target.value,
                              page: null,
                            })
                          }
                          value={
                            ungroupedFilter ? "ungrouped" : batchFilter
                          }
                        >
                          <option value="all">Any group</option>
                          <option value="ungrouped">Ungrouped</option>
                          {(leadBatchesQuery.data?.items ?? []).map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.name} ({batch.lead_count})
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="text-button"
                        onClick={() => leadBatchDialogRef.current?.showModal()}
                        type="button"
                      >
                        Manage groups
                      </button>
                    </div>
                  )}
                </div>
              </details>
              <button
                aria-label={`Refresh ${isCompanyDatabaseView ? "companies" : "leads"}`}
                className="icon-button refresh-button"
                disabled={companiesQuery.isFetching}
                onClick={() => void companiesQuery.refetch()}
                type="button"
              >
                ↻
              </button>
            </div>
            {!isCompanyDatabaseView && leadBatchesQuery.isError && (
              <p className="settings-feedback settings-feedback-error" role="alert">
                Could not load lead groups: {leadBatchesQuery.error.message}
              </p>
            )}
            {!isCompanyDatabaseView && (
              <div
                aria-label="Lead selection actions"
                className={`lead-selection-toolbar${selectedLeadCompanyIds.length > 0 ? " has-selection" : ""}`}
              >
                {selectedLeadCompanyIds.length > 0 ? (
                  <>
                    <div className="lead-selection-summary">
                      <span className="lead-selection-count">
                        {selectedLeadCompanyIds.length.toLocaleString()}
                      </span>
                      <strong>
                        lead{selectedLeadCompanyIds.length === 1 ? "" : "s"} selected
                      </strong>
                    </div>
                    <div className="lead-selection-actions">
                      <button
                        className="lead-selection-select-all"
                        disabled={
                          filteredCount === 0 ||
                          filteredSelectionMutation.isPending
                        }
                        onClick={selectFilteredLeads}
                        type="button"
                      >
                        {filteredSelectionMutation.isPending
                          ? "Selecting..."
                          : `Select all ${filteredCount.toLocaleString()} matching`}
                      </button>
                      <details
                        className="lead-actions-menu"
                        ref={leadActionsMenuRef}
                      >
                        <summary>
                          Manage selected
                        </summary>
                        <div className="lead-actions-popover">
                          <section className="lead-action-section">
                            <div>
                              <h3>Lead group</h3>
                              <p>Add selected leads to a group, move them, or
                                ungroup them.</p>
                            </div>
                            <label className="lead-action-destination">
                              <span>Destination group</span>
                              <select
                                disabled={
                                  (leadBatchesQuery.data?.items.length ?? 0) === 0
                                }
                                onChange={(event) =>
                                  setTargetLeadBatchId(event.target.value)
                                }
                                value={targetLeadBatchId}
                              >
                                <option value="">Choose a group</option>
                                {(leadBatchesQuery.data?.items ?? []).map(
                                  (batch) => (
                                    <option key={batch.id} value={batch.id}>
                                      {batch.name}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <div className="lead-action-buttons">
                              <button
                                className="button button-secondary"
                                disabled={
                                  !targetLeadBatchId ||
                                  leadBatchMembershipMutation.isPending
                                }
                                onClick={() => updateSelectedLeadGroups("add")}
                                type="button"
                              >
                                Add to group
                              </button>
                              <button
                                className="button button-secondary"
                                disabled={
                                  !targetLeadBatchId ||
                                  leadBatchMembershipMutation.isPending
                                }
                                onClick={() => updateSelectedLeadGroups("move")}
                                type="button"
                              >
                                Move to group
                              </button>
                              <button
                                className="text-button"
                                disabled={
                                  leadBatchMembershipMutation.isPending
                                }
                                onClick={() =>
                                  updateSelectedLeadGroups("ungroup")
                                }
                                type="button"
                              >
                                Ungroup
                              </button>
                            </div>
                            {(leadBatchesQuery.data?.items.length ?? 0) === 0 && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  leadBatchDialogRef.current?.showModal()
                                }
                                type="button"
                              >
                                Create a group first
                              </button>
                            )}
                            <p className="lead-action-note">
                              Add keeps other groups; Move replaces them;
                              Ungroup removes all groups.
                            </p>
                          </section>
                          {sessionQuery.isPending ? (
                            <p className="lead-action-access">
                              Checking campaign access...
                            </p>
                          ) : isAdmin ? (
                            <section className="lead-action-section lead-action-campaign">
                              <div>
                                <h3>Campaign</h3>
                                <p>Use the selected leads in an email campaign.</p>
                              </div>
                              <button
                                className="button button-primary"
                                onClick={createCampaignFromLeads}
                                type="button"
                              >
                                Create campaign
                              </button>
                            </section>
                          ) : (
                            <p className="lead-action-access">
                              Campaign creation requires an admin.
                            </p>
                          )}
                        </div>
                      </details>
                      <button
                        className="text-button"
                        disabled={filteredSelectionMutation.isPending}
                        onClick={clearLeadSelection}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="lead-selection-idle">
                    <span>
                      {filteredCount.toLocaleString()} matching lead
                      {filteredCount === 1 ? "" : "s"}
                    </span>
                    <button
                      className="lead-selection-select-all"
                      disabled={
                        filteredCount === 0 ||
                        filteredSelectionMutation.isPending
                      }
                      onClick={selectFilteredLeads}
                      type="button"
                    >
                      {filteredSelectionMutation.isPending
                        ? "Selecting..."
                        : "Select all"}
                    </button>
                  </div>
                )}
                {campaignAudienceError && (
                  <p className="campaign-field-error" role="alert">
                    {campaignAudienceError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {companiesQuery.isError ? (
          <div className="query-error" role="alert">
            <strong>
              Could not load {isCompanyDatabaseView ? "companies" : "leads"}.
            </strong>
            <span>{companiesQuery.error.message}</span>
            <button
              className="button button-secondary"
              onClick={() => void companiesQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : companiesQuery.isLoading ? (
          <TableLoading
            label={`Loading ${isCompanyDatabaseView ? "companies" : "leads"}`}
            rows={6}
          />
        ) : filteredCount === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-symbol">▤</span>
            <strong>{emptyStateTitle}</strong>
            <span>{emptyStateDescription}</span>
            {!isCompanyDatabaseView &&
              eligibleCount === 0 &&
              companyCount > 0 && (
              <Link className="text-link" href="/companies">
                Go to Companies <span aria-hidden="true">→</span>
              </Link>
              )}
          </div>
        ) : (
          <>
            <div
              aria-label={
                isCompanyDatabaseView
                  ? "Company master database"
                  : "Company leads list"
              }
              className="table-scroll"
              tabIndex={0}
            >
              <table>
              <thead>
                <tr>
                  {!isCompanyDatabaseView && (
                    <th className="selection-column">
                      <input
                        aria-label={`Select all ${paginatedCompanies.length} leads on this page`}
                        checked={allPageLeadsSelected}
                        disabled={filteredSelectionMutation.isPending}
                        onChange={togglePageLeadSelection}
                        type="checkbox"
                      />
                    </th>
                  )}
                  <th>COMPANY</th>
                  <th>CONTACTS</th>
                  <th>INDUSTRY</th>
                  <th>LOCATION</th>
                  <th>STATUS</th>
                  <th>EMAIL OUTREACH</th>
                  <th>SCORE</th>
                  <th>ADDED</th>
                  {!isCompanyDatabaseView && <th>GROUP</th>}
                  <th>RECORD</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.map((company) => (
                  <Fragment key={company.id}>
                    <tr>
                      {!isCompanyDatabaseView && (
                        <td className="selection-column">
                          <input
                            aria-label={`Select ${company.name}`}
                            checked={selectedLeadCompanyIdSet.has(company.id)}
                            disabled={filteredSelectionMutation.isPending}
                            onChange={() => toggleLeadSelection(company.id)}
                            type="checkbox"
                          />
                        </td>
                      )}
                      <td><CompanyName company={company} /></td>
                      <td>{company.contacts.length}</td>
                      <td>{company.industry ?? "—"}</td>
                      <td>
                        {[company.city, company.state].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`status-${company.id}`}>
                          Change status for {company.name}
                        </label>
                        <select
                          className="status-select"
                          disabled={statusMutation.isPending}
                          id={`status-${company.id}`}
                          onChange={(event) =>
                            statusMutation.mutate({
                              companyId: company.id,
                              leadStatus: event.target.value,
                            })
                          }
                          value={company.lead_status}
                        >
                          {!leadStatuses.includes(company.lead_status) && (
                            <option value={company.lead_status}>
                              {company.lead_status.replaceAll("_", " ")}
                            </option>
                          )}
                          {leadStatuses.map((leadStatus) => (
                            <option key={leadStatus} value={leadStatus}>
                              {leadStatus.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className={`email-outreach-status${company.last_email_sent_at ? " is-contacted" : ""}`}
                        >
                          {company.last_email_sent_at
                            ? "Contacted"
                            : "Not contacted"}
                        </span>
                        {company.last_email_sent_at && (
                          <time
                            className="email-outreach-date"
                            dateTime={company.last_email_sent_at}
                            title={new Date(
                              company.last_email_sent_at,
                            ).toLocaleString()}
                          >
                            {new Date(
                              company.last_email_sent_at,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </time>
                        )}
                      </td>
                      <td className="score-cell">{company.lead_score ?? "—"}</td>
                      <td>
                        {new Date(company.created_at).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </td>
                      {!isCompanyDatabaseView && (
                        <td>
                          {company.lead_batches.length > 0 ? (
                            <span
                              className="lead-batch-badges"
                              aria-label={`Groups: ${company.lead_batches.map((batch) => batch.name).join(", ")}`}
                            >
                              <span
                                className="lead-batch-badge"
                                title={company.lead_batches[0].name}
                              >
                                {company.lead_batches[0].name}
                              </span>
                              {company.lead_batches.length > 1 && (
                                <span
                                  className="lead-batch-extra"
                                  title={company.lead_batches
                                    .slice(1)
                                    .map((batch) => batch.name)
                                    .join(", ")}
                                >
                                  +{company.lead_batches.length - 1}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="lead-batch-ungrouped">
                              Ungrouped
                            </span>
                          )}
                        </td>
                      )}
                      <td>
                        <Link
                          className="text-button"
                          href={`/company/${company.id}`}
                        >
                          View details <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                    {expandedCompanyId === company.id && (
                      <tr className="detail-row">
                        <td colSpan={isCompanyDatabaseView ? 9 : 11}>
                          <section
                            aria-label={`${company.name} full record`}
                            className="company-record"
                          >
                            <div className="record-actions">
                              <strong>Company record #{company.id}</strong>
                              <div>
                                {editingCompanyId === company.id ? (
                                  <button
                                    className="text-button"
                                    onClick={() => setEditingCompanyId(null)}
                                    type="button"
                                  >
                                    Cancel edit
                                  </button>
                                ) : (
                                  <button
                                    className="text-button"
                                    onClick={() => startEditing(company)}
                                    type="button"
                                  >
                                    Edit company
                                  </button>
                                )}
                                {confirmDeleteId === company.id ? (
                                  <>
                                    <span className="delete-confirm-copy">
                                      Delete this company and its related records?
                                    </span>
                                    <button
                                      className="text-button danger-text"
                                      disabled={deleteMutation.isPending}
                                      onClick={() =>
                                        deleteMutation.mutate(company.id)
                                      }
                                      type="button"
                                    >
                                      {deleteMutation.isPending
                                        ? "Deleting..."
                                        : "Confirm delete"}
                                    </button>
                                    <button
                                      className="text-button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      type="button"
                                    >
                                      Keep record
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="text-button danger-text"
                                    onClick={() =>
                                      setConfirmDeleteId(company.id)
                                    }
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>

                            {editingCompanyId === company.id ? (
                              <form
                                className="company-form record-edit-form"
                                onSubmit={(event) =>
                                  handleUpdateCompany(event, company.id)
                                }
                              >
                                <div className="form-row">
                                  <label>
                                    Company name <span>*</span>
                                    <input
                                      maxLength={200}
                                      onChange={(event) =>
                                        updateEditingField(
                                          "name",
                                          event.target.value,
                                        )
                                      }
                                      required
                                      value={editingForm.name ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Website
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "website",
                                          event.target.value,
                                        )
                                      }
                                      type="url"
                                      value={editingForm.website ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    Industry
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "industry",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.industry ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Domain
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "domain",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.domain ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    City
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "city",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.city ?? ""}
                                    />
                                  </label>
                                  <label>
                                    State / region
                                    <input
                                      onChange={(event) =>
                                        updateEditingField(
                                          "state",
                                          event.target.value,
                                        )
                                      }
                                      value={editingForm.state ?? ""}
                                    />
                                  </label>
                                </div>
                                <div className="form-row">
                                  <label>
                                    Software need
                                    <textarea
                                      onChange={(event) =>
                                        updateEditingField(
                                          "software_need",
                                          event.target.value,
                                        )
                                      }
                                      rows={3}
                                      value={editingForm.software_need ?? ""}
                                    />
                                  </label>
                                  <label>
                                    Lead score
                                    <input
                                      min={0}
                                      onChange={(event) =>
                                        updateEditingField(
                                          "lead_score",
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                        )
                                      }
                                      type="number"
                                      value={editingForm.lead_score ?? ""}
                                    />
                                  </label>
                                </div>
                                {updateMutation.isError && (
                                  <div className="alert alert-error" role="alert">
                                    {updateMutation.error.message}
                                  </div>
                                )}
                                <button
                                  className="button button-primary"
                                  disabled={updateMutation.isPending}
                                  type="submit"
                                >
                                  {updateMutation.isPending
                                    ? "Saving changes..."
                                    : "Save company"}
                                </button>
                              </form>
                            ) : (
                              <dl className="company-detail-grid">
                                <Detail label="Company name" value={company.name} />
                                <Detail label="Website">
                                  {company.website ? (
                                    <a
                                      href={company.website}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {company.website}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </Detail>
                                <Detail label="Domain" value={company.domain} />
                                <Detail label="Industry" value={company.industry} />
                                <Detail
                                  label="Location"
                                  value={
                                    [company.city, company.state]
                                      .filter(Boolean)
                                      .join(", ") || null
                                  }
                                />
                                <Detail
                                  label="Software need"
                                  value={company.software_need}
                                />
                                <Detail
                                  label="Lead score"
                                  value={
                                    company.lead_score === null
                                      ? "Not scored"
                                      : String(company.lead_score)
                                  }
                                />
                                <Detail
                                  label="Lead status"
                                  value={company.lead_status.replaceAll("_", " ")}
                                />
                                <Detail
                                  label="Email status"
                                  value={
                                    company.last_email_sent_at
                                      ? `Contacted · ${new Date(
                                          company.last_email_sent_at,
                                        ).toLocaleString()}`
                                      : "Not contacted"
                                  }
                                />
                                <Detail
                                  label="Created"
                                  value={new Date(
                                    company.created_at,
                                  ).toLocaleString()}
                                />
                              </dl>
                            )}

                            {editingCompanyId !== company.id && (
                              <>
                                <RecordCollection
                                  title={`PageSpeed scans (${company.pagespeed_scans.length})`}
                                  empty="No PageSpeed scans have been saved."
                                  hasItems={company.pagespeed_scans.length > 0}
                                >
                                  {company.pagespeed_scans.map((scan) => (
                                      <article
                                        className="record-item"
                                        key={scan.id}
                                      >
                                        <strong>
                                          Google PageSpeed Insights ·{" "}
                                          {scan.strategy}
                                        </strong>
                                        <a
                                          href={scan.website_url}
                                          rel="noreferrer"
                                          target="_blank"
                                        >
                                          {scan.website_url}
                                        </a>
                                        <span>
                                          Scanned:{" "}
                                          {new Date(
                                            scan.scanned_at,
                                          ).toLocaleString()}
                                        </span>
                                        <div className="pagespeed-score-grid">
                                          {[
                                            ["Performance", "performance"],
                                            ["Accessibility", "accessibility"],
                                            ["Best practices", "best-practices"],
                                            ["SEO", "seo"],
                                          ].map(([label, category]) => (
                                            <span key={category}>
                                              {label}:{" "}
                                              {scan.category_scores[category] ??
                                                "N/A"}
                                              {scan.category_scores[category] !==
                                                null &&
                                              scan.category_scores[category] !==
                                                undefined
                                                ? "/100"
                                                : ""}
                                            </span>
                                          ))}
                                        </div>
                                      </article>
                                    ))}
                                </RecordCollection>
                                <RecordCollection
                                  title={`Contacts (${company.contacts.length})`}
                                  empty="No contact records are attached."
                                  hasItems={company.contacts.length > 0}
                                >
                                  {company.contacts.map((contact) => (
                                    <article
                                      className="record-item"
                                      key={contact.id}
                                    >
                                      <strong>
                                        Contact #{contact.id}:{" "}
                                        {contact.name ?? "Unnamed contact"}
                                      </strong>
                                      <span>{contact.role ?? "Role not provided"}</span>
                                      <span>
                                        {contact.business_email ??
                                          "Email not provided"}
                                      </span>
                                      <span>
                                        {contact.business_phone ??
                                          "Phone not provided"}
                                      </span>
                                      <span>
                                        {contact.is_publicly_listed
                                          ? "Publicly listed"
                                          : "Not marked publicly listed"}
                                      </span>
                                    </article>
                                  ))}
                                </RecordCollection>
                              </>
                            )}
                          </section>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing{" "}
                {filteredCount === 0
                  ? 0
                  : (visiblePage - 1) * pageSize + 1}
                –{Math.min(visiblePage * pageSize, filteredCount)} of{" "}
                {filteredCount}{" "}
                {isCompanyDatabaseView ? "companies" : "leads"}
                {filteredCount !== eligibleCount &&
                  ` (from ${eligibleCount.toLocaleString()} total)`}
              </span>
              <div className="pagination-controls">
                <label>
                  Rows
                  <select
                    onChange={(event) => {
                      const nextPageSize = Number(event.target.value);
                      updatePipelineQuery({
                        pageSize: nextPageSize === 10
                          ? null
                          : String(nextPageSize),
                        page: null,
                      });
                    }}
                    value={pageSize}
                  >
                    {pageSizes.map((size) => (
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
                    updatePipelineQuery({
                      page:
                        visiblePage === 2 ? null : String(visiblePage - 1),
                    })
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
                    updatePipelineQuery({ page: String(visiblePage + 1) })
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
            {statusMutation.isError && (
              <div className="alert alert-error record-mutation-error" role="alert">
                Could not update lead status: {statusMutation.error.message}
              </div>
            )}
            {deleteMutation.isError && (
              <div className="alert alert-error record-mutation-error" role="alert">
                Could not delete company: {deleteMutation.error.message}
              </div>
            )}
          </>
        )}
      </section>

      {!isCompanyDatabaseView && (
        <dialog
          aria-labelledby="lead-batch-dialog-title"
          className="add-company-dialog lead-batch-dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              event.currentTarget.close();
            }
          }}
          ref={leadBatchDialogRef}
        >
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow">LEAD ORGANIZATION</p>
              <h2 id="lead-batch-dialog-title">Manage lead groups</h2>
              <p className="panel-subtitle">
                Create a named group or rename an existing one. Selected leads
                will join a group when you create it.
              </p>
            </div>
            <button
              aria-label="Close lead group manager"
              className="icon-button"
              onClick={() => leadBatchDialogRef.current?.close()}
              type="button"
            >
              ×
            </button>
          </div>
          <form
            className="company-form lead-batch-create-form"
            onSubmit={handleCreateLeadBatch}
          >
            <label>
              New group name
              <input
                autoComplete="off"
                maxLength={160}
                onChange={(event) => setNewLeadBatchName(event.target.value)}
                placeholder="e.g. West Coast retailers"
                required
                value={newLeadBatchName}
              />
            </label>
            <p>
              {selectedLeadCompanyIds.length > 0
                ? `${selectedLeadCompanyIds.length.toLocaleString()} selected leads will be added to this group.`
                : "No leads are selected. You can create an empty group and add leads later."}
            </p>
            <button
              className="button button-primary"
              disabled={
                !newLeadBatchName.trim() || createLeadBatchMutation.isPending
              }
              type="submit"
            >
              {createLeadBatchMutation.isPending
                ? "Creating group..."
                : "Create group"}
            </button>
          </form>
          <section aria-label="Existing lead groups" className="lead-batch-list">
            <h3>Existing groups</h3>
            {leadBatchesQuery.isLoading ? (
              <p className="lead-batch-list-empty">Loading groups...</p>
            ) : (leadBatchesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="lead-batch-list-empty">
                No groups yet. Create one above to get started.
              </p>
            ) : (
              leadBatchesQuery.data?.items.map((batch) => (
                <form
                  className="lead-batch-rename-form"
                  key={`${batch.id}-${batch.name}`}
                  onSubmit={(event) =>
                    handleRenameLeadBatch(event, batch.id)
                  }
                >
                  <label>
                    <span className="sr-only">Group name for {batch.name}</span>
                    <input
                      defaultValue={batch.name}
                      maxLength={160}
                      name="name"
                      required
                    />
                  </label>
                  <span className="lead-batch-list-count">
                    {batch.lead_count} lead{batch.lead_count === 1 ? "" : "s"}
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={updateLeadBatchMutation.isPending}
                    type="submit"
                  >
                    Save
                  </button>
                </form>
              ))
            )}
          </section>
        </dialog>
      )}

      <dialog
        aria-labelledby="add-company-title"
        className="add-company-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={addCompanyDialogRef}
      >
        <div className="panel-heading compact-heading">
          <div>
            <p className="eyebrow">MANUAL ENTRY</p>
            <h2 id="add-company-title">Add a company</h2>
            <p className="panel-subtitle">
              Add a company directly when you already have its details.
            </p>
          </div>
          <button
            aria-label="Close add company dialog"
            className="icon-button"
            onClick={() => addCompanyDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
        </div>
        <form className="company-form" onSubmit={handleCreateCompany}>
          <div className="form-row">
            <label>
              Company name <span>*</span>
              <input
                autoComplete="organization"
                maxLength={200}
                onChange={(event) => updateField("name", event.target.value)}
                required
                value={companyForm.name}
              />
            </label>
            <label>
              Website
              <input
                autoComplete="url"
                onChange={(event) => updateField("website", event.target.value)}
                placeholder="https://example.com"
                type="url"
                value={companyForm.website ?? ""}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Industry
              <input
                onChange={(event) => updateField("industry", event.target.value)}
                value={companyForm.industry ?? ""}
              />
            </label>
            <label>
              Domain
              <input
                onChange={(event) => updateField("domain", event.target.value)}
                placeholder="example.com"
                value={companyForm.domain ?? ""}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              City
              <input
                onChange={(event) => updateField("city", event.target.value)}
                value={companyForm.city ?? ""}
              />
            </label>
            <label>
              State / region
              <input
                onChange={(event) => updateField("state", event.target.value)}
                value={companyForm.state ?? ""}
              />
            </label>
          </div>
          <label>
            Software need
            <textarea
              onChange={(event) =>
                updateField("software_need", event.target.value)
              }
              rows={3}
              value={companyForm.software_need ?? ""}
            />
          </label>
          {createMutation.isError && (
            <div className="alert alert-error" role="alert">
              {createMutation.error.message}
            </div>
          )}
          {createMutation.isSuccess && (
            <div className="alert alert-success" role="status">
              Company added to your pipeline.
            </div>
          )}
          <button
            className="button button-primary full-button"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? "Adding company..." : "Add to pipeline"}
          </button>
        </form>
      </dialog>
    </>
  );
}

function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="company-detail">
      <dt>{label}</dt>
      <dd>{children ?? value ?? "—"}</dd>
    </div>
  );
}

function RecordCollection({
  title,
  empty,
  hasItems,
  children,
}: {
  title: string;
  empty: string;
  hasItems: boolean;
  children: ReactNode;
}) {
  return (
    <section className="record-collection">
      <h3>{title}</h3>
      {hasItems ? (
        <div className="record-items">{children}</div>
      ) : (
        <p className="record-empty">{empty}</p>
      )}
    </section>
  );
}
