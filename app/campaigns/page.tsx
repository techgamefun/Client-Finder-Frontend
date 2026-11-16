import { Suspense } from "react";
import { EmailCampaignsPage } from "../components/email-campaigns-page";

export default function EmailCampaignsRoute() {
  return (
    <Suspense fallback={<div className="campaigns-page">Loading campaigns...</div>}>
      <EmailCampaignsPage />
    </Suspense>
  );
}
