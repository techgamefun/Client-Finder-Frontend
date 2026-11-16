"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getAssignedGmailAccounts,
  getAuthSession,
  getCompanies,
  getEmailTemplateVariables,
  getEmailTemplates,
  previewEmailTemplate,
  sendEmailTemplate,
  updateEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
} from "@/lib/api";

const emptyDraft: EmailTemplateInput = {
  name: "",
  subject: "",
  body_content: "",
};

export function EmailTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldCreateFromQuery = searchParams.get("create") === "1";
  const queryClient = useQueryClient();
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<EmailTemplateInput>(emptyDraft);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [gmailAccountId, setGmailAccountId] = useState("");
  const [preview, setPreview] = useState<{
    subject: string;
    body_content: string;
  } | null>(null);
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

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
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const accountsQuery = useQuery({
    queryKey: ["gmail-assigned-accounts"],
    queryFn: getAssignedGmailAccounts,
    enabled: Boolean(organizationId),
    retry: false,
  });

  const templates = templatesQuery.data ?? [];
  const activeTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates[0] ??
    null;
  const companies = companiesQuery.data ?? [];
  const activeCompanyId = companyId;
  const activeCompany = companies.find(
    (company) => company.id === activeCompanyId,
  );
  const contacts = activeCompany?.contacts ?? [];
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
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({
        queryKey: ["email-templates", organizationId],
      });
      setSelectedTemplateId(template.id);
      setEditingTemplateId(null);
      setEditorOpen(false);
      setPreview(null);
      setSendResult(null);
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
    },
  });
  const previewMutation = useMutation({
    mutationFn: ({
      templateId,
      selectedCompanyId,
      selectedContactId,
      selectedGmailAccountId,
    }: {
      templateId: string;
      selectedCompanyId: string;
      selectedContactId: string;
      selectedGmailAccountId: string;
    }) =>
      previewEmailTemplate(organizationId, templateId, {
        company_id: selectedCompanyId,
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
      selectedCompanyId,
      selectedContactId,
      selectedGmailAccountId,
    }: {
      templateId: string;
      selectedCompanyId: string;
      selectedContactId: string;
      selectedGmailAccountId: string;
    }) =>
      sendEmailTemplate(organizationId, templateId, {
        company_id: selectedCompanyId,
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
    setPreview(null);
    setSendResult(null);
    setDeleteConfirmationOpen(false);
    previewMutation.reset();
    sendMutation.reset();
  }

  const startNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setDraft({ ...emptyDraft });
    setEditorOpen(true);
    setPreview(null);
    setSendResult(null);
    resetSaveMutation();
  }, [resetSaveMutation]);

  useEffect(() => {
    if (!shouldCreateFromQuery || sessionQuery.isPending) return;
    if (isAdmin) {
      window.requestAnimationFrame(startNewTemplate);
    }
    router.replace("/templates", { scroll: false });
  }, [
    isAdmin,
    router,
    sessionQuery.isPending,
    shouldCreateFromQuery,
    startNewTemplate,
  ]);

  function startEditingTemplate(template: EmailTemplate) {
    setEditingTemplateId(template.id);
    setDraft({
      name: template.name,
      subject: template.subject,
      body_content: template.body_content,
    });
    setEditorOpen(true);
    setPreview(null);
    setSendResult(null);
    saveMutation.reset();
  }

  function cancelEditing() {
    setEditorOpen(false);
    setEditingTemplateId(null);
    setDraft({ ...emptyDraft });
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
    if (!activeTemplate || !activeCompanyId) return;
    setPreview(null);
    setSendResult(null);
    previewMutation.mutate({
      templateId: activeTemplate.id,
      selectedCompanyId: activeCompanyId,
      selectedContactId: contactId,
      selectedGmailAccountId: activeGmailAccountId,
    });
  }

  function requestSend() {
    if (!activeTemplate || !activeCompanyId || !contactId || !activeGmailAccountId) {
      return;
    }
    sendMutation.mutate({
      templateId: activeTemplate.id,
      selectedCompanyId: activeCompanyId,
      selectedContactId: contactId,
      selectedGmailAccountId: activeGmailAccountId,
    });
  }

  const variables = variablesQuery.data ?? [];
  const variableGroups = ["company", "contact", "sender"].map((group) => ({
    group,
    items: variables.filter((variable) => variable.path.startsWith(`${group}.`)),
  }));
  const previewDocument = preview
    ? [
        "<!doctype html><html><head><meta charset=\"utf-8\">",
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:">',
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        "<style>body{margin:0;padding:24px;color:#23263a;font:14px/1.6 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>",
        `</head><body>${preview.body_content}</body></html>`,
      ].join("")
    : "";
  const canSend =
    Boolean(
      activeTemplate &&
        activeCompanyId &&
        contactId &&
        selectedContact?.business_email &&
        activeGmailAccountId &&
        preview,
    ) &&
    !sendMutation.isPending;

  return (
    <div className="email-templates-page">
      <header className="email-templates-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE / OUTREACH</p>
          <h1>Email templates</h1>
          <p className="heading-copy">
            Build reusable messages from your company, contact, and sender
            records, then preview and send through a shared Gmail account.
          </p>
        </div>
      </header>

      {sessionQuery.isError && (
        <div className="email-template-alert email-template-alert-error" role="alert">
          Could not load your workspace: {errorMessage(sessionQuery.error)}
        </div>
      )}

      <div className="email-template-layout">
        <aside aria-label="Email template library" className="panel template-library">
          <div className="template-library-heading">
            <div>
              <p className="eyebrow">LIBRARY</p>
              <h2>Templates</h2>
            </div>
            <span className="template-count">{templates.length}</span>
          </div>

          {templatesQuery.isPending && (
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
          <div className="template-library-footnote">
            <span className="template-status-dot" />
            Shared with your organization
          </div>
        </aside>

        <section aria-label="Selected email template" className="panel template-workspace">
          {editorOpen ? (
            <div className="template-editor">
              <div className="template-section-heading">
                <div>
                  <p className="eyebrow">{editingTemplateId ? "EDIT TEMPLATE" : "NEW TEMPLATE"}</p>
                  <h2>{editingTemplateId ? "Update your message" : "Create a template"}</h2>
                  <p className="panel-subtitle">
                    Add HTML content and insert database fields where they
                    should appear in each email.
                  </p>
                </div>
              </div>

              {!isAdmin && (
                <div className="email-template-alert email-template-alert-error" role="alert">
                  Only organization admins can create or edit templates.
                </div>
              )}

              <form className="template-form" onSubmit={saveTemplate}>
                <label className="template-field">
                  Template name
                  <input
                    autoComplete="off"
                    maxLength={200}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    placeholder="e.g. First-touch introduction"
                    required
                    value={draft.name}
                  />
                </label>
                <label className="template-field">
                  Subject
                  <input
                    maxLength={998}
                    onChange={(event) => updateDraft("subject", event.target.value)}
                    placeholder="A short, relevant subject"
                    ref={subjectInputRef}
                    required
                    value={draft.subject}
                  />
                </label>
                <label className="template-field">
                  HTML email body
                  <textarea
                    className="template-body-input"
                    maxLength={200_000}
                    onChange={(event) => updateDraft("body_content", event.target.value)}
                    placeholder={"<p>Hi {{ contact.first_name | default(\"there\") }},</p>\n<p>I noticed {{ company.name }}...</p>"}
                    ref={bodyInputRef}
                    required
                    rows={12}
                    value={draft.body_content}
                  />
                  <span className="template-field-hint">
                    HTML is supported. Dynamic values are escaped when rendered.
                  </span>
                </label>

                <div className="template-variable-inserter">
                  <div className="template-variable-heading">
                    <div>
                      <strong>Insert a variable</strong>
                      <span>Choose a field to add it at the cursor.</span>
                    </div>
                    {variablesQuery.isError && (
                      <span className="template-variable-error" role="alert">
                        {errorMessage(variablesQuery.error)}
                      </span>
                    )}
                  </div>
                  {variablesQuery.isPending ? (
                    <p className="template-state">Loading available fields…</p>
                  ) : (
                    <div className="template-variable-groups">
                      {variableGroups.map(({ group, items }) => (
                        <div className="template-variable-group" key={group}>
                          <span>{group}</span>
                          <div className="template-variable-rows">
                            {items.map((variable) => (
                              <div className="template-variable-row" key={variable.path}>
                                <span>
                                  <code>{variable.path}</code>
                                  <small>{variable.label}</small>
                                </span>
                                <div>
                                  <button
                                    aria-label={`Insert ${variable.path} into the subject`}
                                    className="template-variable-action"
                                    onClick={() => insertVariable("subject", variable.placeholder)}
                                    title={`${variable.description} (subject)`}
                                    type="button"
                                  >
                                    Subject
                                  </button>
                                  <button
                                    aria-label={`Insert ${variable.path} into the email body`}
                                    className="template-variable-action"
                                    onClick={() => insertVariable("body_content", variable.placeholder)}
                                    title={`${variable.description} (body)`}
                                    type="button"
                                  >
                                    Body
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="template-variable-key">
                    Choose where each placeholder should be inserted.
                  </p>
                </div>

                <div className="template-form-actions">
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
                        : "Create template"}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={cancelEditing}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
                {saveMutation.isError && (
                  <div className="email-template-alert email-template-alert-error" role="alert">
                    Could not save this template: {errorMessage(saveMutation.error)}
                  </div>
                )}
              </form>
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
          ) : activeTemplate ? (
            <div className="template-detail-view">
              <div className="template-section-heading template-detail-heading">
                <div>
                  <p className="eyebrow">SHARED TEMPLATE</p>
                  <h2>{activeTemplate.name}</h2>
                  <p className="panel-subtitle">
                    Updated {formatDate(activeTemplate.updated_at)}
                  </p>
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

              <div className="template-subject-card">
                <span>SUBJECT</span>
                <strong>{activeTemplate.subject}</strong>
              </div>

              <div className="template-use-grid">
                <section aria-labelledby="template-preview-heading" className="template-use-card">
                  <div className="template-use-heading">
                    <div>
                      <span className="template-step-number">01</span>
                      <div>
                        <h3 id="template-preview-heading">Choose who to write to</h3>
                        <p>Preview the message with real organization data.</p>
                      </div>
                    </div>
                  </div>

                  {companiesQuery.isError && (
                    <div className="template-inline-error" role="alert">
                      Could not load companies: {errorMessage(companiesQuery.error)}
                    </div>
                  )}
                  {accountsQuery.isError && (
                    <div className="template-inline-error" role="alert">
                      Could not load your Gmail accounts: {errorMessage(accountsQuery.error)}
                    </div>
                  )}

                  <div className="template-select-grid">
                    <label className="template-field">
                      Company
                      <select
                        onChange={(event) => {
                          setCompanyId(event.target.value);
                          setContactId("");
                          setPreview(null);
                          setSendResult(null);
                        }}
                        value={activeCompanyId}
                      >
                        <option value="">Select a company</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="template-field">
                      Contact
                      <select
                        disabled={!activeCompanyId}
                        onChange={(event) => {
                          setContactId(event.target.value);
                          setPreview(null);
                          setSendResult(null);
                        }}
                        value={contactId}
                      >
                        <option value="">No contact (preview only)</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name || contact.business_email || "Unnamed contact"}
                            {contact.business_email ? ` · ${contact.business_email}` : ""}
                          </option>
                        ))}
                      </select>
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
                        <option value="">No assigned Gmail account</option>
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
                        !activeCompanyId ||
                        previewMutation.isPending ||
                        companiesQuery.isPending
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

                <section aria-labelledby="template-fields-heading" className="template-use-card template-available-fields">
                  <div className="template-use-heading">
                    <div>
                      <span className="template-step-number">02</span>
                      <div>
                        <h3 id="template-fields-heading">Available fields</h3>
                        <p>Values are resolved from company, contact, and sender records.</p>
                      </div>
                    </div>
                  </div>
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
                </section>
              </div>

              {preview && (
                <section aria-label="Rendered email preview" className="template-rendered-preview">
                  <div className="template-rendered-preview-heading">
                    <div>
                      <p className="eyebrow">RENDERED MESSAGE</p>
                      <h3>{preview.subject}</h3>
                    </div>
                    <span className="template-preview-badge">Preview</span>
                  </div>
                  <iframe
                    className="template-preview-frame"
                    referrerPolicy="no-referrer"
                    sandbox=""
                    srcDoc={previewDocument}
                    title="Rendered email body preview"
                  />
                </section>
              )}
            </div>
          ) : (
            <div className="template-empty-workspace">
              <span className="template-empty-icon" aria-hidden="true">✉</span>
              <p className="eyebrow">GET STARTED</p>
              <h2>Create a reusable email</h2>
              <p>
                Add a subject and HTML body, insert database-backed variables,
                then preview and send to a contact from your company records.
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
