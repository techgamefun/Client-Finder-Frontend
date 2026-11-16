import { JobsPage } from "@/app/components/jobs-page";

type JobsRouteProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function JobsRoute({ searchParams }: JobsRouteProps) {
  const { tab } = await searchParams;
  return <JobsPage kind={tab === "pagespeed" ? "pagespeed" : "crawler"} />;
}
