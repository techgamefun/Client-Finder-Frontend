import {
  ArrowUpRight,
  Building2,
  Compass,
  Globe,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const homeActions: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Discover businesses",
    description: "Search for organizations and add promising websites.",
    href: "/discovery",
    icon: Compass,
  },
  {
    title: "Review websites",
    description: "Check discovered sites and their crawl status.",
    href: "/websites",
    icon: Globe,
  },
  {
    title: "Manage companies",
    description: "Organize company records and follow up on leads.",
    href: "/companies",
    icon: Building2,
  },
  {
    title: "View jobs",
    description: "Track crawler and PageSpeed work in progress.",
    href: "/jobs",
    icon: Workflow,
  },
];

export default function Home() {
  return (
    <main className="overview-redesign home-page">
      <header className="home-page-header">
        <div>
          <p className="overview-eyebrow">LEAD INTELLIGENCE</p>
          <h1>Home</h1>
          <p>Find businesses, review leads, and keep your work moving.</p>
        </div>
        <Link className="button button-primary" href="/discovery">
          <Compass aria-hidden="true" size={17} />
          Start discovering
        </Link>
      </header>

      <section aria-labelledby="home-actions-title">
        <div className="overview-section-heading home-section-heading">
          <div>
            <p className="overview-eyebrow">QUICK LINKS</p>
            <h2 id="home-actions-title">What would you like to do?</h2>
          </div>
        </div>
        <div className="home-action-grid">
          {homeActions.map(({ title, description, href, icon: Icon }) => (
            <Link className="home-action-card" href={href} key={href}>
              <span className="home-action-icon">
                <Icon aria-hidden="true" size={20} />
              </span>
              <span className="home-action-copy">
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="home-action-arrow"
                size={17}
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
