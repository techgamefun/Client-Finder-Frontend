import Link from "next/link";
import { JobQueuePage } from "./job-queue-page";

type JobQueueKind = "crawler" | "pagespeed" | "keywords";

export function JobsPage({ kind }: { kind: JobQueueKind }) {
  return (
    <>
      <nav aria-label="Job queue type" className="jobs-tabs">
        <Link
          aria-current={kind === "crawler" ? "page" : undefined}
          className={kind === "crawler" ? "is-active" : ""}
          href="/jobs?tab=crawler"
        >
          Indexing
        </Link>
        <Link
          aria-current={kind === "pagespeed" ? "page" : undefined}
          className={kind === "pagespeed" ? "is-active" : ""}
          href="/jobs?tab=pagespeed"
        >
          PageSpeed
        </Link>
        <Link
          aria-current={kind === "keywords" ? "page" : undefined}
          className={kind === "keywords" ? "is-active" : ""}
          href="/jobs?tab=keywords"
        >
          Keywords
        </Link>
      </nav>
      <JobQueuePage kind={kind} />
    </>
  );
}
