"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  acceptOrganizationInvitation,
  getOrganizationInvitation,
} from "@/lib/api";

type AcceptanceMode = "existing" | "new";

export default function AcceptOrganizationInvitationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AcceptanceMode>("existing");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const invitationQuery = useQuery({
    queryKey: ["organization-invitation", token],
    queryFn: () => getOrganizationInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });
  const acceptMutation = useMutation({
    mutationFn: () =>
      acceptOrganizationInvitation(token, {
        password,
        ...(mode === "new"
          ? {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            }
          : {}),
      }),
    onSuccess: async (session) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      queryClient.setQueryData(["auth-session"], session);
      router.replace(
        session.user.role === "admin"
          ? "/organization/dashboard"
          : "/overview",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    acceptMutation.mutate();
  }

  return (
    <main className="auth-page">
      <div className="auth-background-grid" aria-hidden="true" />
      <div className="auth-layout">
        <section className="auth-card" aria-labelledby="invitation-heading">
          <div className="auth-card-top">
            <span className="auth-card-icon">✦</span>
            <span>ORGANIZATION INVITATION</span>
          </div>
          <h1 id="invitation-heading">Join an organization</h1>
          {!token ? (
            <p className="auth-feedback auth-feedback-error" role="alert">
              This invitation link is missing its token.
            </p>
          ) : invitationQuery.isLoading ? (
            <div className="auth-loading" role="status">
              <span className="auth-spinner" />
              Checking invitation…
            </div>
          ) : invitationQuery.isError ? (
            <p className="auth-feedback auth-feedback-error" role="alert">
              This invitation is invalid, expired, or has already been used.
              Ask the organization administrator for a new link.
            </p>
          ) : invitationQuery.data ? (
            <>
              <p className="auth-card-copy">
                You were invited to join{" "}
                <strong>{invitationQuery.data.organization_name}</strong> as a{" "}
                {invitationQuery.data.role === "admin"
                  ? "administrator"
                  : "member"}
                . The invitation is for{" "}
                <strong>{invitationQuery.data.email}</strong>.
              </p>
              <div className="auth-name-grid">
                <button
                  aria-pressed={mode === "existing"}
                  className={`button ${
                    mode === "existing" ? "button-primary" : "button-secondary"
                  }`}
                  onClick={() => {
                    setMode("existing");
                    acceptMutation.reset();
                  }}
                  type="button"
                >
                  I have an account
                </button>
                <button
                  aria-pressed={mode === "new"}
                  className={`button ${
                    mode === "new" ? "button-primary" : "button-secondary"
                  }`}
                  onClick={() => {
                    setMode("new");
                    acceptMutation.reset();
                  }}
                  type="button"
                >
                  Create an account
                </button>
              </div>
              <form className="auth-form" onSubmit={submit}>
                {mode === "new" && (
                  <div className="auth-name-grid">
                    <label className="auth-field">
                      <span>First name</span>
                      <input
                        autoComplete="given-name"
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                        value={firstName}
                      />
                    </label>
                    <label className="auth-field">
                      <span>Last name</span>
                      <input
                        autoComplete="family-name"
                        onChange={(event) => setLastName(event.target.value)}
                        required
                        value={lastName}
                      />
                    </label>
                  </div>
                )}
                <label className="auth-field">
                  <span>{mode === "new" ? "Create password" : "Password"}</span>
                  <input
                    autoComplete={
                      mode === "new" ? "new-password" : "current-password"
                    }
                    minLength={12}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                {acceptMutation.isError && (
                  <p className="auth-feedback auth-feedback-error" role="alert">
                    {acceptMutation.error.message}
                  </p>
                )}
                <button
                  className="button button-primary"
                  disabled={acceptMutation.isPending}
                  type="submit"
                >
                  {acceptMutation.isPending
                    ? "Joining…"
                    : "Accept invitation"}
                </button>
              </form>
            </>
          ) : null}
          <p className="auth-card-copy">
            <Link href="/login">Return to sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
