import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export function Header() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-10">
        <Link href="/" className="font-medium tracking-tight text-ink">
          {SITE_NAME}
        </Link>
        <nav aria-label="Primary">
          <Link href="/methodology" className="text-sm text-muted hover:text-ink">
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
