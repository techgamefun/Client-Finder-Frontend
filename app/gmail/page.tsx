import { Suspense } from "react";
import { GmailPage } from "../components/gmail-page";

export default function GmailRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading mail…</div>}>
      <GmailPage />
    </Suspense>
  );
}
