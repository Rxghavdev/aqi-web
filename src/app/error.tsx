"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Fallback for an error inside a page. The header and footer stay in place.
 * Server errors arrive without their message; the digest links the browser
 * report to the server log line.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    const digest =
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest?: unknown }).digest)
        : undefined;
    console.error("route error", digest);
  }, [error]);

  return (
    <div className="copy route-error" role="alert">
      <h1 className="page-title">Something went wrong on our side.</h1>
      <p className="lede">Try again in a moment.</p>
      <div className="route-error-actions">
        <button type="button" className="retry-button" onClick={() => retry()}>
          Retry
        </button>
        <Link href="/" className="text-link">
          Back to home
        </Link>
      </div>
    </div>
  );
}
