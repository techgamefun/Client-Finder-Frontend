import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalOperatorNotice,
  PublicPageHeading,
  PublicSiteLayout,
} from "../components/public-site-layout";
import {
  PUBLIC_CONTACT_EMAIL,
  PUBLIC_LOCATION,
  SITE_NAME,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy policy | ${SITE_NAME}`,
  description:
    "Read how ProspectLoop handles account, company, website, and outreach information.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PublicSiteLayout>
      <article className="public-page public-legal-page">
        <PublicPageHeading
          description="This policy explains what information ProspectLoop processes when you use the service and how to contact us about it."
          eyebrow="LEGAL"
          title="Privacy policy"
        />
        <div className="public-legal-meta">
          <span>Effective date: 20 November 2026</span>
          <span>Service location: {PUBLIC_LOCATION}</span>
        </div>
        <div className="public-page-content">
          <LegalOperatorNotice />
          <section>
            <h2>Information we process</h2>
            <p>
              Depending on how your organization uses ProspectLoop, this may
              include account and organization details; company, website, and
              contact information that you enter or import; website content
              and research results; email templates, campaign details, and
              messages you choose to access or send; and settings or
              credentials for provider integrations.
            </p>
            <p>
              When you connect Gmail, the service uses Google authorization to
              access mailbox features you use in ProspectLoop and to send
              messages you request. Authentication cookies are used to keep
              your session active.
            </p>
          </section>
          <section>
            <h2>How information is used</h2>
            <p>
              We process information to provide and secure the workspace,
              organize company research, run searches and website analyses,
              render templates, send messages you initiate, and troubleshoot
              service issues. Organization administrators manage provider
              connections and team access.
            </p>
          </section>
          <section>
            <h2>Connected services</h2>
            <p>
              When an administrator enables an integration, relevant
              information is sent to that provider to fulfill the requested
              action. This can include search terms, website URLs, PageSpeed
              requests, Gmail message content, or a prompt submitted for a
              Gemini draft. Provider privacy terms and retention practices also
              apply to information they receive.
            </p>
            <p>
              Gemini prompts and generated drafts are sent to Google when you
              use the drafting feature. Google states that data submitted on
              the Gemini API free tier may be used to improve its products.
              Avoid including sensitive personal or confidential information
              in prompts unless you are authorized to share it and accept
              Google’s terms. See{" "}
              <Link href="https://ai.google.dev/gemini-api/docs/terms">
                Google Gemini API terms
              </Link>
              .
            </p>
          </section>
          <section>
            <h2>Storage, security, and retention</h2>
            <p>
              Workspace records and saved provider credentials are stored
              server-side for the service to operate. Gmail refresh tokens are
              encrypted before storage; provider API keys are not currently
              encrypted at the application layer. Authentication cookies are
              marked HttpOnly and use SameSite protections. No internet
              transmission or storage method can be guaranteed completely
              secure.
            </p>
            <p>
              We retain information while it is needed to provide the service,
              maintain security, resolve disputes, and meet applicable
              obligations. ProspectLoop does not currently publish a fixed
              deletion schedule. Contact us to request access, correction, or
              deletion; requests are handled subject to applicable law and
              operational requirements.
            </p>
          </section>
          <section>
            <h2>Sharing and international processing</h2>
            <p>
              Information may be processed by the hosting and integration
              providers required for the features your organization chooses.
              These providers may process information in locations outside
              India. We do not claim that every provider stores data in a
              particular country; review the provider’s terms for details.
            </p>
          </section>
          <section>
            <h2>Contact and updates</h2>
            <p>
              For privacy questions or requests, email{" "}
              <Link href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                {PUBLIC_CONTACT_EMAIL}
              </Link>
              . We may update this policy as the service changes and will
              revise the effective date when we do.
            </p>
          </section>
        </div>
      </article>
    </PublicSiteLayout>
  );
}
