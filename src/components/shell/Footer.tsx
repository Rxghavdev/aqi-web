import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { ABOUT_LINKS, EXPLORE_LINKS } from "./links";
import { Year } from "./Year";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo size={26} />
            <p>{SITE_TAGLINE}</p>
          </div>
          <nav className="footer-col" aria-labelledby="footer-explore">
            <h2 id="footer-explore">Explore</h2>
            <ul>
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="footer-col" aria-labelledby="footer-about">
            <h2 id="footer-about">About</h2>
            <ul>
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer-legal">
          <p>Data: Central Pollution Control Board (CPCB) via data.gov.in</p>
          <p>
            © <Year /> {SITE_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
