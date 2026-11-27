"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAuthSession,
  getOrganizationMemberActivity,
  type MemberActivitySeriesPoint,
  type OverviewRange,
} from "@/lib/api";
import { PageLoading } from "./page-loading";

const rangeOptions: { value: OverviewRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const activityMetrics = [
  {
    key: "searches_run",
    label: "Discovery searches",
    color: "discovery",
  },
  {
    key: "websites_discovered",
    label: "Websites discovered",
    color: "websites",
  },
  {
    key: "websites_created",
    label: "Websites created",
    color: "websites-created",
  },
  {
    key: "crawls_completed",
    label: "Indexing completed",
    color: "indexing",
  },
  {
    key: "emails_sent",
    label: "Outreach emails sent",
    color: "outreach",
  },
] as const satisfies {
  key: Exclude<keyof MemberActivitySeriesPoint, "date">;
  label: string;
  color: string;
}[];

export function MemberWorkflowPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = params.memberId;
  const [range, setRange] = useState<OverviewRange>("30d");
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const isAdmin = sessionQuery.data?.user.role === "admin";
  const activityQuery = useQuery({
    queryKey: ["organization-member-activity", memberId, range, timezone],
    queryFn: () => getOrganizationMemberActivity(memberId, range, timezone),
    enabled: isAdmin && Boolean(memberId),
    staleTime: 60_000,
  });

  if (sessionQuery.isLoading) {
    return <PageLoading label="Loading member activity" variant="activity" />;
  }
  if (sessionQuery.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Could not verify organization access: {sessionQuery.error.message}
      </p>
    );
  }
  if (!isAdmin) {
    return (
      <section className="panel organization-access-panel" role="alert">
        <h1>Organization access restricted</h1>
        <p>Only organization administrators can view member activity.</p>
      </section>
    );
  }

  const activity = activityQuery.data;
  const member = activity?.member;
  const hasActivity = activity
    ? activityMetrics.some(({ key }) =>
        activity.series.some((point) => point[key] > 0),
      )
    : false;

  return (
    <>
      <header className="member-workflow-heading">
        <div className="member-workflow-heading-copy">
          <Link className="member-workflow-back" href="/organization">
            <span aria-hidden="true">←</span>
            Organization
          </Link>
          <p className="eyebrow">TEAM ACTIVITY</p>
          {member ? (
            <div className="member-workflow-title-line">
              <h1>{member.email}</h1>
              <span
                className="member-workflow-role"
              >
                {member.role === "admin" ? "Administrator" : "Member"}
              </span>
              <span
                className={`organization-member-status ${
                  member.is_active ? "is-active" : "is-inactive"
                }`}
              >
                {member.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ) : (
            <h1>Member activity</h1>
          )}
          <p className="heading-copy">
            A daily view of discovery, website creation, website indexing, and
            outreach activity.
          </p>
        </div>
        <div
          aria-label="Activity time range"
          className="member-workflow-range"
          role="group"
        >
          {rangeOptions.map((option) => (
            <button
              aria-pressed={range === option.value}
              className={range === option.value ? "is-selected" : ""}
              key={option.value}
              onClick={() => setRange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {activityQuery.isLoading ? (
        <MemberActivityLoading />
      ) : activityQuery.isError ? (
        <section className="panel member-workflow-error">
          <div>
            <h2>Activity could not be loaded</h2>
            <p>{activityQuery.error.message}</p>
          </div>
          <div className="member-workflow-error-actions">
            <button
              className="button button-secondary"
              onClick={() => void activityQuery.refetch()}
              type="button"
            >
              Try again
            </button>
            <Link className="button button-primary" href="/organization">
              Back to organization
            </Link>
          </div>
        </section>
      ) : activity ? (
        <>
          <section
            aria-label="Daily member workflow activity"
            className="member-workflow-metrics"
          >
            {activityMetrics.map((metric) => (
              <ActivityMetricCard
                key={metric.key}
                label={metric.label}
                points={activity.series}
                total={activity.member[metric.key]}
                metricKey={metric.key}
                color={metric.color}
              />
            ))}
          </section>

          {!hasActivity && (
            <p className="member-workflow-empty-note">
              No recorded workflow activity for this member in the selected
              period. The daily charts are ready to track new activity.
            </p>
          )}

          <section
            aria-labelledby="member-workflow-definitions"
            className="panel member-workflow-definitions"
          >
            <h2 id="member-workflow-definitions">How activity is counted</h2>
            <p>
              Searches and websites use their creation dates. Indexing counts
              successful jobs by completion date, and outreach counts emails
              sent by campaigns created by this member. All dates use {timezone}.
            </p>
          </section>
        </>
      ) : (
        <p className="empty-copy">Member activity is not available.</p>
      )}
    </>
  );
}

function ActivityMetricCard({
  color,
  label,
  metricKey,
  points,
  total,
}: {
  color: string;
  label: string;
  metricKey: Exclude<keyof MemberActivitySeriesPoint, "date">;
  points: MemberActivitySeriesPoint[];
  total: number;
}) {
  const values = points.map((point) => point[metricKey]);
  const maximum = Math.max(1, ...values);
  const width = 420;
  const height = 116;
  const left = 34;
  const right = 12;
  const top = 10;
  const bottom = 22;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = values.map((value, index) => ({
    x:
      left +
      (values.length <= 1 ? 0 : (index / (values.length - 1)) * chartWidth),
    y: top + chartHeight - (value / maximum) * chartHeight,
    value,
  }));
  const linePath = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const areaPath =
    first && last
      ? `${linePath} L${last.x},${top + chartHeight} L${first.x},${top + chartHeight} Z`
      : "";
  const tickIndexes = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];

  return (
    <article className={`member-activity-card is-${color}`}>
      <div className="member-activity-card-heading">
        <h2>{label}</h2>
        <strong>{formatCount(total)}</strong>
      </div>
      <span className="member-activity-card-period">in selected period</span>
      <svg
        aria-label={`${label}: ${formatCount(total)} total over ${points.length} days`}
        className="member-activity-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = top + chartHeight * fraction;
          return (
            <g key={fraction}>
              <line
                className="member-activity-gridline"
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
              />
              <text
                className="member-activity-axis-label"
                textAnchor="end"
                x={left - 7}
                y={y + 3}
              >
                {formatCount(Math.round(maximum * (1 - fraction)))}
              </text>
            </g>
          );
        })}
        <path className="member-activity-area" d={areaPath} />
        <path className="member-activity-line" d={linePath} />
        {coordinates.map((point, index) => {
          const date = points[index]?.date;
          return (
            <circle
              className="member-activity-point"
              cx={point.x}
              cy={point.y}
              key={date}
              r="2.5"
            >
              <title>
                {date
                      ? `${formatDate(date)}: ${formatCount(point.value)} ${label.toLowerCase()}`
                  : ""}
              </title>
            </circle>
          );
        })}
        {tickIndexes.map((index) => {
          const point = points[index];
          if (!point) return null;
          const x =
            left +
            (points.length <= 1
              ? 0
              : (index / (points.length - 1)) * chartWidth);
          return (
            <text
              className="member-activity-axis-label"
              key={point.date}
              textAnchor={
                index === 0
                  ? "start"
                  : index === points.length - 1
                    ? "end"
                    : "middle"
              }
              x={x}
              y={height - 4}
            >
              {formatDate(point.date)}
            </text>
          );
        })}
      </svg>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.date}>
            {formatDate(point.date)}: {formatCount(point[metricKey])}{" "}
            {label.toLowerCase()}
          </li>
        ))}
      </ul>
    </article>
  );
}

function MemberActivityLoading() {
  return (
    <section
      aria-label="Loading daily activity charts"
      aria-busy="true"
      className="member-workflow-metrics"
    >
      {activityMetrics.map((metric) => (
        <article className="member-activity-card" key={metric.key}>
          <span className="member-activity-loading-line" />
          <span className="member-activity-loading-chart" />
        </article>
      ))}
    </section>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
