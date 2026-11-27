"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  bootstrapAdmin,
  getBootstrapStatus,
  login,
  registerAccount,
  getAuthSession,
  uploadProfilePhoto,
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
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
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
      }
      if (initialMode === "signup") {
        return registerAccount({
          ...input,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
      }
      return login(input);
    },
    onSuccess: async (session: AuthSession) => {
      let completeSession = session;
      if (
        profilePhoto &&
        (initialMode === "signup" || bootstrapQuery.data?.required)
      ) {
        try {
          await uploadProfilePhoto(profilePhoto);
          completeSession = await getAuthSession();
        } catch {
          // Account creation succeeded; a photo upload can be retried from settings.
        }
      }
      queryClient.setQueryData(["auth-session"], completeSession);
      const activeWorkspace = completeSession.organizations.find(
        (organization) => organization.id === completeSession.organization_id,
      );
      router.replace(
        activeWorkspace?.is_personal
          ? "/overview"
          : completeSession.user.role === "admin"
            ? "/organization/dashboard"
            : "/overview",
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
                  <strong>Keep your research organized</strong>
                  <small>Bring website insights and leads into one place.</small>
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
              ? "Create your personal workspace and administrator account to get started."
              : isSignup
                ? "Start with a personal workspace. You can create an organization whenever you’re ready to collaborate."
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
                <>
                  <label className="auth-profile-photo-field">
                    <span className="auth-profile-photo-preview">
                      {profilePhotoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt="Profile preview"
                          src={profilePhotoPreview}
                        />
                      ) : (
                        <span aria-hidden="true">
                          {(firstName.trim().charAt(0) ||
                            lastName.trim().charAt(0) ||
                            "U"
                          ).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="auth-profile-photo-copy">
                      <strong>Profile picture</strong>
                      <small>Optional · JPG, PNG or WebP</small>
                    </span>
                    <span className="auth-profile-photo-button">
                      Choose photo
                    </span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Profile picture"
                      disabled={authMutation.isPending}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0] ?? null;
                        if (profilePhotoPreview) {
                          URL.revokeObjectURL(profilePhotoPreview);
                        }
                        setProfilePhoto(file);
                        setProfilePhotoPreview(
                          file ? URL.createObjectURL(file) : "",
                        );
                        authMutation.reset();
                      }}
                      type="file"
                    />
                  </label>
                  <div className="auth-name-grid">
                    <label className="auth-field">
                      <span>First name</span>
                      <input
                        autoComplete="given-name"
                        disabled={authMutation.isPending}
                        maxLength={100}
                        onChange={(event) => {
                          setFirstName(event.target.value);
                          authMutation.reset();
                        }}
                        placeholder="First name"
                        required
                        value={firstName}
                      />
                    </label>
                    <label className="auth-field">
                      <span>Last name</span>
                      <input
                        autoComplete="family-name"
                        disabled={authMutation.isPending}
                        maxLength={100}
                        onChange={(event) => {
                          setLastName(event.target.value);
                          authMutation.reset();
                        }}
                        placeholder="Last name"
                        required
                        value={lastName}
                      />
                    </label>
                  </div>
                </>
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
            Your personal workspace stays private. Create an organization when
            you want to share work.
          </div>
        </section>
      </div>
    </main>
  );
}
