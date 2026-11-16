import { Suspense } from "react";
import { LeadsPage } from "../components/leads-page";

export default function CompaniesRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading companies…</div>}>
      <LeadsPage view="companies" />
    </Suspense>
  );
}
