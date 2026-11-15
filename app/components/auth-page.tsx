"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  bootstrapAdmin,
  getBootstrapStatus,
  login,
  registerOrganization,
  type AuthSession,
} from "@/lib/api";

export function AuthPage({ initialMode }: { initialMode: "login" | "signup" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const bootstrapQuery = useQuery({
    queryKey: ["auth-bootstrap-status"],
    queryFn: getBootstrapStatus,
    retry: false,
  });
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const authMutation = useMutation({
    mutationFn: async () => {
      const input = {
        email: email.trim(),
        password,
      };
      if (bootstrapQuery.data?.required) {
        return bootstrapAdmin({
          ...input,
          organization_name: organizationName.trim(),
        });
      }
      if (initialMode === "signup") {
        return registerOrganization({
          ...input,
          organization_name: organizationName.trim(),
        });
      }
      return login(input);
    },
    onSuccess: async (session: AuthSession) => {
      queryClient.setQueryData(["auth-session"], session);
      router.replace("/");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  const isBootstrap = bootstrapQuery.data?.required === true;
  const isSignup = initialMode === "signup" || isBootstrap;
  const formTitle = isBootstrap
    ? "Set up your workspace"
    : isSignup
      ? "Create your account"
      : "Welcome back";

  return (
    <main className="auth-page">
      <div className="auth-background-grid" aria-hidden="true" />
      <div className="auth-layout">
        <section className="auth-intro">
          <Link className="auth-brand" href="/" aria-label="Lead Intelligence home">
            <span className="auth-brand-mark">BI</span>
            <span>Lead Intelligence</span>
          </Link>
          <div className="auth-intro-copy">
            <span className="auth-kicker">
              <span className="auth-kicker-dot" />
              BUSINESS INTELLIGENCE WORKSPACE
            </span>
            <h1>
              Turn research
              <br />
              into <span>real growth.</span>
            </h1>
            <p>
              Find the right companies, understand their websites, and bring
              every opportunity into one clear pipeline.
            </p>
            <div className="auth-benefits">
              <div>
                <span className="auth-benefit-icon">⌕</span>
                <span>
                  <strong>Discover with purpose</strong>
                  <small>Find companies from the sources you trust.</small>
                </span>
              </div>
              <div>
                <span className="auth-benefit-icon">↗</span>
                <span>
                  <strong>Research every website</strong>
                  <small>Turn web signals into useful context.</small>
                </span>
              </div>
              <div>
                <span className="auth-benefit-icon">▤</span>
                <span>
                  <strong>Keep your team aligned</strong>
                  <small>One shared pipeline for your organization.</small>
                </span>
              </div>
            </div>
          </div>
          <p className="auth-intro-footer">
            A clearer way to find and understand your next customer.
          </p>
        </section>

        <section className="auth-card" aria-labelledby="auth-heading">
          <div className="auth-card-top">
            <span className="auth-card-icon">{isSignup ? "✦" : "↗"}</span>
            <span>{isBootstrap ? "FIRST-TIME SETUP" : isSignup ? "GET STARTED" : "YOUR WORKSPACE"}</span>
          </div>
          <h2 id="auth-heading">{formTitle}</h2>
          <p className="auth-card-copy">
            {isBootstrap
              ? "Create your organization and administrator account to get started."
              : isSignup
                ? "Create an organization workspace for your team."
                : "Sign in to pick up where your team left off."}
          </p>

          {bootstrapQuery.isError && (
            <p className="auth-feedback auth-feedback-error" role="alert">
              Could not check workspace setup: {bootstrapQuery.error.message}
            </p>
          )}

          {bootstrapQuery.isLoading ? (
            <div className="auth-loading" role="status">
              <span className="auth-spinner" />
              Checking workspace setup…
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {isSignup && (
                <label className="auth-field">
                  <span>Organization name</span>
                  <input
                    autoComplete="organization"
                    maxLength={200}
                    minLength={2}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Acme Inc."
                    required
                    value={organizationName}
                  />
                </label>
              )}
              <label className="auth-field">
                <span>Work email</span>
                <input
                  autoComplete="username"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? 12 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignup ? "At least 12 characters" : "Enter your password"}
                  required
                  type="password"
                  value={password}
                />
                {isSignup && <small>Use at least 12 characters.</small>}
              </label>

              {authMutation.isError && (
                <p className="auth-feedback auth-feedback-error" role="alert">
                  {authMutation.error.message}
                </p>
              )}

              <button
                className="auth-submit"
                disabled={authMutation.isPending}
                type="submit"
              >
                {authMutation.isPending
                  ? "Please wait…"
                  : isSignup
                    ? isBootstrap
                      ? "Create workspace"
                      : "Create account"
                    : "Sign in"}
                {!authMutation.isPending && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          {!isBootstrap && (
            <p className="auth-switch">
              {isSignup ? "Already have an account?" : "New to Lead Intelligence?"}{" "}
              <Link href={isSignup ? "/login" : "/signup"}>
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          )}
          <div className="auth-card-note">
            <span aria-hidden="true">⌑</span>
            Your organization’s data stays private and secure.
          </div>
        </section>
      </div>
    </main>
  );
}
