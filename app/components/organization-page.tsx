"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrganizationUser,
  getAuthSession,
  getOrganizationUsers,
} from "@/lib/api";
import { formatTimestamp } from "@/lib/job-format";
import { useToast } from "./toast-provider";

export function OrganizationPage() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
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
  const createUserMutation = useMutation({
    mutationFn: createOrganizationUser,
    onSuccess: async (_user, variables) => {
      setEmail("");
      setPassword("");
      setRole("user");
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      showToast({
        type: "success",
        title: "Organization user added",
        message: `${variables.email} can now access this organization.`,
      });
    },
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="workspace-route-loading" role="status">
        Loading organization…
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Could not load organization details: {sessionQuery.error.message}
      </p>
    );
  }

  if (!sessionQuery.data) {
    return (
      <div className="workspace-route-loading" role="status">
        Loading organization…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <section className="panel organization-access-panel" role="alert">
        <h1>Organization access restricted</h1>
        <p>Only organization administrators can view this page.</p>
      </section>
    );
  }

  const members = usersQuery.data?.users ?? [];

  return (
    <>
      <header className="page-heading organization-page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Organization</h1>
          <p className="heading-copy">
            View your organization profile and manage the people who can access
            it.
          </p>
        </div>
      </header>

      <section
        aria-label="Organization profile"
        className="organization-profile-grid"
      >
        <article className="panel organization-profile-card">
          <span className="organization-profile-label">Organization name</span>
          <strong>{sessionQuery.data.organization_name}</strong>
        </article>
        <article className="panel organization-profile-card">
          <span className="organization-profile-label">Organization ID</span>
          <code>{sessionQuery.data.organization_id}</code>
        </article>
        <article className="panel organization-profile-card">
          <span className="organization-profile-label">Members</span>
          <strong>
            {usersQuery.isLoading ? "…" : usersQuery.data?.users.length ?? "—"}
          </strong>
        </article>
      </section>

      <section
        aria-labelledby="organization-members-heading"
        className="panel organization-members-panel"
      >
        <div className="organization-section-heading">
          <div>
            <h2 id="organization-members-heading">Organization members</h2>
            <p className="panel-subtitle">
              Members share organization business records. Each member manages
              their own provider API keys.
            </p>
          </div>
        </div>

        <form
          className="organization-member-form"
          onSubmit={(event) => {
            event.preventDefault();
            createUserMutation.mutate({ email: email.trim(), password, role });
          }}
        >
          <label>
            <span>Email address</span>
            <input
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Temporary password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              onChange={(event) =>
                setRole(event.target.value === "admin" ? "admin" : "user")
              }
              value={role}
            >
              <option value="user">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <button
            className="button button-primary"
            disabled={createUserMutation.isPending}
            type="submit"
          >
            {createUserMutation.isPending ? "Adding member…" : "Add member"}
          </button>
        </form>

        {createUserMutation.isError && (
          <p className="alert alert-error" role="alert">
            Could not add member: {createUserMutation.error.message}
          </p>
        )}
        {usersQuery.isError && (
          <p className="alert alert-error" role="alert">
            Could not load organization members: {usersQuery.error.message}
          </p>
        )}

        {usersQuery.isLoading ? (
          <p className="empty-copy">Loading members…</p>
        ) : usersQuery.data ? (
          <div className="table-scroll organization-member-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Activity</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.email}</td>
                    <td>
                      {member.role === "admin" ? "Administrator" : "Member"}
                    </td>
                    <td>
                      <span
                        className={`organization-member-status ${
                          member.is_active ? "is-active" : "is-inactive"
                        }`}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatTimestamp(member.created_at)}</td>
                    <td>
                      <Link
                        className="button button-secondary organization-member-view"
                        href={`/organization/members/${encodeURIComponent(member.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
