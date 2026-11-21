import { Suspense } from "react";
import { EmailCampaignsPage } from "../components/email-campaigns-page";
import { PageLoading } from "../components/page-loading";

export default function EmailCampaignsRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading campaigns" variant="generic" />}
    >
      <EmailCampaignsPage />
    </Suspense>
  );
}
