import { Suspense } from "react";
import { EmailTemplatesPage } from "../components/email-templates-page";

export default function EmailTemplatesRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading templates…</div>}>
      <EmailTemplatesPage />
    </Suspense>
  );
}
