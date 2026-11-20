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
import { BrandMark } from "./brand-mark";

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
  const [showPassword, setShowPassword] = useState(false);
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
      router.replace(
        session.user.role === "admin" ? "/organization" : "/overview",
      );
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
          <Link className="auth-brand" href="/" aria-label="ProspectLoop home">
            <BrandMark className="auth-brand-mark" />
            <span>ProspectLoop</span>
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
            <span>
              {isBootstrap
                ? "FIRST-TIME SETUP"
                : isSignup
                  ? "GET STARTED"
                  : "YOUR WORKSPACE"}
            </span>
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
            <form
              aria-busy={authMutation.isPending}
              className="auth-form"
              onSubmit={submit}
            >
              {isSignup && (
                <label className="auth-field">
                  <span>Organization name</span>
                  <input
                    autoComplete="organization"
                    disabled={authMutation.isPending}
                    maxLength={200}
                    minLength={2}
                    onChange={(event) => {
                      setOrganizationName(event.target.value);
                      authMutation.reset();
                    }}
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
                  autoCapitalize="none"
                  disabled={authMutation.isPending}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    authMutation.reset();
                  }}
                  placeholder="you@company.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <span className="auth-password-control">
                  <input
                    autoComplete={
                      isSignup ? "new-password" : "current-password"
                    }
                    disabled={authMutation.isPending}
                    minLength={isSignup ? 12 : undefined}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      authMutation.reset();
                    }}
                    placeholder={
                      isSignup
                        ? "At least 12 characters"
                        : "Enter your password"
                    }
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="auth-password-toggle"
                    disabled={authMutation.isPending}
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
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
                {authMutation.isPending ? (
                  <>
                    <span aria-hidden="true" className="auth-submit-spinner" />
                    {isSignup
                      ? isBootstrap
                        ? "Creating workspace…"
                        : "Creating account…"
                      : "Signing in…"}
                  </>
                ) : isSignup ? (
                  isBootstrap ? (
                    "Create workspace"
                  ) : (
                    "Create account"
                  )
                ) : (
                  "Sign in"
                )}
                {!authMutation.isPending && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          {!isBootstrap && (
            <p className="auth-switch">
              {isSignup ? "Already have an account?" : "New to ProspectLoop?"}{" "}
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
