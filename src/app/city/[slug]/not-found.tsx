import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "City not found",
};

export default function CityNotFound() {
  return (
    <div className="copy">
      <h1 className="page-title">That city is not in this reading.</h1>
      <p className="lede">The address does not match a CPCB city.</p>
      <p className="mt-6">
        <Link href="/" className="text-link">
          Back to the readings
        </Link>
      </p>
    </div>
  );
}
