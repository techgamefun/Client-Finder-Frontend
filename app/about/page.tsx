import type { Metadata } from "next";
import {
  LegalOperatorNotice,
  PublicPageHeading,
  PublicSiteLayout,
} from "../components/public-site-layout";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `About | ${SITE_NAME}`,
  description:
    "Learn how ProspectLoop brings website discovery, research, and outreach into one workspace.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PublicSiteLayout>
      <article className="public-page">
        <PublicPageHeading
          description="ProspectLoop brings website discovery, research, and thoughtful outreach together in one focused workspace."
          eyebrow="ABOUT PROSPECTLOOP"
          title="Move from research to a more informed first conversation."
        />
        <div className="public-page-content">
          <section>
            <h2>One connected workflow</h2>
            <p>
              Find relevant websites with search tools, add them to your
              registry, and review crawled information alongside PageSpeed
              results. Keep website profiles and contacts organized as work
              moves through your pipeline.
            </p>
          </section>
          <section>
            <h2>Outreach with context</h2>
            <p>
              Create reusable email templates, preview them with website and
              contact details, and send through connected Gmail accounts.
              Gemini can help create a first draft; you review and edit it
              before saving or sending anything.
            </p>
          </section>
          <section>
            <h2>Built around your workspace</h2>
            <p>
              Teams manage their own website research, contacts, templates, and
              provider connections in an organization-scoped workspace. External
              services are used only for the integrations you configure.
            </p>
          </section>
          <LegalOperatorNotice />
        </div>
      </article>
    </PublicSiteLayout>
  );
}
