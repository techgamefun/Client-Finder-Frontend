import { Suspense } from "react";
import { GmailPage } from "../components/gmail-page";
import { PageLoading } from "../components/page-loading";

export default function GmailRoute() {
  return (
    <Suspense fallback={<PageLoading label="Loading Gmail" variant="generic" />}>
      <GmailPage />
    </Suspense>
  );
}
