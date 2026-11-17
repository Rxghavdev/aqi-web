import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Station not found",
};

export default function StationNotFound() {
  return (
    <div className="copy">
      <h1 className="page-title">That station is not in this reading.</h1>
      <p className="lede">The address does not match a CPCB station.</p>
      <p className="mt-6">
        <Link href="/" className="text-link">
          Back to the readings
        </Link>
      </p>
    </div>
  );
}
