"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  composeGmailMessage,
  getAuthSession,
  getAssignedGmailAccounts,
  getGoogleGmailAuthorizationUrl,
  getGmailLabels,
  getGmailMessage,
  getGmailMessages,
  replyToGmailMessage,
  type GmailLabel,
} from "@/lib/api";

const PAGE_SIZE = 25;

export function GmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenCompose = searchParams.get("compose") === "1";
  const gmailStatus = searchParams.get("gmail");
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState("INBOX");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [replyBody, setReplyBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSent, setComposeSent] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const canConnectAccount = sessionQuery.data?.user.role === "user";
  const accountsQuery = useQuery({
    queryKey: ["gmail-assigned-accounts"],
    queryFn: getAssignedGmailAccounts,
    retry: false,
  });
  const accounts = accountsQuery.data ?? [];
  const activeAccountId =
    selectedAccountId || accounts[0]?.id || "";
  const pageToken = pageTokens[pageIndex] ?? null;

  const composeMutation = useMutation({
    mutationFn: () =>
      composeGmailMessage(activeAccountId, {
        to: splitRecipients(composeTo),
        cc: splitRecipients(composeCc),
        bcc: splitRecipients(composeBcc),
        subject: composeSubject.trim(),
        body_text: composeBody.trim(),
      }),
    onSuccess: async () => {
      setComposeOpen(false);
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject("");
      setComposeBody("");
      setComposeSent(true);
      await queryClient.invalidateQueries({
        queryKey: ["gmail-messages", activeAccountId],
      });
    },
  });
  const labelsQuery = useQuery({
    queryKey: ["gmail-labels", activeAccountId],
    queryFn: () => getGmailLabels(activeAccountId),
    enabled: Boolean(activeAccountId),
    retry: false,
  });
  const messagesQuery = useQuery({
    queryKey: [
      "gmail-messages",
      activeAccountId,
      selectedLabelId,
      appliedSearch,
      pageToken,
    ],
    queryFn: () =>
      getGmailMessages(activeAccountId, {
        label_id: selectedLabelId,
        q: appliedSearch || undefined,
        page_token: pageToken ?? undefined,
        max_results: PAGE_SIZE,
      }),
    enabled: Boolean(activeAccountId),
    retry: false,
  });
  const messageQuery = useQuery({
    queryKey: ["gmail-message", activeAccountId, selectedMessageId],
    queryFn: () => getGmailMessage(activeAccountId, selectedMessageId),
    enabled: Boolean(activeAccountId && selectedMessageId),
    retry: false,
  });
  const replyMutation = useMutation({
    mutationFn: () =>
      replyToGmailMessage(
        activeAccountId,
        selectedMessageId,
        replyBody.trim(),
      ),
    onSuccess: async () => {
      setReplyBody("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["gmail-messages", activeAccountId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["gmail-message", activeAccountId, selectedMessageId],
        }),
      ]);
    },
  });

  function resetInboxPaging() {
    setPageTokens([null]);
    setPageIndex(0);
    setSelectedMessageId("");
    setReplyBody("");
  }

  function selectAccount(accountId: string) {
    setSelectedAccountId(accountId);
    setSelectedLabelId("INBOX");
    setComposeSent(false);
    replyMutation.reset();
    resetInboxPaging();
  }

  function selectMailbox(labelId: string) {
    setSelectedLabelId(labelId);
    setComposeSent(false);
    resetInboxPaging();
  }

  function searchInbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchDraft.trim());
    resetInboxPaging();
  }

  function clearSearch() {
    setSearchDraft("");
    setAppliedSearch("");
    resetInboxPaging();
  }

  function goToNextPage() {
    const nextPageToken = messagesQuery.data?.next_page_token;
    if (!nextPageToken) return;
    setPageTokens((current) => [
      ...current.slice(0, pageIndex + 1),
      nextPageToken,
    ]);
    setPageIndex((current) => current + 1);
    setSelectedMessageId("");
    setReplyBody("");
  }

  function goToPreviousPage() {
    if (pageIndex === 0) return;
    setPageIndex((current) => current - 1);
    setSelectedMessageId("");
    setReplyBody("");
  }

  function selectMessage(messageId: string) {
    setSelectedMessageId(messageId);
    setReplyBody("");
    replyMutation.reset();
  }

  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replyBody.trim() || replyMutation.isPending) return;
    replyMutation.mutate();
  }

  function sendComposedMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    composeMutation.reset();
    if (!activeAccountId || composeMutation.isPending) return;
    composeMutation.mutate();
  }

  function openCompose() {
    composeMutation.reset();
    setComposeSent(false);
    setComposeOpen(true);
  }

  function closeCompose() {
    if (composeMutation.isPending) return;
    setComposeOpen(false);
    composeMutation.reset();
  }

  useEffect(() => {
    if (!shouldOpenCompose) return;
    window.requestAnimationFrame(() => {
      setComposeSent(false);
      setComposeOpen(true);
    });
    router.replace("/gmail", { scroll: false });
  }, [router, shouldOpenCompose]);

  const selectedAccount = accounts.find(
    (account) => account.id === activeAccountId,
  );
  const currentLabelName =
    selectedLabelId === "INBOX"
      ? "Inbox"
      : selectedLabelId === "SPAM"
        ? "Spam"
        : (labelsQuery.data?.find((label) => label.id === selectedLabelId)
            ?.name ?? "Label");
  const otherLabels =
    labelsQuery.data?.filter(
      (label) => label.id !== "INBOX" && label.id !== "SPAM",
    ) ?? [];
  const hasSelection = Boolean(selectedMessageId);

  function connectGmailAccount() {
    const session = sessionQuery.data;
    if (!session || !canConnectAccount) return;
    window.location.assign(
      getGoogleGmailAuthorizationUrl(session.organization_id),
    );
  }

  return (
    <div className="gmail-page">
      <section className="gmail-page-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE / MESSAGES</p>
          <h1>Gmail</h1>
          <p className="heading-copy">
            Read, organize, and send from your Gmail accounts.
          </p>
        </div>
        {(accounts.length > 0 || canConnectAccount) && (
          <div className="gmail-heading-actions">
            {accounts.length > 0 && (
              <label className="gmail-account-picker">
                <span className="gmail-account-picker-icon" aria-hidden="true">
                  <MailIcon />
                </span>
                <span className="gmail-account-picker-copy">
                  <span>CONNECTED ACCOUNT</span>
                  <select
                    aria-label="Gmail account"
                    onChange={(event) => selectAccount(event.target.value)}
                    value={activeAccountId}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.email_address}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="gmail-account-chevron" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </label>
            )}
            {canConnectAccount && (
              <button
                className="button button-secondary"
                onClick={connectGmailAccount}
                type="button"
              >
                {accounts.length === 0
                  ? "Connect your Gmail account"
                  : "Connect another Gmail account"}
              </button>
            )}
          </div>
        )}
      </section>

      {gmailStatus === "connected" && (
        <p className="gmail-compose-success" role="status">
          Gmail connected and assigned to you.
        </p>
      )}
      {gmailStatus === "already-connected" && (
        <p className="gmail-inline-alert" role="alert">
          This Gmail account is already connected on the platform. Its access
          was not changed.
        </p>
      )}
      {gmailStatus === "error" && (
        <p className="gmail-inline-alert" role="alert">
          Google did not complete the Gmail connection. You can try again.
        </p>
      )}

      {accountsQuery.isPending && (
        <div className="gmail-loading-state" role="status">
          <span className="gmail-spinner" aria-hidden="true" />
          Loading your Gmail accounts…
        </div>
      )}

      {accountsQuery.isError && (
        <div className="gmail-state-card gmail-state-card-error" role="alert">
          <span className="gmail-state-icon" aria-hidden="true">
            <MailIcon />
          </span>
          <div>
            <h2>We couldn’t load your Gmail accounts</h2>
            <p>{accountsQuery.error.message}</p>
            <button
              className="button button-secondary"
              onClick={() => void accountsQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {accountsQuery.isSuccess && accounts.length === 0 && (
        <div className="gmail-state-card gmail-state-card-empty">
          <span className="gmail-state-icon" aria-hidden="true">
            <MailIcon />
          </span>
          <div>
            <span className="gmail-state-kicker">SHARED INBOX</span>
            <h2>Your inbox is ready when you are</h2>
            <p>
              Connect your Gmail account to give yourself access, or ask your
              organization administrator to assign a shared inbox.
            </p>
            {!canConnectAccount && sessionQuery.data?.user.role === "admin" && (
              <Link
                className="button button-secondary"
                href="/settings?section=gmail"
              >
                Manage shared Gmail accounts
              </Link>
            )}
          </div>
        </div>
      )}

      {selectedAccount && (
        <>
          <nav aria-label="Gmail mailboxes and labels" className="gmail-mailboxes">
            <button
              className="button button-primary gmail-compose-open"
              onClick={openCompose}
              type="button"
            >
              <ComposeIcon />
              Compose
            </button>
            <button
              aria-current={selectedLabelId === "INBOX" ? "page" : undefined}
              className={`gmail-mailbox-button${selectedLabelId === "INBOX" ? " is-active" : ""}`}
              onClick={() => selectMailbox("INBOX")}
              type="button"
            >
              <MailIcon />
              Inbox
            </button>
            <button
              aria-current={selectedLabelId === "SPAM" ? "page" : undefined}
              className={`gmail-mailbox-button${selectedLabelId === "SPAM" ? " is-active" : ""}`}
              onClick={() => selectMailbox("SPAM")}
              type="button"
            >
              <SpamIcon />
              Spam
            </button>
            {otherLabels.length > 0 && (
              <span className="gmail-labels-heading">Labels</span>
            )}
            {otherLabels.map((label) => (
              <button
                aria-current={
                  selectedLabelId === label.id ? "page" : undefined
                }
                className={`gmail-mailbox-button${selectedLabelId === label.id ? " is-active" : ""}`}
                key={label.id}
                onClick={() => selectMailbox(label.id)}
                type="button"
              >
                <LabelIcon />
                {formatGmailLabelName(label)}
              </button>
            ))}
            {labelsQuery.isError && (
              <span className="gmail-labels-error" role="alert">
                Could not load labels: {labelsQuery.error.message}
              </span>
            )}
          </nav>

          <div className="gmail-main-content">
          {composeSent && (
            <div className="gmail-compose-success" role="status">
              Email sent successfully.
            </div>
          )}

          <form className="gmail-search-bar" onSubmit={searchInbox}>
            <div className="gmail-search-field">
              <SearchIcon />
              <label className="sr-only" htmlFor="gmail-search">
                Search in this mailbox
              </label>
              <input
                autoComplete="off"
                id="gmail-search"
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={`Search in ${currentLabelName.toLowerCase()}`}
                value={searchDraft}
              />
              {searchDraft && (
                <button
                  aria-label="Clear search"
                  className="gmail-search-clear"
                  onClick={clearSearch}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
            <button className="button button-primary gmail-search-button" type="submit">
              Search
            </button>
          </form>

          {messagesQuery.isError && (
            <div className="gmail-inline-alert" role="alert">
              <div>
                <strong>Couldn’t load {currentLabelName.toLowerCase()}.</strong>
                <span>{messagesQuery.error.message}</span>
              </div>
              <button
                className="button button-secondary"
                onClick={() => void messagesQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          <div
            className={`gmail-inbox-layout${hasSelection ? " has-selection" : ""}`}
          >
            <section
              aria-label={`${currentLabelName} messages`}
              aria-busy={messagesQuery.isFetching}
              className="gmail-message-list"
            >
              <div className="gmail-list-heading">
                <div>
                  <h2>{currentLabelName}</h2>
                  <span className="gmail-result-count">
                    {messagesQuery.data
                      ? `${messagesQuery.data.result_size_estimate.toLocaleString()} messages`
                      : "Your latest messages"}
                  </span>
                </div>
                <button
                  aria-label={`Refresh ${currentLabelName.toLowerCase()}`}
                  className="gmail-icon-button"
                  disabled={messagesQuery.isFetching}
                  onClick={() => void messagesQuery.refetch()}
                  title={`Refresh ${currentLabelName.toLowerCase()}`}
                  type="button"
                >
                  <RefreshIcon />
                </button>
              </div>

              {appliedSearch && (
                <div className="gmail-search-context">
                  <span>
                    Results for <strong>{appliedSearch}</strong>
                  </span>
                  <button onClick={clearSearch} type="button">
                    Clear
                  </button>
                </div>
              )}

              <div className="gmail-message-rows">
                {messagesQuery.isPending && <MessageListSkeleton />}
                {messagesQuery.data?.messages.length === 0 && (
                  <div className="gmail-list-empty">
                    <span aria-hidden="true">
                      <SearchIcon />
                    </span>
                    <strong>
                      {appliedSearch
                        ? "No matches found"
                        : `No messages in ${currentLabelName}`}
                    </strong>
                    <p>
                      {appliedSearch
                        ? "Try a different search or clear your filters."
                        : `Messages in ${currentLabelName} will show up here.`}
                    </p>
                    {appliedSearch && (
                      <button onClick={clearSearch} type="button">
                        Clear search
                      </button>
                    )}
                  </div>
                )}
                {messagesQuery.data?.messages.map((message) => (
                  <button
                    aria-label={`${message.is_unread ? "Unread message. " : ""}From ${message.from_address || "unknown sender"}. ${message.subject}. ${message.snippet}`}
                    aria-pressed={selectedMessageId === message.id}
                    className={`gmail-message-row${selectedMessageId === message.id ? " is-selected" : ""}${message.is_unread ? " is-unread" : ""}`}
                    key={message.id}
                    onClick={() => selectMessage(message.id)}
                    type="button"
                  >
                    <span className="gmail-sender-avatar" aria-hidden="true">
                      {getSenderInitials(message.from_address)}
                    </span>
                    <span className="gmail-message-row-content">
                      <span className="gmail-message-row-top">
                        <strong>
                          {message.from_address || "Unknown sender"}
                        </strong>
                        <time>{formatCompactEmailDate(message.date)}</time>
                      </span>
                      <span className="gmail-message-subject">
                        {message.subject}
                      </span>
                      <span className="gmail-message-snippet">
                        {message.snippet || "No preview available"}
                      </span>
                    </span>
                    {message.is_unread && (
                      <span className="gmail-unread-dot" aria-label="Unread" />
                    )}
                  </button>
                ))}
              </div>

              <nav aria-label={`${currentLabelName} pages`} className="gmail-pagination">
                <span>
                  Page <strong>{pageIndex + 1}</strong>
                </span>
                <div>
                  <button
                    aria-label="Previous page"
                    className="gmail-page-button"
                    disabled={pageIndex === 0 || messagesQuery.isFetching}
                    onClick={goToPreviousPage}
                    type="button"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    aria-label="Next page"
                    className="gmail-page-button"
                    disabled={
                      !messagesQuery.data?.next_page_token ||
                      messagesQuery.isFetching
                    }
                    onClick={goToNextPage}
                    type="button"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              </nav>
            </section>

            <section
              aria-label="Selected email"
              className="gmail-message-detail"
            >
              <button
                className="gmail-mobile-back"
                onClick={() => selectMessage("")}
                type="button"
              >
                <ChevronLeftIcon />
                Back to {currentLabelName.toLowerCase()}
              </button>

              {!selectedMessageId && (
                <div className="gmail-detail-empty">
                  <span className="gmail-detail-empty-icon" aria-hidden="true">
                    <MailIcon />
                  </span>
                  <h2>Your inbox, in one place</h2>
                  <p>
                    Choose a message from the list to read it and send a reply.
                  </p>
                </div>
              )}

              {messageQuery.isPending && selectedMessageId && (
                <div className="gmail-detail-loading" role="status">
                  <span className="gmail-spinner" aria-hidden="true" />
                  Opening message…
                </div>
              )}

              {messageQuery.isError && (
                <div className="gmail-detail-error" role="alert">
                  <h2>We couldn’t open this message</h2>
                  <p>{messageQuery.error.message}</p>
                  <button
                    className="button button-secondary"
                    onClick={() => void messageQuery.refetch()}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              )}

              {messageQuery.data && (
                <>
                  <header className="gmail-detail-heading">
                    <div className="gmail-detail-title-row">
                      <h2>{messageQuery.data.subject}</h2>
                      {messageQuery.data.is_unread && (
                        <span className="gmail-unread-badge">Unread</span>
                      )}
                    </div>
                    <div className="gmail-sender-avatar gmail-detail-avatar" aria-hidden="true">
                      {getSenderInitials(messageQuery.data.from_address)}
                    </div>
                    <div className="gmail-detail-meta">
                      <strong>
                        {messageQuery.data.from_address || "Unknown sender"}
                      </strong>
                      <time>{formatEmailDate(messageQuery.data.date)}</time>
                    </div>
                  </header>

                  <div className="gmail-message-body">
                    {messageQuery.data.body_text ||
                      messageQuery.data.snippet ||
                      "This message has no displayable text content."}
                  </div>

                  <form className="gmail-reply-form" onSubmit={sendReply}>
                    <label className="gmail-reply-label" htmlFor="gmail-reply">
                      <span>Reply</span>
                      <span>To {messageQuery.data.from_address || "sender"}</span>
                    </label>
                    <textarea
                      disabled={replyMutation.isPending}
                      id="gmail-reply"
                      maxLength={20_000}
                      onChange={(event) => {
                        setReplyBody(event.target.value);
                        if (!replyMutation.isPending) replyMutation.reset();
                      }}
                      placeholder="Write your reply…"
                      required
                      rows={4}
                      value={replyBody}
                    />
                    <div className="gmail-reply-footer">
                      {replyMutation.isSuccess && (
                        <span className="gmail-reply-success" role="status">
                          Reply sent
                        </span>
                      )}
                      {replyMutation.isError && (
                        <span className="gmail-reply-error" role="alert">
                          Couldn’t send: {replyMutation.error.message}
                        </span>
                      )}
                      <button
                        className="button button-primary gmail-send-button"
                        disabled={!replyBody.trim() || replyMutation.isPending}
                        type="submit"
                      >
                        <SendIcon />
                        {replyMutation.isPending ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
          </div>
        </>
      )}

      {composeOpen && selectedAccount && (
        <div className="gmail-compose-overlay">
          <section
            aria-labelledby="gmail-compose-title"
            aria-modal="true"
            className="gmail-compose-dialog"
            role="dialog"
          >
            <header className="gmail-compose-heading">
              <div>
                <p className="eyebrow">NEW MESSAGE</p>
                <h2 id="gmail-compose-title">Compose email</h2>
                <span>From {selectedAccount.email_address}</span>
              </div>
              <button
                aria-label="Close compose"
                className="gmail-compose-close"
                disabled={composeMutation.isPending}
                onClick={closeCompose}
                type="button"
              >
                ×
              </button>
            </header>
            <form className="gmail-compose-form" onSubmit={sendComposedMessage}>
              <label>
                To
                <input
                  autoComplete="email"
                  disabled={composeMutation.isPending}
                  onChange={(event) => setComposeTo(event.target.value)}
                  placeholder="name@example.com, another@example.com"
                  required
                  value={composeTo}
                />
              </label>
              <label>
                Cc
                <input
                  disabled={composeMutation.isPending}
                  onChange={(event) => setComposeCc(event.target.value)}
                  placeholder="Optional; separate addresses with commas"
                  value={composeCc}
                />
              </label>
              <label>
                Bcc
                <input
                  disabled={composeMutation.isPending}
                  onChange={(event) => setComposeBcc(event.target.value)}
                  placeholder="Optional; separate addresses with commas"
                  value={composeBcc}
                />
              </label>
              <label>
                Subject
                <input
                  autoComplete="off"
                  disabled={composeMutation.isPending}
                  maxLength={998}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Subject"
                  value={composeSubject}
                />
              </label>
              <label>
                Message
                <textarea
                  disabled={composeMutation.isPending}
                  maxLength={20_000}
                  onChange={(event) => setComposeBody(event.target.value)}
                  placeholder="Write your message..."
                  required
                  rows={9}
                  value={composeBody}
                />
              </label>
              {composeMutation.isError && (
                <p className="gmail-compose-error" role="alert">
                  Couldn’t send email: {composeMutation.error.message}
                </p>
              )}
              <footer className="gmail-compose-footer">
                <span>
                  {composeMutation.isPending ? "Sending..." : "Sent from the selected Gmail account"}
                </span>
                <button
                  className="button button-primary gmail-send-button"
                  disabled={
                    composeMutation.isPending ||
                    splitRecipients(composeTo).length === 0 ||
                    !composeBody.trim()
                  }
                  type="submit"
                >
                  <SendIcon />
                  {composeMutation.isPending ? "Sending..." : "Send"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function splitRecipients(value: string) {
  return value
    .split(/[;,]/)
    .map((address) => address.trim())
    .filter(Boolean);
}

function formatGmailLabelName(label: GmailLabel) {
  if (label.type !== "system") return label.name;
  return label.name
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function MessageListSkeleton() {
  return (
    <div aria-hidden="true" className="gmail-skeleton-list">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="gmail-skeleton-row" key={index}>
          <span className="gmail-skeleton gmail-skeleton-avatar" />
          <span className="gmail-skeleton-copy">
            <span className="gmail-skeleton gmail-skeleton-line" />
            <span className="gmail-skeleton gmail-skeleton-line short" />
            <span className="gmail-skeleton gmail-skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

function getSenderInitials(value: string) {
  const displayName = value.split("<")[0].replaceAll('"', "").trim();
  const name = displayName || value;
  const words = name.split(/[\s._+-]+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0] || "?").slice(0, 2).toUpperCase();
}

function formatCompactEmailDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEmailDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <rect height="15" rx="2.5" width="19" x="2.5" y="4.5" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function SpamIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M5 8a7 7 0 0 1 14 0v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" />
      <path d="M12 8v5m0 3h.01" />
    </svg>
  );
}

function LabelIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M20 13 13 20l-9-9V4h7Z" />
      <circle cx="8" cy="8" r="1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M20 7v5h-5M4.6 9a7.5 7.5 0 0 1 12.7-2L20 12M4 17v-5h5m10.4 3a7.5 7.5 0 0 1-12.7 2L4 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" />
      <path d="M10.3 13.7 15 9" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
