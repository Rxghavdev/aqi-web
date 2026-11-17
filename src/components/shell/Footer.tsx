import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline text-sm leading-relaxed text-muted">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
        <p>
          Readings from the Central Pollution Control Board via data.gov.in. This
          is not a government website.
        </p>
        <nav aria-label="About this site" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/methodology" className="text-ink underline underline-offset-4">
            Methodology
          </Link>
          <Link href="/about" className="text-ink underline underline-offset-4">
            About
          </Link>
          <Link href="/privacy" className="text-ink underline underline-offset-4">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
