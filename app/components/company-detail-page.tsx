"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  createCompanyContact,
  createPageSpeedScan,
  crawlCompanyWebsite,
  deleteCompanyContact,
  deleteCompany,
  getCompany,
  getCompanyContacts,
  getCompanyWebsiteCrawl,
  getPageSpeedScan,
  getWebsiteCrawlJob,
  updateCompanyContact,
  updateCompany,
  updateLeadStatus,
} from "@/lib/api";
import type {
  Company,
  CompanyUpdateInput,
  Contact,
  ContactInput,
  PageSpeedAudit,
} from "@/lib/api";
import { formatSiteType } from "@/lib/site-type";

const leadStatuses = [
  "new",
  "needs_review",
  "qualified",
  "contacted",
  "converted",
  "disqualified",
];

type ContactFormState = {
  name: string;
  role: string;
  business_email: string;
  business_phone: string;
  is_publicly_listed: boolean;
};

const emptyContactForm: ContactFormState = {
  name: "",
  role: "",
  business_email: "",
  business_phone: "",
  is_publicly_listed: false,
};

export function CompanyDetailPage({
  companyId: companyIdParam,
}: {
  companyId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [isCompanyInfoExpanded, setIsCompanyInfoExpanded] = useState(false);
  const [showRecrawlOption, setShowRecrawlOption] = useState(false);
  const [websiteCrawlJobId, setWebsiteCrawlJobId] = useState<string | null>(
    null,
  );
  const [activeCompanyInfoTab, setActiveCompanyInfoTab] = useState("about");
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(
    null,
  );
  const [contactInteractionCompanyId, setContactInteractionCompanyId] =
    useState<string | null>(null);
  const [contactForm, setContactForm] =
    useState<ContactFormState>(emptyContactForm);
  const [pageSpeedStrategy, setPageSpeedStrategy] = useState<
    "mobile" | "desktop"
  >("mobile");
  const [editingForm, setEditingForm] = useState<CompanyUpdateInput>({});
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const companyId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
    companyIdParam,
  )
    ? companyIdParam
    : null;
  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => {
      if (companyId === null) {
        throw new Error("A valid company ID is required to load this record.");
      }
      return getCompany(companyId);
    },
    enabled: companyId !== null,
  });
  const contactsQuery = useQuery({
    queryKey: ["company-contacts", companyId],
    queryFn: () => {
      if (companyId === null) {
        throw new Error("A company must be loaded before its contacts.");
      }
      return getCompanyContacts(companyId);
    },
    enabled: companyId !== null,
  });
  const websiteCrawlQuery = useQuery({
    queryKey: ["company-website-crawl", companyId],
    queryFn: () => {
      if (companyId === null) {
        throw new Error("A valid company ID is required to load indexing status.");
      }
      return getCompanyWebsiteCrawl(companyId);
    },
    enabled: companyId !== null,
  });
  const websiteCrawlJobQuery = useQuery({
    queryKey: ["website-crawl-job", websiteCrawlJobId],
    queryFn: () => {
      if (websiteCrawlJobId === null) {
        throw new Error("An indexing job must be queued before checking status.");
      }
      return getWebsiteCrawlJob(websiteCrawlJobId);
    },
    enabled: websiteCrawlJobId !== null,
  });
  const websiteCrawlMutation = useMutation({
    mutationFn: () => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be indexed.");
      }
      return crawlCompanyWebsite(companyId);
    },
    onMutate: () => setWebsiteCrawlJobId(null),
    onSuccess: (job) => {
      setWebsiteCrawlJobId(job.id);
    },
  });
  const scanQuery = useQuery({
    queryKey: ["pagespeed-scan", companyId, expandedScanId],
    queryFn: () => {
      if (expandedScanId === null || companyId === null) {
        throw new Error("Select a PageSpeed scan to view its report.");
      }
      return getPageSpeedScan(companyId, expandedScanId);
    },
    enabled: expandedScanId !== null && companyId !== null,
  });
  const pageSpeedMutation = useMutation({
    mutationFn: (strategy: "mobile" | "desktop") => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be scanned.");
      }
      return createPageSpeedScan(companyId, { strategy });
    },
    onSuccess: async (scan) => {
      if (companyId !== null) {
        queryClient.setQueryData<Company>(
          ["company", companyId],
          (currentCompany) =>
            currentCompany
              ? {
                  ...currentCompany,
                  pagespeed_scans: [scan, ...currentCompany.pagespeed_scans],
                }
              : currentCompany,
        );
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["company", companyId] }),
          queryClient.invalidateQueries({ queryKey: ["companies"] }),
        ]);
      }
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: CompanyUpdateInput) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be updated.");
      }
      return updateCompany(companyId, input);
    },
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData(["company", updatedCompany.id], updatedCompany);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
        queryClient.invalidateQueries({
          queryKey: ["company-website-crawl", updatedCompany.id],
        }),
      ]);
      setIsEditing(false);
    },
  });
  const statusMutation = useMutation({
    mutationFn: (leadStatus: string) => {
      if (companyId === null) {
        throw new Error(
          "A company must be loaded before its status can change.",
        );
      }
      return updateLeadStatus(companyId, leadStatus);
    },
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData(["company", updatedCompany.id], updatedCompany);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (companyId === null) {
        throw new Error("A company must be loaded before it can be deleted.");
      }
      return deleteCompany(companyId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      router.push("/leads");
    },
  });
  const createContactMutation = useMutation({
    mutationFn: (input: ContactInput) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before adding a contact.");
      }
      return createCompanyContact(companyId, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["company-contacts", companyId],
        }),
        queryClient.invalidateQueries({ queryKey: ["company", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      setIsContactFormOpen(false);
      setContactForm({ ...emptyContactForm });
      setContactInteractionCompanyId(null);
    },
  });
  const updateContactMutation = useMutation({
    mutationFn: ({
      contactId,
      input,
    }: {
      contactId: string;
      input: ContactInput;
    }) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before updating a contact.");
      }
      return updateCompanyContact(companyId, contactId, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["company-contacts", companyId],
        }),
        queryClient.invalidateQueries({ queryKey: ["company", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      setIsContactFormOpen(false);
      setEditingContactId(null);
      setContactForm({ ...emptyContactForm });
      setContactInteractionCompanyId(null);
    },
  });
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => {
      if (companyId === null) {
        throw new Error("A company must be loaded before deleting a contact.");
      }
      return deleteCompanyContact(companyId, contactId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["company-contacts", companyId],
        }),
        queryClient.invalidateQueries({ queryKey: ["company", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      setDeletingContactId(null);
      setContactInteractionCompanyId(null);
    },
  });
  useEffect(() => {
    const job = websiteCrawlJobQuery.data;
    if (job?.status === "succeeded" && job.result && companyId !== null) {
      queryClient.setQueryData(
        ["company-website-crawl", companyId],
        job.result,
      );
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
    }
  }, [companyId, queryClient, websiteCrawlJobQuery.data]);

  if (companyId !== null && companyQuery.isLoading) {
    return (
      <section className="company-detail-state" aria-live="polite">
        <span className="detail-state-icon" aria-hidden="true">
          ◷
        </span>
        <strong>Loading company record…</strong>
        <span>Gathering company information and related research.</span>
      </section>
    );
  }

  if (companyId === null) {
    return (
      <section className="company-detail-state">
        <span
          className="detail-state-icon detail-state-error"
          aria-hidden="true"
        >
          !
        </span>
        <strong>Company not found.</strong>
        <span>
          This company link may be out of date or the record may have been
          removed.
        </span>
        <Link className="button button-secondary" href="/leads">
          Back to company records
        </Link>
      </section>
    );
  }

  if (companyQuery.isError) {
    return (
      <section className="company-detail-state" role="alert">
        <span
          className="detail-state-icon detail-state-error"
          aria-hidden="true"
        >
          !
        </span>
        <strong>Could not load this company.</strong>
        <span>{companyQuery.error.message}</span>
        <button
          className="button button-secondary"
          onClick={() => void companyQuery.refetch()}
          type="button"
        >
          Try again
        </button>
        <Link className="text-link" href="/leads">
          Back to company records
        </Link>
      </section>
    );
  }

  const company = companyQuery.data;
  if (!company) return null;
  const contacts = contactsQuery.data ?? company.contacts;
  const contactInteractionIsCurrent = contactInteractionCompanyId === companyId;
  const isContactFormVisible =
    isContactFormOpen && contactInteractionIsCurrent;

  function startEditing(record: Company) {
    setEditingForm({
      name: record.name,
      website: record.website,
      domain: record.domain,
      industry: record.industry,
      city: record.city,
      state: record.state,
      software_need: record.software_need,
      lead_score: record.lead_score,
    });
    setIsEditing(true);
    setIsDeleteConfirmed(false);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.mutate({
      ...editingForm,
      name: editingForm.name?.trim(),
      website: cleanText(editingForm.website),
      domain: cleanText(editingForm.domain),
      industry: cleanText(editingForm.industry),
      city: cleanText(editingForm.city),
      state: cleanText(editingForm.state),
      software_need: cleanText(editingForm.software_need),
    });
  }

  function updateField<K extends keyof CompanyUpdateInput>(
    key: K,
    value: CompanyUpdateInput[K],
  ) {
    setEditingForm((current) => ({ ...current, [key]: value }));
  }

  function startContactCreation() {
    setContactInteractionCompanyId(companyId);
    setEditingContactId(null);
    setDeletingContactId(null);
    setContactForm({ ...emptyContactForm });
    setIsContactFormOpen(true);
    createContactMutation.reset();
    updateContactMutation.reset();
  }

  function startContactEditing(contact: Contact) {
    setContactInteractionCompanyId(companyId);
    setEditingContactId(contact.id);
    setDeletingContactId(null);
    setContactForm({
      name: contact.name ?? "",
      role: contact.role ?? "",
      business_email: contact.business_email ?? "",
      business_phone: contact.business_phone ?? "",
      is_publicly_listed: contact.is_publicly_listed,
    });
    setIsContactFormOpen(true);
    createContactMutation.reset();
    updateContactMutation.reset();
  }

  function cancelContactEditing() {
    setIsContactFormOpen(false);
    setEditingContactId(null);
    setContactForm({ ...emptyContactForm });
    setContactInteractionCompanyId(null);
    createContactMutation.reset();
    updateContactMutation.reset();
  }

  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: ContactInput = {
      name: cleanText(contactForm.name),
      role: cleanText(contactForm.role),
      business_email: cleanText(contactForm.business_email),
      business_phone: cleanText(contactForm.business_phone),
      is_publicly_listed: contactForm.is_publicly_listed,
    };
    if (editingContactId && contactInteractionIsCurrent) {
      updateContactMutation.mutate({
        contactId: editingContactId,
        input,
      });
    } else {
      createContactMutation.mutate(input);
    }
  }

  const location = [company.city, company.state].filter(Boolean).join(", ");
  const expandedReport =
    expandedScanId !== null && scanQuery.data?.id === expandedScanId
      ? scanQuery.data.report
      : null;
  const audits = Object.entries(expandedReport?.lighthouseResult.audits ?? {});
  const crawl =
    websiteCrawlJobQuery.data?.status === "succeeded"
      ? websiteCrawlJobQuery.data.result
      : websiteCrawlQuery.data;
  const crawlInfoTabs = crawl
    ? [
        {
          id: "home",
          label: "Home",
          url: crawl.home_page_url,
          content: crawl.home_content,
        },
        {
          id: "about",
          label: "About",
          url: crawl.about_page_url,
          content: crawl.about_content,
        },
        {
          id: "blog",
          label: "Blog",
          url: crawl.blog_page_url,
          content: crawl.blog_content,
        },
        {
          id: "service",
          label: "Services",
          url: crawl.service_page_url,
          content: crawl.service_content,
        },
        {
          id: "contact",
          label: "Contact",
          url: crawl.contact_page_url,
          content: crawl.contact_content,
        },
        {
          id: "goals",
          label: "Mission & goals",
          url: crawl.goals_page_url,
          content: crawl.goals_content,
        },
      ].filter((tab) => tab.url || tab.content)
    : [];
  const companyInfoTabs = [
    ...crawlInfoTabs,
    {
      id: "contacts",
      label: "Contacts",
      url: null,
      content: null,
    },
    {
      id: "location",
      label: "Location",
      url: null,
      content: location || "No location information recorded.",
    },
  ];
  const selectedCompanyInfoTab =
    companyInfoTabs.find((tab) => tab.id === activeCompanyInfoTab) ??
    companyInfoTabs[0];
  const isCrawlPending =
    websiteCrawlMutation.isPending ||
    websiteCrawlJobQuery.data?.status === "queued" ||
    websiteCrawlJobQuery.data?.status === "running";
  const crawlStatusLabel = isCrawlPending
    ? "Indexing…"
    : websiteCrawlQuery.isLoading
      ? "Checking…"
      : websiteCrawlQuery.isError
        ? "Status unavailable"
        : crawl
          ? "Indexed"
          : websiteCrawlMutation.isError ||
              websiteCrawlJobQuery.data?.status === "failed"
            ? "Indexing failed"
            : "Not indexed";

  return (
    <div className="company-detail-page">
      <Link className="detail-back-link" href="/leads">
        <span aria-hidden="true">←</span> Back to company records
      </Link>

      <section className="company-hero">
        <div className="company-hero-main">
          <span className="company-hero-avatar" aria-hidden="true">
            {company.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="company-hero-copy">
            <p className="eyebrow">
              COMPANY PROFILE · ADDED {formatDate(company.created_at)}
            </p>
            <div className="company-title-row">
              <h1>{company.name}</h1>
              {company.industry && (
                <span className="company-industry-badge">
                  {company.industry}
                </span>
              )}
            </div>
            <div className="company-hero-meta">
              {company.domain && (
                <a
                  href={
                    companyWebsiteHref(company.website, company.domain) ??
                    undefined
                  }
                  rel="noreferrer"
                  target="_blank"
                >
                  {company.domain}
                  <span aria-hidden="true"> ↗</span>
                </a>
              )}
              <span>
                Added by {company.created_by_email ?? "an existing account"}
              </span>
              {crawl?.site_type && (
                <span>Type: {formatSiteType(crawl.site_type)}</span>
              )}
              <span className="company-crawl-control">
                <button
                  aria-controls="company-recrawl-option"
                  aria-expanded={crawl ? showRecrawlOption : undefined}
                  className={`company-crawl-badge${
                    isCrawlPending
                      ? " is-pending"
                      : crawl
                        ? " is-success"
                        : websiteCrawlMutation.isError ||
                            websiteCrawlJobQuery.isError ||
                            websiteCrawlJobQuery.data?.status === "failed"
                          ? " is-error"
                          : ""
                  }`}
                  disabled={
                    isCrawlPending ||
                    websiteCrawlQuery.isLoading ||
                    (!company.website && !company.domain)
                  }
                  onClick={() => {
                    if (websiteCrawlQuery.isError) {
                      void websiteCrawlQuery.refetch();
                    } else if (crawl) {
                      setShowRecrawlOption((shown) => !shown);
                    } else {
                      websiteCrawlMutation.mutate();
                    }
                  }}
                  type="button"
                >
                  {crawlStatusLabel}
                  {crawl && !isCrawlPending && (
                    <span aria-hidden="true" className="company-crawl-chevron">
                      ▾
                    </span>
                  )}
                </button>
                {crawl && showRecrawlOption && (
                  <div
                    className="company-crawl-menu"
                    id="company-recrawl-option"
                    role="group"
                  >
                    <span className="company-crawl-timestamp-label">
                      Last successful indexing
                    </span>
                    <time
                      className="company-crawl-timestamp"
                      dateTime={crawl.crawled_at}
                    >
                      {formatDate(crawl.crawled_at)}
                    </time>
                    <button
                      className="company-recrawl-option"
                      disabled={isCrawlPending}
                      onClick={() => {
                        setShowRecrawlOption(false);
                        websiteCrawlMutation.mutate();
                      }}
                      type="button"
                    >
                      Re-index website
                    </button>
                  </div>
                )}
              </span>
              {websiteCrawlQuery.data?.social_links.map((socialUrl) => {
                const social = getSocialLink(socialUrl);
                if (!social) return null;

                return (
                  <a
                    aria-label={social.label}
                    className="company-social-link"
                    href={social.href}
                    key={social.href}
                    rel="noreferrer"
                    target="_blank"
                    title={social.label}
                  >
                    <SocialLinkIcon platform={social.platform} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        {selectedCompanyInfoTab && (
          <article className="company-hero-about">
            <div
              aria-label="Company website information"
              className="company-info-tabs"
              role="tablist"
            >
              {companyInfoTabs.map((tab) => (
                <button
                  aria-controls="company-info-panel"
                  aria-selected={selectedCompanyInfoTab.id === tab.id}
                  className="company-info-tab"
                  id={`company-info-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => {
                    setActiveCompanyInfoTab(tab.id);
                    setIsCompanyInfoExpanded(false);
                  }}
                  onKeyDown={(event) => {
                    const currentIndex = companyInfoTabs.findIndex(
                      (item) => item.id === tab.id,
                    );
                    let nextIndex = currentIndex;
                    if (event.key === "ArrowRight") {
                      nextIndex = (currentIndex + 1) % companyInfoTabs.length;
                    } else if (event.key === "ArrowLeft") {
                      nextIndex =
                        (currentIndex - 1 + companyInfoTabs.length) %
                        companyInfoTabs.length;
                    } else if (event.key === "Home") {
                      nextIndex = 0;
                    } else if (event.key === "End") {
                      nextIndex = companyInfoTabs.length - 1;
                    } else {
                      return;
                    }
                    event.preventDefault();
                    const nextTab = companyInfoTabs[nextIndex];
                    setActiveCompanyInfoTab(nextTab.id);
                    setIsCompanyInfoExpanded(false);
                    document
                      .getElementById(`company-info-tab-${nextTab.id}`)
                      ?.focus();
                  }}
                  role="tab"
                  type="button"
                  tabIndex={selectedCompanyInfoTab.id === tab.id ? 0 : -1}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {selectedCompanyInfoTab.url && (
              <div className="company-hero-about-heading">
                <a
                  href={selectedCompanyInfoTab.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open {selectedCompanyInfoTab.label} page{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
            <div
              aria-labelledby={`company-info-tab-${selectedCompanyInfoTab.id}`}
              className="company-info-panel"
              id="company-info-panel"
              role="tabpanel"
              tabIndex={0}
            >
              {selectedCompanyInfoTab.id === "contacts" ? (
                <section aria-label="Manage company contacts">
                  <div className="company-contact-toolbar">
                    <p>
                      {contacts.length} saved{" "}
                      {contacts.length === 1 ? "contact" : "contacts"}
                    </p>
                    <button
                      className="button button-secondary"
                      onClick={startContactCreation}
                      type="button"
                    >
                      <span aria-hidden="true">＋</span> Add contact
                    </button>
                  </div>

                  {contactsQuery.isLoading && (
                    <p className="company-info-empty" role="status">
                      Loading contacts…
                    </p>
                  )}
                  {contactsQuery.isError && (
                    <div className="alert alert-error" role="alert">
                      Could not load contacts: {contactsQuery.error.message}
                      <button
                        className="button button-secondary"
                        onClick={() => void contactsQuery.refetch()}
                        type="button"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {createContactMutation.isError && (
                    <div className="alert alert-error" role="alert">
                      Could not add contact: {createContactMutation.error.message}
                    </div>
                  )}
                  {updateContactMutation.isError && (
                    <div className="alert alert-error" role="alert">
                      Could not update contact: {updateContactMutation.error.message}
                    </div>
                  )}
                  {deleteContactMutation.isError && (
                    <div className="alert alert-error" role="alert">
                      Could not delete contact: {deleteContactMutation.error.message}
                    </div>
                  )}

                  {isContactFormVisible && (
                    <form
                      className="contact-management-form"
                      onSubmit={handleContactSubmit}
                    >
                      <div className="contact-management-form-heading">
                        <strong>
                          {editingContactId ? "Edit contact" : "Add a contact"}
                        </strong>
                        <span>
                          Add at least a name, role, email address, or phone number.
                        </span>
                      </div>
                      <div className="contact-management-fields">
                        <label className="contact-management-field">
                          Name
                          <input
                            autoComplete="name"
                            maxLength={200}
                            onChange={(event) =>
                              setContactForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            value={contactForm.name}
                          />
                        </label>
                        <label className="contact-management-field">
                          Role
                          <input
                            autoComplete="organization-title"
                            maxLength={150}
                            onChange={(event) =>
                              setContactForm((current) => ({
                                ...current,
                                role: event.target.value,
                              }))
                            }
                            value={contactForm.role}
                          />
                        </label>
                        <label className="contact-management-field">
                          Business email
                          <input
                            autoComplete="email"
                            maxLength={320}
                            onChange={(event) =>
                              setContactForm((current) => ({
                                ...current,
                                business_email: event.target.value,
                              }))
                            }
                            type="email"
                            value={contactForm.business_email}
                          />
                        </label>
                        <label className="contact-management-field">
                          Business phone
                          <input
                            autoComplete="tel"
                            maxLength={50}
                            onChange={(event) =>
                              setContactForm((current) => ({
                                ...current,
                                business_phone: event.target.value,
                              }))
                            }
                            type="tel"
                            value={contactForm.business_phone}
                          />
                        </label>
                      </div>
                      <label className="contact-public-checkbox">
                        <input
                          checked={contactForm.is_publicly_listed}
                          onChange={(event) =>
                            setContactForm((current) => ({
                              ...current,
                              is_publicly_listed: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                        This contact information is publicly listed
                      </label>
                      <div className="contact-management-actions">
                        <button
                          className="button button-primary"
                          disabled={
                            createContactMutation.isPending ||
                            updateContactMutation.isPending ||
                            !(
                              contactForm.name.trim() ||
                              contactForm.role.trim() ||
                              contactForm.business_email.trim() ||
                              contactForm.business_phone.trim()
                            )
                          }
                          type="submit"
                        >
                          {createContactMutation.isPending ||
                          updateContactMutation.isPending
                            ? "Saving…"
                            : editingContactId
                              ? "Save contact"
                              : "Add contact"}
                        </button>
                        <button
                          className="button button-secondary"
                          onClick={cancelContactEditing}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {contacts.length === 0 ? (
                    <p className="company-info-empty">
                      No contacts have been added to this company yet.
                    </p>
                  ) : (
                    <div className="company-info-contacts">
                      {(isCompanyInfoExpanded ? contacts : contacts.slice(0, 5)).map(
                        (contact) => (
                          <article
                            className="detail-record-card"
                            key={contact.id}
                          >
                            <span className="contact-avatar" aria-hidden="true">
                              {(contact.name ?? "?").slice(0, 1).toUpperCase()}
                            </span>
                            <div className="contact-card-content">
                              <strong>
                                {contact.name || "Unnamed contact"}
                              </strong>
                              <span>{contact.role || "Role not provided"}</span>
                              <div className="contact-links">
                                {contact.business_email && (
                                  <a href={`mailto:${contact.business_email}`}>
                                    {contact.business_email}
                                  </a>
                                )}
                                {contact.business_phone && (
                                  <a href={`tel:${contact.business_phone}`}>
                                    {contact.business_phone}
                                  </a>
                                )}
                              </div>
                            </div>
                            <span
                              className={`public-label${contact.is_publicly_listed ? "" : " not-public"}`}
                            >
                              {contact.is_publicly_listed
                                ? "Publicly listed"
                                : "Not confirmed public"}
                            </span>
                            <div className="contact-card-actions">
                              {contactInteractionIsCurrent &&
                              deletingContactId === contact.id ? (
                                <>
                                  <span>Delete this contact?</span>
                                  <button
                                    className="contact-action-button"
                                    onClick={() => setDeletingContactId(null)}
                                    type="button"
                                  >
                                    Keep
                                  </button>
                                  <button
                                    className="contact-action-button is-danger"
                                    disabled={deleteContactMutation.isPending}
                                    onClick={() =>
                                      deleteContactMutation.mutate(contact.id)
                                    }
                                    type="button"
                                  >
                                    {deleteContactMutation.isPending
                                      ? "Deleting…"
                                      : "Confirm"}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="contact-action-button"
                                    onClick={() => startContactEditing(contact)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="contact-action-button is-danger"
                                    onClick={() => {
                                      setContactInteractionCompanyId(companyId);
                                      deleteContactMutation.reset();
                                      setDeletingContactId(contact.id)
                                    }}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  )}
                </section>
              ) : (
                <p
                  className={
                    (selectedCompanyInfoTab.content?.length ?? 0) > 240 &&
                    !isCompanyInfoExpanded
                      ? "is-collapsed"
                      : "is-expanded"
                  }
                >
                  {selectedCompanyInfoTab.content ||
                    "No page text was extracted."}
                </p>
              )}
            </div>
            {((selectedCompanyInfoTab.id === "contacts" &&
                contacts.length > 5) ||
                (selectedCompanyInfoTab.content?.length ?? 0) > 240) && (
                <button
                  aria-expanded={isCompanyInfoExpanded}
                  className="company-hero-about-toggle"
                  onClick={() =>
                    setIsCompanyInfoExpanded((expanded) => !expanded)
                  }
                  type="button"
                >
                  {isCompanyInfoExpanded ? "Show less" : "Show more"}
                </button>
            )}
          </article>
        )}
        <div className="company-hero-actions">
          <label className="detail-status-control">
            <span className="sr-only">Lead status</span>
            <select
              aria-label={`Change lead status for ${company.name}`}
              className="detail-status-select"
              disabled={statusMutation.isPending}
              onChange={(event) => statusMutation.mutate(event.target.value)}
              value={company.lead_status}
            >
              {!leadStatuses.includes(company.lead_status) && (
                <option value={company.lead_status}>
                  {company.lead_status.replaceAll("_", " ")}
                </option>
              )}
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            onClick={() => startEditing(company)}
            type="button"
          >
            Edit company
          </button>
        </div>
      </section>

      {websiteCrawlQuery.isError && (
        <div className="alert alert-error" role="alert">
          Could not load website indexing status: {websiteCrawlQuery.error.message}
          <button
            className="text-button"
            onClick={() => void websiteCrawlQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      {statusMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not update lead status: {statusMutation.error.message}
        </div>
      )}
      {updateMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not save company changes: {updateMutation.error.message}
        </div>
      )}
      {deleteMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not delete company: {deleteMutation.error.message}
        </div>
      )}
      {websiteCrawlMutation.isError && (
        <div className="alert alert-error" role="alert">
          Could not index {company.name}&apos;s website:{" "}
          {websiteCrawlMutation.error.message}
        </div>
      )}
      {websiteCrawlJobQuery.isError && (
        <div className="alert alert-error" role="alert">
          Could not check indexing status: {websiteCrawlJobQuery.error.message}
        </div>
      )}
      {websiteCrawlJobQuery.data?.status === "failed" && (
        <div className="alert alert-error" role="alert">
          Could not index {company.name}&apos;s website:{" "}
          {websiteCrawlJobQuery.data.error || "The indexing job failed."}
        </div>
      )}
      <div className="company-detail-layout">
        <main className="company-detail-main">
          {isEditing && (
            <section className="panel detail-section">
              <div className="detail-section-heading">
                <span className="section-icon violet" aria-hidden="true">
                  ▤
                </span>
                <div>
                  <h2>Edit company details</h2>
                  <p>Update company profile information</p>
                </div>
              </div>
              <form
                className="company-form detail-edit-form"
                onSubmit={handleSave}
              >
                <div className="form-row">
                  <label>
                    Company name <span>*</span>
                    <input
                      maxLength={200}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      required
                      value={editingForm.name ?? ""}
                    />
                  </label>
                  <label>
                    Website
                    <input
                      onChange={(event) =>
                        updateField("website", event.target.value)
                      }
                      placeholder="https://example.com"
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
                        updateField("industry", event.target.value)
                      }
                      value={editingForm.industry ?? ""}
                    />
                  </label>
                  <label>
                    Domain
                    <input
                      onChange={(event) =>
                        updateField("domain", event.target.value)
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
                        updateField("city", event.target.value)
                      }
                      value={editingForm.city ?? ""}
                    />
                  </label>
                  <label>
                    State / region
                    <input
                      onChange={(event) =>
                        updateField("state", event.target.value)
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
                        updateField("software_need", event.target.value)
                      }
                      rows={4}
                      value={editingForm.software_need ?? ""}
                    />
                  </label>
                  <label>
                    Lead score
                    <input
                      min={0}
                      onChange={(event) =>
                        updateField(
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
                <div className="detail-form-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-primary"
                    disabled={updateMutation.isPending}
                    type="submit"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          )}

        </main>

        <aside className="company-detail-aside">
          <RecordSection
            title="PageSpeed insights"
            subtitle="Website performance and quality"
            icon="◷"
            count={company.pagespeed_scans.length}
            empty="No PageSpeed reports are available yet."
            beforeContent={
              <>
                <div className="pagespeed-scan-controls">
                  <label>
                    <span className="sr-only">PageSpeed scan strategy</span>
                    <select
                      aria-label="PageSpeed scan strategy"
                      disabled={pageSpeedMutation.isPending}
                      onChange={(event) =>
                        setPageSpeedStrategy(
                          event.target.value === "desktop"
                            ? "desktop"
                            : "mobile",
                        )
                      }
                      value={pageSpeedStrategy}
                    >
                      <option value="mobile">Mobile</option>
                      <option value="desktop">Desktop</option>
                    </select>
                  </label>
                  <button
                    className="button button-primary"
                    disabled={
                      pageSpeedMutation.isPending ||
                      !(company.website || company.domain)
                    }
                    onClick={() => pageSpeedMutation.mutate(pageSpeedStrategy)}
                    type="button"
                  >
                    {pageSpeedMutation.isPending
                      ? "Scanning…"
                      : company.pagespeed_scans.some(
                            (scan) => scan.strategy === pageSpeedStrategy,
                          )
                        ? "Re-scan"
                        : "Scan website"}
                  </button>
                </div>
                {!(company.website || company.domain) && (
                  <p className="record-empty pagespeed-scan-hint">
                    Add a website or domain to enable PageSpeed scans.
                  </p>
                )}
                {pageSpeedMutation.isError && (
                  <p className="pagespeed-error" role="alert">
                    Could not scan website: {pageSpeedMutation.error.message}
                  </p>
                )}
              </>
            }
          >
            {company.pagespeed_scans.map((scan) => {
              const isExpanded = expandedScanId === scan.id;
              return (
                <article className="pagespeed-card" key={scan.id}>
                  <div className="pagespeed-card-heading">
                    <strong>{scan.strategy} scan</strong>
                    <span>{formatDate(scan.scanned_at)}</span>
                  </div>
                  <a href={scan.website_url} rel="noreferrer" target="_blank">
                    {scan.website_url}
                  </a>
                  <div className="pagespeed-card-scores">
                    {[
                      ["Performance", "performance"],
                      ["Accessibility", "accessibility"],
                      ["Best practices", "best-practices"],
                      ["SEO", "seo"],
                    ].map(([label, category]) => {
                      const score = scan.category_scores[category];
                      return (
                        <div key={category}>
                          <span>{label}</span>
                          <strong>
                            {score === null || score === undefined
                              ? "—"
                              : `${score}/100`}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="text-button pagespeed-toggle"
                    onClick={() =>
                      setExpandedScanId(isExpanded ? null : scan.id)
                    }
                    type="button"
                  >
                    {isExpanded
                      ? "Hide detailed audits"
                      : "View detailed audits"}
                    <span aria-hidden="true">{isExpanded ? " ↑" : " ↓"}</span>
                  </button>
                  {isExpanded && scanQuery.isPending && (
                    <p className="record-empty">
                      Loading Lighthouse audit details…
                    </p>
                  )}
                  {isExpanded && scanQuery.isError && (
                    <p className="pagespeed-error" role="alert">
                      {scanQuery.error.message}
                    </p>
                  )}
                  {isExpanded && expandedReport && (
                    <div className="pagespeed-audits">
                      <p>
                        Lighthouse{" "}
                        {expandedReport.lighthouseResult.lighthouseVersion ??
                          "version unavailable"}
                      </p>
                      {audits.map(([id, audit]) => (
                        <AuditItem audit={audit} key={id} />
                      ))}
                      {audits.length === 0 && (
                        <p className="record-empty">
                          No detailed Lighthouse audits were included.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </RecordSection>

          <section className="panel detail-danger-zone">
            <div className="detail-section-heading">
              <span className="section-icon danger" aria-hidden="true">
                !
              </span>
              <div>
                <h2>Remove company</h2>
                <p>Delete this record and its related data</p>
              </div>
            </div>
            {isDeleteConfirmed ? (
              <div className="delete-confirm-panel">
                <p>
                  This will permanently delete {company.name} and its related
                  records.
                </p>
                <div>
                  <button
                    className="button button-secondary"
                    onClick={() => setIsDeleteConfirmed(false)}
                    type="button"
                  >
                    Keep company
                  </button>
                  <button
                    className="button button-danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    type="button"
                  >
                    {deleteMutation.isPending
                      ? "Deleting…"
                      : "Delete permanently"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button button-danger-outline"
                onClick={() => setIsDeleteConfirmed(true)}
                type="button"
              >
                Delete company
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

type SocialPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "x"
  | "youtube"
  | "generic";

function getSocialLink(value: string): {
  href: string;
  label: string;
  platform: SocialPlatform;
} | null {
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    const platform: SocialPlatform = hostname.includes("facebook.com")
      ? "facebook"
      : hostname.includes("instagram.com")
        ? "instagram"
        : hostname.includes("linkedin.com")
          ? "linkedin"
          : hostname.includes("tiktok.com")
            ? "tiktok"
            : hostname === "x.com" || hostname.includes("twitter.com")
              ? "x"
              : hostname.includes("youtube.com") || hostname === "youtu.be"
                ? "youtube"
                : "generic";
    const labels: Record<SocialPlatform, string> = {
      facebook: "Facebook",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      tiktok: "TikTok",
      x: "X",
      youtube: "YouTube",
      generic: hostname,
    };

    return { href: url.href, label: labels[platform], platform };
  } catch {
    return null;
  }
}

function SocialLinkIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <rect
          height="16"
          rx="5"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          x="4"
          y="4"
        />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M21 7.2a2.8 2.8 0 0 0-2-2C17.2 4.7 12 4.7 12 4.7s-5.2 0-7 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.5 12a29 29 0 0 0 .5 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7 .5 7 .5s5.2 0 7-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .5-4.8 29 29 0 0 0-.5-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (platform === "generic") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.7-1.7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  const glyphs: Record<
    Exclude<SocialPlatform, "instagram" | "youtube" | "generic">,
    string
  > = {
    facebook: "f",
    linkedin: "in",
    tiktok: "♪",
    x: "X",
  };
  return <span aria-hidden="true">{glyphs[platform]}</span>;
}

function RecordSection({
  title,
  subtitle,
  icon,
  count,
  empty,
  beforeContent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  count: number;
  empty: string;
  beforeContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel detail-section">
      <div className="detail-section-heading">
        <span className="section-icon violet" aria-hidden="true">
          {icon}
        </span>
        <div className="detail-section-title">
          <h2>
            {title}
            <span>{count}</span>
          </h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {beforeContent}
      {count === 0 ? <p className="detail-empty">{empty}</p> : children}
    </section>
  );
}

function AuditItem({ audit }: { audit: PageSpeedAudit }) {
  return (
    <div className="pagespeed-audit">
      <strong>{audit.title ?? "Unnamed audit"}</strong>
      {audit.description && <p>{audit.description}</p>}
      {audit.displayValue && <span>{audit.displayValue}</span>}
    </div>
  );
}

function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function companyWebsiteHref(
  website: string | null,
  domain: string | null,
): string | null {
  const value = website?.trim() || domain?.trim();
  if (!value) return null;

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
