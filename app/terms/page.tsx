import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalOperatorNotice,
  PublicPageHeading,
  PublicSiteLayout,
} from "../components/public-site-layout";
import { PUBLIC_CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms of service | ${SITE_NAME}`,
  description:
    "Review the terms for using ProspectLoop’s company research and outreach workspace.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PublicSiteLayout>
      <article className="public-page public-legal-page">
        <PublicPageHeading
          description="These terms describe the basic responsibilities that apply when you access or use ProspectLoop."
          eyebrow="LEGAL"
          title="Terms of service"
        />
        <div className="public-legal-meta">
          <span>Effective date: 20 November 2026</span>
          <span>Governing jurisdiction: India, West Bengal</span>
        </div>
        <div className="public-page-content">
          <LegalOperatorNotice />
          <section>
            <h2>Using the service</h2>
            <p>
              ProspectLoop provides a workspace for discovering businesses,
              reviewing website research, managing company and contact records,
              and organizing email outreach. You must be authorized to act for
              your organization and keep your sign-in details secure. Your
              organization is responsible for activity by its users.
            </p>
          </section>
          <section>
            <h2>Your content and responsibilities</h2>
            <p>
              You are responsible for the information you import, the websites
              you ask the service to analyze, the messages you create or send,
              and ensuring you have the rights, permissions, and legal basis
              required to use that information and contact recipients.
            </p>
            <p>
              Do not use the service to violate law, bypass website access
              controls, send unlawful or unsolicited messages, infringe others&apos;
              rights, or interfere with the security or operation of
              ProspectLoop or its providers. You must honor applicable
              opt-out, consent, and suppression requirements.
            </p>
          </section>
          <section>
            <h2>Third-party services and credentials</h2>
            <p>
              Search, crawling, PageSpeed, Gemini, and Gmail features rely on
              third-party services that you or your organization configure.
              Those services are governed by their own terms, limits, and
              privacy practices. You are responsible for your provider keys,
              account permissions, quotas, and any fees charged by those
              providers.
            </p>
          </section>
          <section>
            <h2>AI-generated drafts</h2>
            <p>
              Gemini-generated content is a starting point, not verified
              advice or a guarantee of accuracy, suitability, or compliance.
              Review and edit every draft before saving or sending it. You
              remain responsible for the content and recipients of messages
              sent from your connected accounts.
            </p>
          </section>
          <section>
            <h2>Availability and changes</h2>
            <p>
              We may update, suspend, or discontinue parts of the service to
              maintain or improve it, address security issues, or comply with
              legal requirements. Third-party integrations may be unavailable
              or change independently of ProspectLoop.
            </p>
          </section>
          <section>
            <h2>Disclaimers and liability</h2>
            <p>
              To the extent permitted by applicable law, the service is
              provided on an &quot;as available&quot; basis without guarantees that
              research, generated content, or third-party data will be
              complete, current, uninterrupted, or error-free. Nothing in
              these terms excludes rights or liabilities that cannot legally
              be excluded.
            </p>
          </section>
          <section>
            <h2>Governing law and contact</h2>
            <p>
              These terms are governed by the laws of India. Subject to
              applicable law, courts with jurisdiction in West Bengal, India
              will hear disputes relating to these terms. Questions about
              these terms can be sent to{" "}
              <Link href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                {PUBLIC_CONTACT_EMAIL}
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </PublicSiteLayout>
  );
}
