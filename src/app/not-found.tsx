import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div className="copy">
      <h1 className="page-title">This page is not here.</h1>
      <p className="lede">The address does not match a reading or a page on AQI Desk.</p>
      <p className="mt-6">
        <Link href="/" className="text-link">
          Back to the readings
        </Link>
      </p>
    </div>
  );
}
