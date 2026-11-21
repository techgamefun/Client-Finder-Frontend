"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getAuthSession,
  getOrganizationUsers,
  type AuthSession,
} from "@/lib/api";
import { PageLoading } from "./page-loading";

export function OrganizationPage() {
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const isAdmin = sessionQuery.data?.user.role === "admin";
  const usersQuery = useQuery({
    queryKey: ["organization-users"],
    queryFn: getOrganizationUsers,
    enabled: isAdmin,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return <PageLoading label="Loading organization" variant="organization" />;
  }
  if (sessionQuery.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Could not load organization details: {sessionQuery.error.message}
      </p>
    );
  }
  if (!sessionQuery.data) {
    return <PageLoading label="Loading organization" variant="organization" />;
  }
  if (!isAdmin) {
    return (
      <section className="panel organization-access-panel" role="alert">
        <h1>Organization access restricted</h1>
        <p>Only organization administrators can manage this page.</p>
      </section>
    );
  }

  return (
    <div className="organization-page">
      <OrganizationHero session={sessionQuery.data} />
      {usersQuery.isError && (
        <p className="alert alert-error" role="alert">
          Could not load the member count: {usersQuery.error.message}
        </p>
      )}
      <Link
        aria-label={`View ${usersQuery.data?.users.length ?? "organization"} members`}
        className="organization-member-count-card"
        href="/organization/members"
      >
        <span className="organization-member-count-copy">
          <span className="organization-member-count-label">Members</span>
          <strong>
            {usersQuery.isLoading
              ? "…"
              : usersQuery.data?.users.length ?? "—"}
          </strong>
        </span>
        <span className="organization-member-count-action">
          Manage members
          <ArrowRight aria-hidden="true" size={17} />
        </span>
      </Link>
    </div>
  );
}

function OrganizationHero({ session }: { session: AuthSession }) {
  return (
    <section
      aria-labelledby="organization-hero-title"
      className="organization-hero"
    >
      <div className="organization-hero-background">
        {session.organization_banner_url ? (
          <Image
            alt=""
            className="organization-hero-banner"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
            src={session.organization_banner_url}
            unoptimized
          />
        ) : (
          <div className="organization-hero-placeholder" />
        )}
        <div aria-hidden="true" className="organization-hero-scrim" />
      </div>

      <div className="organization-hero-content">
        <div className="organization-hero-main">
          <span className="organization-hero-logo">
            {session.organization_logo_url ? (
              <Image
                alt=""
                height={76}
                src={session.organization_logo_url}
                unoptimized
                width={76}
              />
            ) : (
              session.organization_name.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="organization-hero-copy">
            <p className="eyebrow">ORGANIZATION</p>
            <h2 id="organization-hero-title">{session.organization_name}</h2>
            <p className="organization-hero-description">
              {session.organization_description || "No description added."}
            </p>
          </div>
        </div>

        <div className="organization-hero-settings-actions">
          <Link
            className="organization-hero-settings-link"
            href="/organization/settings"
          >
            <Settings2 aria-hidden="true" size={15} />
            Organization settings
          </Link>
        </div>
      </div>
    </section>
  );
}
