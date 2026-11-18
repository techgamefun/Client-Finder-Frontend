"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  createEmailSuppression,
  getEmailSuppressions,
  type EmailSuppression,
} from "@/lib/api";

export function EmailSuppressionSettings() {
  const queryClient = useQueryClient();
  const [targetType, setTargetType] =
    useState<EmailSuppression["target_type"]>("email");
  const [value, setValue] = useState("");
  const [reason, setReason] =
    useState<EmailSuppression["reason"]>("manual_dnc");
  const suppressionsQuery = useQuery({
    queryKey: ["email-suppressions"],
    queryFn: getEmailSuppressions,
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: createEmailSuppression,
    onSuccess: async () => {
      setValue("");
      await queryClient.invalidateQueries({
        queryKey: ["email-suppressions"],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      target_type: targetType,
      value: value.trim(),
      reason,
    });
  }

  return (
    <>
      <div>
        <p className="eyebrow">PLATFORM-WIDE DO-NOT-CONTACT</p>
        <h2>Suppression list</h2>
        <p className="panel-subtitle">
          Addresses and domains added here are blocked across all organizations,
          including campaign sends and direct Gmail messages. Domain entries
          also cover subdomains. New unsubscribes are shared platform-wide;
          this page lists entries created by your organization.
        </p>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <div className="settings-grid">
          <label className="settings-field">
            Suppress
            <select
              onChange={(event) =>
                setTargetType(event.currentTarget.value as "email" | "domain")
              }
              value={targetType}
            >
              <option value="email">Email address</option>
              <option value="domain">Domain</option>
            </select>
          </label>
          <label className="settings-field">
            {targetType === "email" ? "Email address" : "Domain name"}
            <input
              autoComplete="off"
              onChange={(event) => setValue(event.currentTarget.value)}
              placeholder={
                targetType === "email"
                  ? "person@example.com"
                  : "example.com"
              }
              required
              value={value}
            />
          </label>
          <label className="settings-field">
            Reason
            <select
              onChange={(event) =>
                setReason(
                  event.currentTarget.value as EmailSuppression["reason"],
                )
              }
              value={reason}
            >
              <option value="manual_dnc">Do not contact</option>
              <option value="hard_bounce">Hard bounce</option>
              <option value="complaint">Spam complaint</option>
            </select>
          </label>
        </div>
        {createMutation.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not update suppression list: {createMutation.error.message}
          </p>
        )}
        {createMutation.isSuccess && (
          <p className="settings-feedback" role="status">
            The suppression was saved and will be enforced for every sender.
          </p>
        )}
        <div className="settings-actions">
          <button
            className="button button-primary"
            disabled={createMutation.isPending || !value.trim()}
            type="submit"
          >
            {createMutation.isPending ? "Saving…" : "Add to suppression list"}
          </button>
        </div>
      </form>

      {suppressionsQuery.isPending && (
        <p className="settings-feedback" role="status">
          Loading suppressed addresses…
        </p>
      )}
      {suppressionsQuery.isError && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          Could not load the suppression list: {suppressionsQuery.error.message}
        </p>
      )}
      {suppressionsQuery.data && (
        <div className="suppression-table-wrap">
          <table className="suppression-table">
            <thead>
              <tr>
                <th scope="col">Address or domain</th>
                <th scope="col">Reason</th>
                <th scope="col">Added</th>
                <th scope="col">Scope</th>
              </tr>
            </thead>
            <tbody>
              {suppressionsQuery.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.normalized_value}</td>
                  <td>{formatReason(item.reason)}</td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>{item.global_dnc ? "All organizations" : "—"}</td>
                </tr>
              ))}
              {suppressionsQuery.data.length === 0 && (
                <tr>
                  <td colSpan={4}>No addresses or domains are suppressed.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatReason(reason: EmailSuppression["reason"]): string {
  switch (reason) {
    case "unsubscribe":
      return "Unsubscribed";
    case "hard_bounce":
      return "Hard bounce";
    case "complaint":
      return "Spam complaint";
    case "manual_dnc":
      return "Do not contact";
  }
}
