import { Suspense } from "react";
import { EmailTemplatesPage } from "../components/email-templates-page";
import { PageLoading } from "../components/page-loading";

export default function EmailTemplatesRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading templates" variant="table" />}
    >
      <EmailTemplatesPage />
    </Suspense>
  );
}
