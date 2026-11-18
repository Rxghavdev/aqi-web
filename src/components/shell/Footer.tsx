import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          Readings from the Central Pollution Control Board via data.gov.in. This
          is not a government website.
        </p>
        <p className="made-with">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            focusable="false"
          >
            <path
              fill="#be123c"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span>Made with love in India</span>
        </p>
        <nav aria-label="About this site">
          <Link href="/methodology">Methodology</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
