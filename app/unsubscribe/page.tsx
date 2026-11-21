import { Suspense } from "react";
import { UnsubscribePage } from "../components/unsubscribe-page";
import { PageLoading } from "../components/page-loading";

export default function UnsubscribeRoute() {
  return (
    <Suspense fallback={<PageLoading label="Loading unsubscribe options" />}>
      <UnsubscribePage />
    </Suspense>
  );
}
