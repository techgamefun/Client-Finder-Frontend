import { Suspense } from "react";
import { LeadsPage } from "../components/leads-page";

export default function LeadsRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading leads…</div>}>
      <LeadsPage />
    </Suspense>
  );
}
