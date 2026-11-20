"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrganizationUser,
  getAuthSession,
  getOrganizationUsers,
  updateOrganizationUserRole,
  type OrganizationUser,
} from "@/lib/api";
import { formatTimestamp } from "@/lib/job-format";

type MemberSortKey = "name" | "role" | "status" | "joined";
type MemberSort = { key: MemberSortKey; direction: "ascending" | "descending" };

export function OrganizationMembersPage() {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<MemberSort>({
    key: "name",
    direction: "ascending",
  });
  const addMemberDialogRef = useRef<HTMLDialogElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = addMemberDialogRef.current;
    if (!dialog) return;
    if (isAddMemberOpen && !dialog.open) {
      dialog.showModal();
      firstNameInputRef.current?.focus();
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
  const createMutation = useMutation({
    mutationFn: createOrganizationUser,
    onSuccess: async () => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRole("user");
      setIsAddMemberOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
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
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setRole("user");
    createMutation.reset();
  }

  function handleAddMemberDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeAddMemberDialog();
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="workspace-route-loading" role="status">
        Loading members…
      </div>
    );
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
          {usersQuery.data
            ? `${usersQuery.data.users.length} ${
                usersQuery.data.users.length === 1 ? "member" : "members"
              }`
            : "Loading…"}
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

        {usersQuery.isLoading ? (
          <p className="empty-copy">Loading members…</p>
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
            <h2 id="add-organization-member-heading">Add member</h2>
            <p className="heading-copy">
              Create an account and choose its initial access level.
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
        <form
          className="organization-member-form"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              password,
              role,
            });
          }}
        >
          <label>
            <span>First name</span>
            <input
              autoComplete="given-name"
              onChange={(event) => setFirstName(event.target.value)}
              ref={firstNameInputRef}
              required
              value={firstName}
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              autoComplete="family-name"
              onChange={(event) => setLastName(event.target.value)}
              required
              value={lastName}
            />
          </label>
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
            <span>Initial role</span>
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
              Could not add member: {createMutation.error.message}
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
              {createMutation.isPending ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
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
