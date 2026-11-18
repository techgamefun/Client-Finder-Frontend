"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  confirmEmailUnsubscribe,
  verifyEmailUnsubscribe,
} from "@/lib/api";

export function UnsubscribePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isVerifying, setIsVerifying] = useState(Boolean(token));
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [requiresEmail, setRequiresEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) {
      return () => {
        active = false;
      };
    }

    void verifyEmailUnsubscribe(token)
      .then((response) => {
        if (active) {
          setRequiresEmail(response.requires_email);
          setIsValid(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "This unsubscribe link could not be verified.",
          );
        }
      })
      .finally(() => {
        if (active) setIsVerifying(false);
      });

    return () => {
      active = false;
    };
  }, [token]);
  const linkError =
    error ||
    (!token ? "This unsubscribe link is missing its confirmation token." : "");

  async function submitUnsubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await confirmEmailUnsubscribe(
        token,
        requiresEmail ? email.trim() : undefined,
      );
      setIsUnsubscribed(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your unsubscribe request could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background-grid" aria-hidden="true" />
      <section
        aria-labelledby="unsubscribe-heading"
        className="auth-card unsubscribe-card-wrap"
      >
        <div className="auth-card-top">
          <span aria-hidden="true" className="auth-card-icon">
            {isUnsubscribed ? "✓" : "↗"}
          </span>
          <span>EMAIL PREFERENCES</span>
        </div>
        <h2 id="unsubscribe-heading">
          {isUnsubscribed
            ? "You’re unsubscribed"
            : "Unsubscribe from emails"}
        </h2>
        <p className="auth-card-copy">
          {isUnsubscribed
            ? "This address has been added to the platform-wide do-not-contact list. No organization can email it again."
            : requiresEmail
              ? "Enter the address that received this message to stop future emails. No sign-in is required."
              : "Confirm to stop future emails. No sign-in is required."}
        </p>
        {token && isVerifying && (
          <p className="settings-feedback" role="status">
            Verifying your link…
          </p>
        )}
        {linkError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            {linkError}
          </p>
        )}
        {isValid && !isUnsubscribed && (
          <form className="settings-form" onSubmit={submitUnsubscribe}>
            {requiresEmail && (
              <label className="settings-field">
                Email address that received this message
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
            )}
            <button
              className="button button-primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving your request…" : "Confirm unsubscribe"}
            </button>
          </form>
        )}
        <div className="auth-card-note">
          <span aria-hidden="true">⌑</span>
          Your choice is shared across all organizations.
        </div>
      </section>
    </main>
  );
}
