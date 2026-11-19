import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageHeading,
  PublicSiteLayout,
} from "../components/public-site-layout";
import {
  PUBLIC_CONTACT_EMAIL,
  PUBLIC_LOCATION,
  SITE_NAME,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact | ${SITE_NAME}`,
  description:
    "Contact the ProspectLoop team for product, account, or privacy questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PublicSiteLayout>
      <article className="public-page public-contact-page">
        <PublicPageHeading
          description="For product questions, account help, or privacy requests, get in touch by email."
          eyebrow="CONTACT"
          title="We're here to help."
        />
        <div className="public-contact-card">
          <div>
            <p className="public-contact-label">Email</p>
            <Link href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
              {PUBLIC_CONTACT_EMAIL}
            </Link>
            <p>
              Include the email address associated with your workspace and a
              short description of what you need help with. Please do not email
              passwords or API keys.
            </p>
          </div>
          <div>
            <p className="public-contact-label">Location</p>
            <p>{PUBLIC_LOCATION}</p>
          </div>
        </div>
      </article>
    </PublicSiteLayout>
  );
}
