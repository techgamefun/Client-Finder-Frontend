import { Suspense } from "react";
import { UnsubscribePage } from "../components/unsubscribe-page";

export default function UnsubscribeRoute() {
  return (
    <Suspense fallback={<main className="auth-page" aria-busy="true" />}>
      <UnsubscribePage />
    </Suspense>
  );
}
