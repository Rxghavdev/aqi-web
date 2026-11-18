import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          <span className="wordmark-name">{SITE_NAME}</span>
          <span className="wordmark-caption">for India</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/#cities">Cities</Link>
          <Link href="/methodology">Methodology</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
