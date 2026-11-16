import { Suspense } from "react";
import { WebsitesPage } from "../components/websites-page";

export default function WebsitesRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading websites…</div>}>
      <WebsitesPage />
    </Suspense>
  );
}
