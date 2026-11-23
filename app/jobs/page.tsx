import { JobsPage } from "@/app/components/jobs-page";

type JobsRouteProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function JobsRoute({ searchParams }: JobsRouteProps) {
  const { tab } = await searchParams;
  const kind =
    tab === "pagespeed"
      ? "pagespeed"
      : tab === "keywords"
        ? "keywords"
        : tab === "hypestat"
          ? "hypestat"
        : "crawler";
  return <JobsPage kind={kind} />;
}
