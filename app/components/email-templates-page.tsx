"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  Info,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getAssignedGmailAccounts,
  getApplicationSettings,
  getGroqModels,
  getAuthSession,
  getEmailTemplateVariables,
  getEmailTemplates,
  generateEmailTemplateDraft,
  getWebsiteContacts,
  getWebsites,
  previewEmailTemplate,
  sendEmailTemplate,
  updateEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
  type GroqCompletionUsage,
  type GroqRequestUsageSnapshot,
} from "@/lib/api";
import { useToast } from "./toast-provider";

const emptyDraft: EmailTemplateInput = {
  name: "",
  subject: "",
  body_content: "",
};

type TemplateInsertTarget = "subject" | "body_content";
type EmailDraftProvider = "gemini" | "groq";

export function EmailTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldCreateFromQuery = searchParams.get("create") === "1";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const draftDialogRef = useRef<HTMLDialogElement>(null);
  const templatePreviewDialogRef = useRef<HTMLDialogElement>(null);
  const generationPromptRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<EmailTemplateInput>(emptyDraft);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [draftPanelOpen, setDraftPanelOpen] = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [generationProvider, setGenerationProvider] =
    useState<EmailDraftProvider>("gemini");
  const [groqModel, setGroqModel] = useState("openai/gpt-oss-20b");
  const [lastGroqUsage, setLastGroqUsage] = useState<{
    model: string;
    usage: GroqCompletionUsage;
  } | null>(null);
  const [variableTarget, setVariableTarget] =
    useState<TemplateInsertTarget>("body_content");
  const [variableSearch, setVariableSearch] = useState("");
  const [websiteId, setWebsiteId] = useState("");
  const [contactId, setContactId] = useState("");
  const [gmailAccountId, setGmailAccountId] = useState("");
  const [preview, setPreview] = useState<{
    subject: string;
    body_content: string;
  } | null>(null);
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [createPermissionNotice, setCreatePermissionNotice] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const organizationId = sessionQuery.data?.organization_id ?? "";
  const isAdmin = sessionQuery.data?.user.role === "admin";

  const templatesQuery = useQuery({
    queryKey: ["email-templates", organizationId],
    queryFn: () => getEmailTemplates(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const variablesQuery = useQuery({
    queryKey: ["email-template-variables", organizationId],
    queryFn: () => getEmailTemplateVariables(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const draftSettingsQuery = useQuery({
    queryKey: ["application-settings"],
    queryFn: getApplicationSettings,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const groqModelsQuery = useQuery({
    queryKey: ["groq-models", sessionQuery.data?.user.id],
    queryFn: getGroqModels,
    enabled:
      draftPanelOpen &&
      generationProvider === "groq" &&
      draftSettingsQuery.data?.groq_configured === true,
    retry: false,
  });
  const availableGroqModels = groqModelsQuery.data?.models ?? [];
  const selectedGroqModel = availableGroqModels.includes(groqModel)
    ? groqModel
    : availableGroqModels.includes("openai/gpt-oss-20b")
      ? "openai/gpt-oss-20b"
      : availableGroqModels[0] ?? "";
  const websitesQuery = useQuery({
    queryKey: ["websites"],
    queryFn: getWebsites,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const accountsQuery = useQuery({
    queryKey: ["gmail-assigned-accounts"],
    queryFn: getAssignedGmailAccounts,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const generateMutation = useMutation({
    mutationFn: () =>
      generateEmailTemplateDraft(organizationId, {
        prompt: generationPrompt.trim(),
        provider: generationProvider,
        ...(generationProvider === "groq" && selectedGroqModel
          ? { model: selectedGroqModel }
          : {}),
      }),
    onSuccess: (generatedDraft) => {
      setDraft({
        name: generatedDraft.name,
        subject: generatedDraft.subject,
        body_content: generatedDraft.body_content,
      });
      const usage =
        generationProvider === "groq" ? generatedDraft.usage : undefined;
      setLastGroqUsage(
        usage && generatedDraft.model
          ? { model: generatedDraft.model, usage }
          : null,
      );
      if (
        usage &&
        generatedDraft.model &&
        sessionQuery.data?.user.id
      ) {
        queryClient.setQueryData<GroqRequestUsageSnapshot>(
          ["groq-request-usage", sessionQuery.data.user.id],
          {
            model: generatedDraft.model,
            usage,
            recorded_at: new Date().toISOString(),
          },
        );
      }
      setPreview(null);
      setSendResult(null);
      setDraftPanelOpen(false);
      showToast({
        type: "success",
        title: "Draft generated",
        message: usage
          ? `Groq used ${usage.total_tokens} tokens. Review and edit the template before saving.`
          : "Review and edit the template before saving.",
      });
    },
  });
  const resetGenerateMutation = generateMutation.reset;

  useEffect(() => {
    const dialog = draftDialogRef.current;
    if (!dialog) return;
    if (draftPanelOpen && !dialog.open) {
      dialog.showModal();
      generationPromptRef.current?.focus();
    } else if (!draftPanelOpen && dialog.open) {
      dialog.close();
    }
  }, [draftPanelOpen]);

  useEffect(() => {
    const dialog = templatePreviewDialogRef.current;
    if (!dialog) return;
    if (templatePreviewOpen && !dialog.open) {
      dialog.showModal();
    } else if (!templatePreviewOpen && dialog.open) {
      dialog.close();
    }
  }, [templatePreviewOpen]);

  const providerName = generationProvider === "groq" ? "Groq" : "Gemini";
  const providerConfigured =
    generationProvider === "groq"
      ? draftSettingsQuery.data?.groq_configured === true
      : draftSettingsQuery.data?.gemini_configured === true;

  const templates = templatesQuery.data ?? [];
  const activeTemplate =
    editorOpen && !editingTemplateId
      ? null
      : templates.find((template) => template.id === selectedTemplateId) ??
        templates[0] ??
        null;
  const websites = websitesQuery.data ?? [];
  const activeWebsiteId = websiteId;
  const activeWebsite = websites.find(
    (website) => website.id === activeWebsiteId,
  );
  const contactsQuery = useQuery({
    queryKey: ["website-contacts", activeWebsiteId],
    queryFn: () => getWebsiteContacts(activeWebsiteId),
    enabled: Boolean(activeWebsiteId),
    retry: false,
  });
  const contacts = contactsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const activeGmailAccountId = gmailAccountId;
  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const selectedAccount = accounts.find(
    (account) => account.id === activeGmailAccountId,
  );

  const saveMutation = useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string | null;
      input: EmailTemplateInput;
    }) =>
      templateId
        ? updateEmailTemplate(organizationId, templateId, input)
        : createEmailTemplate(organizationId, input),
    onSuccess: async (template, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["email-templates", organizationId],
      });
      setSelectedTemplateId(template.id);
      setEditingTemplateId(null);
      setEditorOpen(false);
      setPreview(null);
      setSendResult(null);
      showToast({
        type: "success",
        title: variables.templateId ? "Template updated" : "Template created",
        message: `${template.name} was saved.`,
      });
    },
  });
  const resetSaveMutation = saveMutation.reset;
  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      deleteEmailTemplate(organizationId, templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["email-templates", organizationId],
      });
      setSelectedTemplateId("");
      setDeleteConfirmationOpen(false);
      setPreview(null);
      setSendResult(null);
      showToast({
        type: "success",
        title: "Template deleted",
        message: "The email template was removed.",
      });
    },
  });
  const previewMutation = useMutation({
    mutationFn: ({
      templateId,
      selectedWebsiteId,
      selectedContactId,
      selectedGmailAccountId,
    }: {
      templateId: string;
      selectedWebsiteId: string;
      selectedContactId: string;
      selectedGmailAccountId: string;
    }) =>
      previewEmailTemplate(organizationId, templateId, {
        website_id: selectedWebsiteId,
        contact_id: selectedContactId || undefined,
        gmail_account_id: selectedGmailAccountId || undefined,
      }),
    onSuccess: (result) => {
      setPreview(result);
      setSendResult(null);
    },
  });
  const sendMutation = useMutation({
    mutationFn: ({
      templateId,
      selectedWebsiteId,
      selectedContactId,
      selectedGmailAccountId,
    }: {
      templateId: string;
      selectedWebsiteId: string;
      selectedContactId: string;
      selectedGmailAccountId: string;
    }) =>
      sendEmailTemplate(organizationId, templateId, {
        website_id: selectedWebsiteId,
        contact_id: selectedContactId,
        gmail_account_id: selectedGmailAccountId,
      }),
    onSuccess: (result) => {
      setSendConfirmationOpen(false);
      setPreview(null);
      setSendResult(
        `Email sent to ${result.recipient_email}. Gmail message ID: ${result.message_id}`,
      );
    },
  });

  function selectTemplate(template: EmailTemplate) {
    setSelectedTemplateId(template.id);
    setCreatePermissionNotice(false);
    setPreview(null);
    setSendResult(null);
    setDeleteConfirmationOpen(false);
    previewMutation.reset();
    sendMutation.reset();
  }

  const startNewTemplate = useCallback(() => {
    setSelectedTemplateId("");
    setEditingTemplateId(null);
    setCreatePermissionNotice(false);
    setDraft({ ...emptyDraft });
    setGenerationPrompt("");
    setVariableTarget("body_content");
    setVariableSearch("");
    resetGenerateMutation();
    setEditorOpen(true);
    setDraftPanelOpen(false);
    setPreview(null);
    setSendResult(null);
    resetSaveMutation();
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [resetGenerateMutation, resetSaveMutation]);

  useEffect(() => {
    if (!shouldCreateFromQuery || sessionQuery.isPending) return;
    if (editorOpen) {
      router.replace("/templates", { scroll: false });
      return;
    }
    if (isAdmin) {
      window.requestAnimationFrame(startNewTemplate);
    } else {
      window.requestAnimationFrame(() => setCreatePermissionNotice(true));
    }
    router.replace("/templates", { scroll: false });
  }, [
    isAdmin,
    editorOpen,
    router,
    sessionQuery.isPending,
    shouldCreateFromQuery,
    startNewTemplate,
  ]);

  function startEditingTemplate(template: EmailTemplate) {
    setCreatePermissionNotice(false);
    setEditingTemplateId(template.id);
    setDraft({
      name: template.name,
      subject: template.subject,
      body_content: template.body_content,
    });
    setGenerationPrompt("");
    setVariableTarget("body_content");
    setVariableSearch("");
    resetGenerateMutation();
    setEditorOpen(true);
    setDraftPanelOpen(false);
    setPreview(null);
    setSendResult(null);
    saveMutation.reset();
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  }

  function cancelEditing() {
    setEditorOpen(false);
    setEditingTemplateId(null);
    setDraft({ ...emptyDraft });
    setGenerationPrompt("");
    setVariableTarget("body_content");
    setVariableSearch("");
    resetGenerateMutation();
    setDraftPanelOpen(false);
    saveMutation.reset();
  }

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate({
      templateId: editingTemplateId,
      input: {
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        body_content: draft.body_content,
      },
    });
  }

  function updateDraft(
    field: keyof EmailTemplateInput,
    value: string,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function insertVariable(
    field: "subject" | "body_content",
    placeholder: string,
  ) {
    const input =
      field === "subject" ? subjectInputRef.current : bodyInputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = draft[field];
    const nextValue =
      value.slice(0, start) + placeholder + value.slice(end);
    updateDraft(field, nextValue);
    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  function requestPreview() {
    if (!activeTemplate || !activeWebsiteId) return;
    setPreview(null);
    setSendResult(null);
    previewMutation.mutate({
      templateId: activeTemplate.id,
      selectedWebsiteId: activeWebsiteId,
      selectedContactId: contactId,
      selectedGmailAccountId: activeGmailAccountId,
    });
  }

  function selectDraftProvider(provider: EmailDraftProvider) {
    setGenerationProvider(provider);
    setLastGroqUsage(null);
    generateMutation.reset();
  }

  function openDraftPanel() {
    setDraftPanelOpen(true);
  }

  function requestSend() {
    if (!activeTemplate || !activeWebsiteId || !contactId || !activeGmailAccountId) {
      return;
    }
    sendMutation.mutate({
      templateId: activeTemplate.id,
      selectedWebsiteId: activeWebsiteId,
      selectedContactId: contactId,
      selectedGmailAccountId: activeGmailAccountId,
    });
  }

  const variables = variablesQuery.data ?? [];
  const normalizedVariableSearch = variableSearch.trim().toLowerCase();
  const variableGroups = ["website", "contact", "sender"]
    .map((group) => ({
      group,
      items: variables.filter((variable) => {
        const matchesGroup = variable.path.startsWith(`${group}.`);
        const matchesSearch =
          !normalizedVariableSearch ||
          `${variable.path} ${variable.label} ${variable.description}`
            .toLowerCase()
            .includes(normalizedVariableSearch);
        return matchesGroup && matchesSearch;
      }),
    }))
    .filter(({ items }) => items.length > 0);
  const previewDocument = preview
    ? buildEmailPreviewDocument(preview.body_content)
    : "";
  const canSend =
    Boolean(
      activeTemplate &&
        activeWebsiteId &&
        contactId &&
        selectedContact?.business_email &&
        activeGmailAccountId &&
        preview,
    ) &&
    !sendMutation.isPending;

  return (
    <div className={`email-templates-page${editorOpen ? " is-editor-open" : ""}`}>
      {!editorOpen && (
        <header className="email-templates-heading">
          <h1>Email templates</h1>
          {isAdmin ? (
            <button
              className="button button-primary template-create-action"
              onClick={startNewTemplate}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              New template
            </button>
          ) : sessionQuery.isSuccess ? (
            <p className="template-admin-note">
              Ask an admin to add or edit templates.
            </p>
          ) : null}
        </header>
      )}

      {createPermissionNotice && (
        <div className="email-template-alert template-permission-alert" role="status">
          Only organization admins can create or edit shared templates.
        </div>
      )}

      <div className={`email-template-layout${editorOpen || sessionQuery.isError ? " is-editor-open" : ""}`}>
        {!editorOpen && !sessionQuery.isError && (
          <aside aria-label="Email template library" className="panel template-library">
            <div className="template-library-heading">
              <span className="template-library-count">
                {templatesQuery.isPending
                  ? "Loading"
                  : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
              </span>
            </div>

            {(sessionQuery.isPending || (organizationId && templatesQuery.isLoading)) && (
              <p className="template-state" role="status">Loading templates…</p>
            )}
            {templatesQuery.isError && (
              <div className="template-state template-state-error" role="alert">
                <p>Could not load templates.</p>
                <span>{errorMessage(templatesQuery.error)}</span>
                <button
                  className="button button-secondary"
                  onClick={() => void templatesQuery.refetch()}
                  type="button"
                >
                  Try again
                </button>
              </div>
            )}
            {templatesQuery.isSuccess && templates.length === 0 && (
              <div className="template-state">
                <span className="template-empty-icon" aria-hidden="true">✉</span>
                <strong>No templates yet</strong>
                <span>
                  {isAdmin
                    ? "Create a template to start building reusable outreach."
                    : "An organization admin can create shared templates."}
                </span>
              </div>
            )}
            {templates.length > 0 && (
              <ul className="template-list">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      aria-current={activeTemplate?.id === template.id ? "true" : undefined}
                      className={`template-list-item${activeTemplate?.id === template.id ? " is-active" : ""}`}
                      onClick={() => selectTemplate(template)}
                      type="button"
                    >
                      <span className="template-list-icon" aria-hidden="true">✉</span>
                      <span className="template-list-copy">
                        <strong>{template.name}</strong>
                        <small>{template.subject}</small>
                      </span>
                      <span className="template-list-arrow" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <section
          aria-label={editorOpen ? "Email template editor" : "Selected email template"}
          className={`template-workspace${editorOpen ? " is-editing" : " panel"}`}
        >
          {editorOpen ? (
            <div className="template-editor">
              <div className="template-section-heading">
                <div>
                  <h2>{editingTemplateId ? "Edit template" : "New template"}</h2>
                </div>
              </div>

              {!isAdmin && (
                <div className="email-template-alert email-template-alert-error" role="alert">
                  Only organization admins can create or edit templates.
                </div>
              )}

              <form className="template-form" onSubmit={saveTemplate}>
                <div className="template-form-fields">
                  <div className="template-form-meta">
                    <label className="template-field">
                      Template name
                      <input
                        autoComplete="off"
                        maxLength={200}
                        onChange={(event) => updateDraft("name", event.target.value)}
                        placeholder="e.g. First-touch introduction"
                        ref={nameInputRef}
                        required
                        value={draft.name}
                      />
                    </label>
                    <label className="template-field">
                      Subject
                      <input
                        maxLength={998}
                        onFocus={() => setVariableTarget("subject")}
                        onChange={(event) => updateDraft("subject", event.target.value)}
                        placeholder="A short, relevant subject"
                        ref={subjectInputRef}
                        required
                        value={draft.subject}
                      />
                    </label>
                  </div>
                  <label className="template-field template-body-field">
                    Email body (HTML)
                    <textarea
                      className="template-body-input"
                      maxLength={200_000}
                      onFocus={() => setVariableTarget("body_content")}
                      onChange={(event) => updateDraft("body_content", event.target.value)}
                      placeholder={"<p>Hi {{ contact.first_name | default(\"there\") }},</p>\n<p>I noticed {{ website.name }}...</p>"}
                      ref={bodyInputRef}
                      required
                      rows={16}
                      value={draft.body_content}
                    />
                  </label>
                </div>

                <section
                  aria-labelledby="template-variable-title"
                  className="template-variable-panel"
                >
                  <div className="template-variable-heading">
                    <h3 id="template-variable-title">Personalization</h3>
                    <span>
                      {variables.length} {variables.length === 1 ? "field" : "fields"}
                    </span>
                  </div>
                  <div className="template-variable-target-row">
                    <span className="template-variable-target-label">
                      Insert into
                    </span>
                    <div
                      aria-label="Insert personalization into"
                      className="template-variable-target"
                      role="group"
                    >
                      <button
                        aria-pressed={variableTarget === "subject"}
                        className="template-variable-target-button"
                        onClick={() => setVariableTarget("subject")}
                        type="button"
                      >
                        Subject
                      </button>
                      <button
                        aria-pressed={variableTarget === "body_content"}
                        className="template-variable-target-button"
                        onClick={() => setVariableTarget("body_content")}
                        type="button"
                      >
                        Body
                      </button>
                    </div>
                  </div>
                  <label className="template-variable-search">
                    <Search aria-hidden="true" size={15} />
                    <input
                      aria-label="Search personalization fields"
                      onChange={(event) => setVariableSearch(event.target.value)}
                      placeholder="Find a field"
                      type="search"
                      value={variableSearch}
                    />
                  </label>
                  <div className="template-variable-list">
                    {variablesQuery.isError ? (
                      <p className="template-variable-error" role="alert">
                        Could not load fields: {errorMessage(variablesQuery.error)}
                      </p>
                    ) : variablesQuery.isPending ? (
                      <p className="template-state">Loading fields…</p>
                    ) : variableGroups.length ? (
                      <div className="template-variable-groups">
                        {variableGroups.map(({ group, items }) => (
                          <section
                            aria-labelledby={`template-variable-group-${group}`}
                            className="template-variable-group"
                            key={group}
                          >
                            <h4 id={`template-variable-group-${group}`}>
                              <span>{group}</span>
                              <span>{items.length}</span>
                            </h4>
                            <div className="template-variable-rows">
                              {items.map((variable) => (
                                <div className="template-variable-row" key={variable.path}>
                                  <span>
                                    <code>{variable.path}</code>
                                    <small>{variable.label}</small>
                                  </span>
                                  <button
                                    aria-label={`Insert ${variable.path} into the ${variableTarget === "subject" ? "subject" : "email body"}`}
                                    className="template-variable-action"
                                    onClick={() =>
                                      insertVariable(variableTarget, variable.placeholder)
                                    }
                                    title={variable.description}
                                    type="button"
                                  >
                                    Insert
                                  </button>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="template-variable-empty" role="status">
                        {variables.length
                          ? "No fields match your search."
                          : "No personalization fields are available."}
                      </p>
                    )}
                  </div>
                </section>

                {saveMutation.isError && (
                  <div className="email-template-alert email-template-alert-error template-save-error" role="alert">
                    Could not save this template: {errorMessage(saveMutation.error)}
                  </div>
                )}
                <div className="template-form-actions">
                  {isAdmin && (
                    <button
                      aria-controls="template-ai-panel"
                      aria-haspopup="dialog"
                      className="template-ai-action"
                      onClick={openDraftPanel}
                      type="button"
                    >
                      <Sparkles aria-hidden="true" size={16} />
                      Ask AI
                      <ChevronDown aria-hidden="true" size={14} />
                    </button>
                  )}
                  <div className="template-form-action-buttons">
                    <button
                      className="button button-secondary"
                      disabled={!draft.body_content.trim()}
                      onClick={() => setTemplatePreviewOpen(true)}
                      type="button"
                    >
                      <Eye aria-hidden="true" size={15} />
                      Preview rendered email
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={cancelEditing}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-primary"
                      disabled={
                        !isAdmin ||
                        saveMutation.isPending ||
                        !draft.name.trim() ||
                        !draft.subject.trim() ||
                        !draft.body_content.trim()
                      }
                      type="submit"
                    >
                      {saveMutation.isPending
                        ? "Saving…"
                        : editingTemplateId
                          ? "Save changes"
                          : "Save template"}
                    </button>
                  </div>
                </div>
              </form>

              {lastGroqUsage && (
                <p className="template-ai-message" role="status">
                  Last Groq request ({lastGroqUsage.model}):{" "}
                  {lastGroqUsage.usage.prompt_tokens.toLocaleString()} input +{" "}
                  {lastGroqUsage.usage.completion_tokens.toLocaleString()} output
                  = {lastGroqUsage.usage.total_tokens.toLocaleString()} tokens.
                  {typeof lastGroqUsage.usage.requests_remaining === "number" &&
                    ` ${lastGroqUsage.usage.requests_remaining.toLocaleString()} requests remaining.`}
                  {typeof lastGroqUsage.usage.tokens_remaining === "number" &&
                    ` ${lastGroqUsage.usage.tokens_remaining.toLocaleString()} tokens remaining in the rate-limit window.`}
                  {" "}Per-request usage, not account billing totals.
                </p>
              )}

              <dialog
                aria-labelledby="template-render-preview-title"
                className="template-ai-dialog template-render-dialog"
                onClose={() => setTemplatePreviewOpen(false)}
                ref={templatePreviewDialogRef}
              >
                <div className="template-ai-dialog-heading">
                  <div>
                    <h2 id="template-render-preview-title">Rendered template</h2>
                    <p>Live preview of the current subject and HTML body.</p>
                  </div>
                  <button
                    aria-label="Close rendered template preview"
                    className="template-ai-dialog-close"
                    onClick={() => setTemplatePreviewOpen(false)}
                    type="button"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
                <div className="template-rendered-preview-heading">
                  <div>
                    <p className="eyebrow">SUBJECT</p>
                    <h3>{draft.subject || "No subject entered"}</h3>
                  </div>
                  <span className="template-preview-badge">Live preview</span>
                </div>
                <iframe
                  className="template-preview-frame"
                  referrerPolicy="no-referrer"
                  sandbox=""
                  srcDoc={buildEmailPreviewDocument(draft.body_content)}
                  title="Rendered template body"
                />
                <p className="template-ai-message">
                  Personalization placeholders remain visible here. Save the
                  template and use Preview and test to render values for a
                  website and contact.
                </p>
              </dialog>

              {isAdmin && (
                <dialog
                  aria-labelledby="template-ai-title"
                  className="template-ai-dialog template-ai-draft-dialog"
                  id="template-ai-panel"
                  onClose={() => setDraftPanelOpen(false)}
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setDraftPanelOpen(false);
                    }
                  }}
                  ref={draftDialogRef}
                >
                  <div className="template-ai-dialog-heading">
                    <div>
                      <h2 id="template-ai-title">Create an AI draft</h2>
                      <p>Editable before saving.</p>
                    </div>
                    <button
                      aria-label="Close AI draft dialog"
                      className="template-ai-dialog-close"
                      onClick={() => setDraftPanelOpen(false)}
                      type="button"
                    >
                      <X aria-hidden="true" size={18} />
                    </button>
                  </div>
                  <div className="template-ai-provider-section">
                    <p className="template-ai-section-label">Draft provider</p>
                    <div
                      aria-label="Draft provider"
                      className="template-ai-provider-options"
                      role="group"
                    >
                      <button
                        aria-pressed={generationProvider === "gemini"}
                        className={`template-ai-provider-option${generationProvider === "gemini" ? " is-selected" : ""}`}
                        disabled={generateMutation.isPending}
                        onClick={() => selectDraftProvider("gemini")}
                        type="button"
                      >
                        <span>Gemini</span>
                        <span className="template-ai-provider-check" aria-hidden="true">
                          {generationProvider === "gemini" && <Check size={15} />}
                        </span>
                      </button>
                      <button
                        aria-pressed={generationProvider === "groq"}
                        className={`template-ai-provider-option${generationProvider === "groq" ? " is-selected" : ""}`}
                        disabled={generateMutation.isPending}
                        onClick={() => selectDraftProvider("groq")}
                        type="button"
                      >
                        <span>Groq</span>
                        <span className="template-ai-provider-check" aria-hidden="true">
                          {generationProvider === "groq" && <Check size={15} />}
                        </span>
                      </button>
                    </div>
                  </div>
                  <label className="template-ai-prompt">
                    <span className="template-ai-prompt-heading">
                      <span>Your brief</span>
                      <span aria-hidden="true">
                        {generationPrompt.length.toLocaleString()}/4,000
                      </span>
                    </span>
                    <textarea
                      disabled={generateMutation.isPending}
                      maxLength={4000}
                      minLength={8}
                      onChange={(event) => {
                        setGenerationPrompt(event.target.value);
                        generateMutation.reset();
                      }}
                      placeholder="Audience, goal, tone, and call to action"
                      ref={generationPromptRef}
                      rows={3}
                      value={generationPrompt}
                    />
                    {generationPrompt.trim().length > 0 &&
                      generationPrompt.trim().length < 8 && (
                        <span className="template-ai-field-error" role="status">
                          Enter at least 8 characters.
                        </span>
                      )}
                  </label>
                  {generationProvider === "groq" && providerConfigured && (
                    <>
                      {groqModelsQuery.isPending && (
                        <p className="template-ai-message" role="status">
                          Loading available Groq models…
                        </p>
                      )}
                      {groqModelsQuery.isError && (
                        <p className="template-ai-message is-error" role="alert">
                          Could not load Groq models:{" "}
                          {errorMessage(groqModelsQuery.error)}
                        </p>
                      )}
                      {groqModelsQuery.isSuccess &&
                        availableGroqModels.length === 0 && (
                          <p className="template-ai-message is-error" role="alert">
                            No Groq models with strict structured-output support are available for this key.
                          </p>
                        )}
                      {availableGroqModels.length > 0 && (
                        <label className="template-ai-prompt">
                          Model
                          <select
                            disabled={generateMutation.isPending}
                            onChange={(event) => setGroqModel(event.target.value)}
                            value={selectedGroqModel}
                          >
                            {availableGroqModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  )}
                  {draftSettingsQuery.isError && (
                    <p className="template-ai-message is-error" role="alert">
                      Could not check {providerName} settings.{" "}
                      {errorMessage(draftSettingsQuery.error)}
                    </p>
                  )}
                  {draftSettingsQuery.isPending && (
                    <p className="template-ai-message" role="status">
                      Checking {providerName} setup…
                    </p>
                  )}
                  {draftSettingsQuery.data && !providerConfigured && (
                    <p className="template-ai-config-notice">
                      <Info aria-hidden="true" size={16} />
                      <span>
                        Set up{" "}
                        <Link href={`/settings?section=${generationProvider}`}>
                          {providerName}
                        </Link>
                        {" "}in Settings to generate drafts.
                      </span>
                    </p>
                  )}
                  {generateMutation.isError && (
                    <p className="template-ai-message is-error" role="alert">
                      {errorMessage(generateMutation.error)}
                    </p>
                  )}
                  <div className="template-ai-dialog-footer">
                    <p>
                      Current fields will be replaced; nothing is sent.
                    </p>
                    <button
                      className="button button-primary"
                      disabled={
                        generateMutation.isPending ||
                        generationPrompt.trim().length < 8 ||
                        !providerConfigured ||
                        (generationProvider === "groq" &&
                          (groqModelsQuery.isPending ||
                            groqModelsQuery.isError ||
                            !selectedGroqModel))
                      }
                      onClick={() => generateMutation.mutate()}
                      type="button"
                    >
                      {generateMutation.isPending
                        ? (
                          <>
                            <LoaderCircle aria-hidden="true" className="template-ai-spinner" size={16} />
                            Generating…
                          </>
                        )
                        : "Generate draft"}
                    </button>
                  </div>
                </dialog>
              )}
            </div>
          ) : templatesQuery.isError ? (
            <div className="template-empty-workspace" role="alert">
              <span className="template-empty-icon" aria-hidden="true">!</span>
              <p className="eyebrow">TEMPLATES UNAVAILABLE</p>
              <h2>Could not load your templates</h2>
              <p>{errorMessage(templatesQuery.error)}</p>
              <button
                className="button button-secondary"
                onClick={() => void templatesQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : sessionQuery.isError ? (
            <div className="template-empty-workspace" role="alert">
              <span className="template-empty-icon" aria-hidden="true">!</span>
              <p className="eyebrow">WORKSPACE UNAVAILABLE</p>
              <h2>Could not load your templates</h2>
              <p>{errorMessage(sessionQuery.error)}</p>
              <button
                className="button button-secondary"
                onClick={() => void sessionQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : sessionQuery.isPending || templatesQuery.isLoading ? (
            <div className="template-loading-state" role="status" aria-label="Loading templates">
              <span className="template-loading-line is-short" />
              <span className="template-loading-line" />
              <span className="template-loading-block" />
              <span className="template-loading-line is-medium" />
            </div>
          ) : activeTemplate ? (
            <div className="template-detail-view">
              <div className="template-section-heading template-detail-heading">
                <div>
                  <h2>{activeTemplate.name}</h2>
                </div>
                <div className="template-detail-actions">
                  {isAdmin && (
                    <>
                      <button
                        className="button button-secondary"
                        onClick={() => startEditingTemplate(activeTemplate)}
                        type="button"
                      >
                        Edit template
                      </button>
                      <button
                        className="button button-danger"
                        onClick={() => setDeleteConfirmationOpen(true)}
                        type="button"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {deleteConfirmationOpen && (
                <div className="template-delete-confirm" role="alert">
                  <span>
                    Delete <strong>{activeTemplate.name}</strong>? This cannot be undone.
                  </span>
                  <div>
                    <button
                      className="button button-secondary"
                      onClick={() => setDeleteConfirmationOpen(false)}
                      type="button"
                    >
                      Keep template
                    </button>
                    <button
                      className="button button-danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(activeTemplate.id)}
                      type="button"
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete template"}
                    </button>
                  </div>
                  {deleteMutation.isError && (
                    <span className="template-action-error" role="alert">
                      {errorMessage(deleteMutation.error)}
                    </span>
                  )}
                </div>
              )}

              <div className="template-subject-row">
                <span>Subject</span>
                <strong>{activeTemplate.subject}</strong>
              </div>

              <div className="template-preview-layout">
                <section aria-labelledby="template-preview-heading" className="template-use-card">
                  <div className="template-use-heading">
                    <div>
                      <h3 id="template-preview-heading">Preview and test</h3>
                    </div>
                  </div>

                  {websitesQuery.isError && (
                    <div className="template-inline-error" role="alert">
                      Could not load websites: {errorMessage(websitesQuery.error)}
                    </div>
                  )}
                  {accountsQuery.isError && (
                    <div className="template-inline-error" role="alert">
                      Could not load your Gmail accounts: {errorMessage(accountsQuery.error)}
                    </div>
                  )}

                  <div className="template-select-grid">
                    <label className="template-field">
                      Website
                      <select
                        onChange={(event) => {
                          setWebsiteId(event.target.value);
                          setContactId("");
                          setPreview(null);
                          setSendResult(null);
                        }}
                        value={activeWebsiteId}
                      >
                        <option value="">
                          {websitesQuery.isPending
                            ? "Loading websites…"
                            : websites.length
                              ? "Select a website"
                              : "No websites available"}
                        </option>
                        {websites.map((website) => (
                          <option key={website.id} value={website.id}>
                            {website.business_name || website.domain}
                          </option>
                        ))}
                      </select>
                      {websitesQuery.isSuccess && websites.length === 0 && (
                        <span className="template-field-hint">
                          Add a website before rendering a personalized preview.
                        </span>
                      )}
                    </label>
                    <label className="template-field">
                      Contact
                      <select
                        disabled={!activeWebsiteId || contactsQuery.isPending}
                        onChange={(event) => {
                          setContactId(event.target.value);
                          setPreview(null);
                          setSendResult(null);
                        }}
                        value={contactId}
                      >
                        <option value="">Select a contact (optional)</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name || contact.business_email || "Unnamed contact"}
                            {contact.business_email ? ` · ${contact.business_email}` : ""}
                          </option>
                        ))}
                      </select>
                      {activeWebsite && contactsQuery.isSuccess && contacts.length === 0 && (
                        <span className="template-field-hint">
                          No contacts are listed for this website. You can still preview the message.
                        </span>
                      )}
                      {contactsQuery.isError && (
                        <span className="template-field-hint" role="alert">
                          Could not load contacts: {errorMessage(contactsQuery.error)}
                        </span>
                      )}
                    </label>
                    <label className="template-field template-account-field">
                      Send from
                      <select
                        disabled={accounts.length === 0}
                        onChange={(event) => {
                          setGmailAccountId(event.target.value);
                          setPreview(null);
                          setSendResult(null);
                        }}
                        value={activeGmailAccountId}
                      >
                        <option value="">
                          {accountsQuery.isPending
                            ? "Loading Gmail accounts…"
                            : accounts.length
                              ? "Select a Gmail account"
                              : "No assigned Gmail account"}
                        </option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.email_address}
                          </option>
                        ))}
                      </select>
                      {accounts.length === 0 && accountsQuery.isSuccess && (
                        <span className="template-field-hint">
                          Ask an admin to assign you a connected Gmail account.
                        </span>
                      )}
                    </label>
                  </div>

                  {selectedContact && !selectedContact.business_email && (
                    <p className="template-field-hint">
                      This contact has no business email. You can preview, but sending is unavailable.
                    </p>
                  )}
                  <div className="template-preview-actions">
                    <button
                      className="button button-primary"
                      disabled={
                        !activeWebsiteId ||
                        previewMutation.isPending ||
                        websitesQuery.isPending ||
                        contactsQuery.isPending
                      }
                      onClick={requestPreview}
                      type="button"
                    >
                      {previewMutation.isPending ? "Rendering…" : "Render preview"}
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={!canSend}
                      onClick={() => setSendConfirmationOpen(true)}
                      type="button"
                    >
                      Send email
                    </button>
                  </div>
                  {previewMutation.isError && (
                    <div className="template-inline-error" role="alert">
                      Could not render preview: {errorMessage(previewMutation.error)}
                    </div>
                  )}
                  {sendMutation.isError && (
                    <div className="template-inline-error" role="alert">
                      Email was not sent: {errorMessage(sendMutation.error)}
                    </div>
                  )}
                  {sendResult && (
                    <div className="email-template-alert email-template-alert-success" role="status">
                      {sendResult}
                    </div>
                  )}
                </section>

                <section aria-label="Rendered email preview" className="template-preview-pane">
                  {preview ? (
                    <>
                      <div className="template-rendered-preview-heading">
                        <div>
                          <p className="eyebrow">MESSAGE PREVIEW</p>
                          <h3>{preview.subject}</h3>
                        </div>
                        <span className="template-preview-badge">Personalized</span>
                      </div>
                      <iframe
                        className="template-preview-frame"
                        referrerPolicy="no-referrer"
                        sandbox=""
                        srcDoc={previewDocument}
                        title="Rendered email body preview"
                      />
                    </>
                  ) : (
                    <div className="template-preview-empty">
                      <span aria-hidden="true">✉</span>
                      <p>Select a website to preview this email.</p>
                    </div>
                  )}
                </section>
              </div>

              <details className="template-fields-disclosure">
                <summary>
                  <strong>Personalization fields</strong>
                  <span>{variablesQuery.isSuccess ? `${variables.length} available` : "View fields"}</span>
                </summary>
                {variablesQuery.isPending && (
                  <p className="template-state" role="status">Loading fields…</p>
                )}
                {variablesQuery.isError && (
                  <div className="template-inline-error" role="alert">
                    Could not load available fields: {errorMessage(variablesQuery.error)}
                  </div>
                )}
                {!variablesQuery.isPending && !variablesQuery.isError && (
                  <div className="template-available-variable-list">
                    {variables.map((variable) => (
                      <div className="template-available-variable" key={variable.path}>
                        <code>{variable.placeholder}</code>
                        <span>{variable.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>
          ) : templatesQuery.isPending ? (
            <div className="template-empty-workspace" role="status">
              <span className="template-empty-icon" aria-hidden="true">✉</span>
              <h2>Loading your templates…</h2>
            </div>
          ) : (
            <div className="template-empty-workspace">
              <span className="template-empty-icon" aria-hidden="true">✉</span>
              <p className="eyebrow">GET STARTED</p>
              <h2>Create a reusable email</h2>
              <p>
                Add a subject and HTML body, insert database-backed variables,
                then preview and send to a contact from your website records.
              </p>
              {isAdmin ? (
                <button
                  className="button button-primary"
                  onClick={startNewTemplate}
                  type="button"
                >
                  <span aria-hidden="true">＋</span> Create your first template
                </button>
              ) : (
                <p className="template-empty-note">
                  Ask an organization admin to create the first shared template.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {sendConfirmationOpen && activeTemplate && selectedContact && (
        <div className="template-modal-backdrop">
          <section
            aria-labelledby="template-send-confirm-heading"
            aria-modal="true"
            className="template-confirm-dialog"
            role="alertdialog"
          >
            <span className="template-dialog-icon" aria-hidden="true">✉</span>
            <p className="eyebrow">CONFIRM SEND</p>
            <h2 id="template-send-confirm-heading">Send this email?</h2>
            <p>
              <strong>{activeTemplate.name}</strong> will be sent to{" "}
              <strong>{selectedContact.business_email}</strong> from{" "}
              <strong>{selectedAccount?.email_address ?? "your assigned account"}</strong>.
            </p>
            <div className="template-dialog-actions">
              <button
                className="button button-secondary"
                onClick={() => setSendConfirmationOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={sendMutation.isPending}
                onClick={requestSend}
                type="button"
              >
                {sendMutation.isPending ? "Sending…" : "Send email"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function buildEmailPreviewDocument(bodyContent: string): string {
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:">',
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<style>body{margin:0;padding:24px;color:#23263a;font:14px/1.6 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>",
    `</head><body>${bodyContent}</body></html>`,
  ].join("");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
