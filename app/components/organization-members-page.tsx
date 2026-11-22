"use client";

import Link from "next/link";
import Image from "next/image";
import { Copy, Plus, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrganizationInvitation,
  getOrganizationInvitations,
  getAuthSession,
  getOrganizationUsers,
  revokeOrganizationInvitation,
  updateOrganizationUserRole,
  type OrganizationInvitation,
  type OrganizationUser,
} from "@/lib/api";
import { formatTimestamp } from "@/lib/job-format";
import { PageLoading, TableLoading } from "./page-loading";

type MemberSortKey = "name" | "role" | "status" | "joined";
type MemberSort = { key: MemberSortKey; direction: "ascending" | "descending" };

export function OrganizationMembersPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [createdInvitation, setCreatedInvitation] =
    useState<OrganizationInvitation | null>(null);
  const [copyError, setCopyError] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<MemberSort>({
    key: "name",
    direction: "ascending",
  });
  const addMemberDialogRef = useRef<HTMLDialogElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = addMemberDialogRef.current;
    if (!dialog) return;
    if (isAddMemberOpen && !dialog.open) {
      dialog.showModal();
      emailInputRef.current?.focus();
    } else if (!isAddMemberOpen && dialog.open) {
      dialog.close();
    }
  }, [isAddMemberOpen]);

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
  const invitationsQuery = useQuery({
    queryKey: ["organization-invitations"],
    queryFn: getOrganizationInvitations,
    enabled: isAdmin,
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: createOrganizationInvitation,
    onSuccess: async (invitation) => {
      setCreatedInvitation(invitation);
      setCopyError("");
      setEmail("");
      setRole("user");
      await queryClient.invalidateQueries({
        queryKey: ["organization-invitations"],
      });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: revokeOrganizationInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-invitations"],
      });
    },
  });
  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role: nextRole,
    }: {
      userId: string;
      role: "admin" | "user";
    }) => updateOrganizationUserRole(userId, nextRole),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
    },
  });

  const sortedMembers = useMemo(() => {
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const members = (usersQuery.data?.users ?? []).filter((member) => {
      const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`
        .trim()
        .toLocaleLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        member.email.toLocaleLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? member.is_active : !member.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });

    return members.sort((left, right) => {
      const comparison = compareMembers(left, right, sort.key, collator);
      return sort.direction === "ascending" ? comparison : -comparison;
    });
  }, [roleFilter, search, sort, statusFilter, usersQuery.data?.users]);

  function changeSort(key: MemberSortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  function closeAddMemberDialog() {
    if (createMutation.isPending) return;
    setIsAddMemberOpen(false);
    setEmail("");
    setRole("user");
    setCreatedInvitation(null);
    setCopyError("");
    createMutation.reset();
  }

  function handleAddMemberDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeAddMemberDialog();
  }

  if (sessionQuery.isLoading) {
    return <PageLoading label="Loading members" variant="members" />;
  }
  if (sessionQuery.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Could not verify organization access: {sessionQuery.error.message}
      </p>
    );
  }
  if (!isAdmin || !sessionQuery.data) {
    return (
      <section className="panel organization-access-panel" role="alert">
        <h1>Members access restricted</h1>
        <p>Only organization administrators can manage members.</p>
      </section>
    );
  }

  return (
    <>
      <header className="organization-members-page-heading">
        <h1>Members</h1>
        <span>
          {usersQuery.isLoading ? (
            <span aria-hidden="true" className="organization-member-count-skeleton" />
          ) : usersQuery.data ? (
            `${usersQuery.data.users.length} ${
                usersQuery.data.users.length === 1 ? "member" : "members"
              }`
          ) : (
            "Members"
          )}
        </span>
      </header>

      <section
        aria-labelledby="organization-members-list-heading"
        className="panel organization-member-list-panel"
      >
        <div className="organization-section-heading">
          <div>
            <h2 id="organization-members-list-heading">All members</h2>
          </div>
          {usersQuery.data && (
            <span className="organization-member-result-count">
              {sortedMembers.length} of {usersQuery.data.users.length}
            </span>
          )}
          <button
            aria-controls="add-organization-member-dialog"
            aria-haspopup="dialog"
            className="button button-primary organization-add-member-trigger"
            onClick={() => {
              createMutation.reset();
              setCreatedInvitation(null);
              setCopyError("");
              setIsAddMemberOpen(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Add member
          </button>
        </div>

        <div className="organization-member-filters">
          <label className="organization-member-search">
            <span className="sr-only">Search members</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <select
              onChange={(event) => setRoleFilter(event.target.value)}
              value={roleFilter}
            >
              <option value="all">All roles</option>
              <option value="admin">Administrators</option>
              <option value="user">Members</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <section
          aria-labelledby="organization-pending-invitations-heading"
          className="organization-pending-invitations"
        >
          <div className="organization-section-heading">
            <div>
              <h2 id="organization-pending-invitations-heading">
                Pending invitations
              </h2>
              <p>Share each invitation link with the person you invited.</p>
            </div>
          </div>
          {invitationsQuery.isLoading ? (
            <p className="empty-copy">Loading invitations…</p>
          ) : invitationsQuery.isError ? (
            <p className="alert alert-error" role="alert">
              Could not load invitations: {invitationsQuery.error.message}
            </p>
          ) : invitationsQuery.data?.length ? (
            <ul className="organization-invitation-list">
              {invitationsQuery.data.map((invitation) => (
                <li key={invitation.id}>
                  <span>
                    <strong>{invitation.email}</strong>
                    <small>
                      {invitation.role === "admin" ? "Administrator" : "Member"}
                      {" · Expires "}
                      {formatTimestamp(invitation.expires_at)}
                    </small>
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={
                      revokeMutation.isPending &&
                      revokeMutation.variables === invitation.id
                    }
                    onClick={() => {
                      if (invitation.id) {
                        revokeMutation.mutate(invitation.id);
                      }
                    }}
                    type="button"
                  >
                    {revokeMutation.isPending &&
                    revokeMutation.variables === invitation.id
                      ? "Revoking…"
                      : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No pending invitations.</p>
          )}
          {revokeMutation.isError && (
            <p className="alert alert-error" role="alert">
              Could not revoke invitation: {revokeMutation.error.message}
            </p>
          )}
        </section>

        {usersQuery.isLoading ? (
          <TableLoading label="Loading organization members" rows={5} />
        ) : usersQuery.isError ? (
          <p className="alert alert-error" role="alert">
            Could not load members: {usersQuery.error.message}
          </p>
        ) : (
          <>
            {roleMutation.isError && (
              <p className="alert alert-error" role="alert">
                Could not update role: {roleMutation.error.message}
              </p>
            )}
            <div className="table-scroll organization-member-table">
              <table>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Member"
                      onSort={() => changeSort("name")}
                      sort={sort}
                      sortKey="name"
                    />
                    <SortableHeader
                      label="Role"
                      onSort={() => changeSort("role")}
                      sort={sort}
                      sortKey="role"
                    />
                    <SortableHeader
                      label="Status"
                      onSort={() => changeSort("status")}
                      sort={sort}
                      sortKey="status"
                    />
                    <SortableHeader
                      label="Joined"
                      onSort={() => changeSort("joined")}
                      sort={sort}
                      sortKey="joined"
                    />
                    <th scope="col">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => (
                    <MemberRow
                      currentUserId={sessionQuery.data.user.id}
                      key={member.id}
                      member={member}
                      onRoleChange={(nextRole) => {
                        roleMutation.reset();
                        roleMutation.mutate({
                          userId: member.id,
                          role: nextRole,
                        });
                      }}
                      roleChangePending={
                        roleMutation.isPending &&
                        roleMutation.variables?.userId === member.id
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {sortedMembers.length === 0 && (
              <p className="empty-copy">No members match these filters.</p>
            )}
          </>
        )}
      </section>

      <dialog
        aria-labelledby="add-organization-member-heading"
        className="organization-add-member-dialog"
        id="add-organization-member-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeAddMemberDialog();
        }}
        onClick={handleAddMemberDialogClick}
        ref={addMemberDialogRef}
      >
        <header className="organization-add-member-dialog-heading">
          <div>
            <p className="eyebrow">ORGANIZATION</p>
            <h2 id="add-organization-member-heading">Invite member</h2>
            <p className="heading-copy">
              Create a secure invitation link. The person can join with an
              existing account or create one.
            </p>
          </div>
          <button
            aria-label="Close add member dialog"
            className="icon-button"
            disabled={createMutation.isPending}
            onClick={closeAddMemberDialog}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        {createdInvitation?.invitation_url ? (
          <div className="organization-member-form">
            <p className="alert alert-success" role="status">
              Invitation created for {createdInvitation.email}. Share this link
              with them; it expires in seven days.
            </p>
            <label>
              <span>Invitation link</span>
              <input
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                value={createdInvitation.invitation_url}
              />
            </label>
            {copyError && (
              <p className="alert alert-error" role="alert">
                {copyError}
              </p>
            )}
            <div className="organization-add-member-dialog-actions">
              <button
                className="button button-secondary"
                onClick={closeAddMemberDialog}
                type="button"
              >
                Close
              </button>
              <button
                className="button button-primary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(createdInvitation.invitation_url!)
                    .then(() => setCopyError(""))
                    .catch(() =>
                      setCopyError(
                        "Could not copy the link. Select it and copy it manually.",
                      ),
                    );
                }}
                type="button"
              >
                <Copy aria-hidden="true" size={16} />
                Copy invitation link
              </button>
            </div>
          </div>
        ) : (
          <form
            className="organization-member-form"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate({
                email: email.trim(),
                role,
              });
            }}
          >
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                ref={emailInputRef}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Organization role</span>
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
            {createMutation.isError && (
              <p className="alert alert-error" role="alert">
                Could not create invitation: {createMutation.error.message}
              </p>
            )}
            <div className="organization-add-member-dialog-actions">
              <button
                className="button button-secondary"
                disabled={createMutation.isPending}
                onClick={closeAddMemberDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={createMutation.isPending}
                type="submit"
              >
                {createMutation.isPending
                  ? "Creating…"
                  : "Create invitation"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

function MemberRow({
  currentUserId,
  member,
  onRoleChange,
  roleChangePending,
}: {
  currentUserId: string;
  member: OrganizationUser;
  onRoleChange: (role: "admin" | "user") => void;
  roleChangePending: boolean;
}) {
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  const isAdmin = member.role === "admin";
  const isCurrentUser = member.id === currentUserId;

  return (
    <tr>
      <td>
        <div className="organization-member-identity">
          <span aria-hidden="true" className="organization-member-avatar">
            {member.profile_photo_url ? (
              <Image
                alt=""
                height={36}
                src={member.profile_photo_url}
                unoptimized
                width={36}
              />
            ) : (
              (fullName || member.email).slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="organization-member-name">
            <strong>{fullName || "Name not provided"}</strong>
            <small>{member.email}</small>
          </span>
        </div>
      </td>
      <td>
        <div className="organization-member-role-control">
          <button
            aria-checked={isAdmin}
            aria-label={`Administrator access for ${fullName || member.email}`}
            className={`organization-role-switch${isAdmin ? " is-active" : ""}`}
            disabled={isCurrentUser || roleChangePending}
            onClick={() => onRoleChange(isAdmin ? "user" : "admin")}
            role="switch"
            title={
              isCurrentUser
                ? "You cannot change your own role."
                : "Toggle administrator access"
            }
            type="button"
          >
            <span />
          </button>
          <span>{roleChangePending ? "Saving…" : isAdmin ? "Admin" : "Member"}</span>
        </div>
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
  );
}

function SortableHeader({
  label,
  onSort,
  sort,
  sortKey,
}: {
  label: string;
  onSort: () => void;
  sort: MemberSort;
  sortKey: MemberSortKey;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={
        active
          ? sort.direction === "ascending"
            ? "ascending"
            : "descending"
          : "none"
      }
      scope="col"
    >
      <button
        className="organization-sort-button"
        onClick={onSort}
        type="button"
      >
        {label}
        {active && (
          <span aria-hidden="true">
            {sort.direction === "ascending" ? " ↑" : " ↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function compareMembers(
  left: OrganizationUser,
  right: OrganizationUser,
  key: MemberSortKey,
  collator: Intl.Collator,
): number {
  if (key === "name") {
    return collator.compare(memberName(left), memberName(right));
  }
  if (key === "role") {
    return collator.compare(left.role, right.role);
  }
  if (key === "status") {
    return Number(left.is_active) - Number(right.is_active);
  }
  return collator.compare(left.created_at, right.created_at);
}

function memberName(member: OrganizationUser): string {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
    || member.email;
}
