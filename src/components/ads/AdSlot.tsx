"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type AdSlotName = "home" | "city";

const ADS_SCRIPT =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

function readClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
}

function readSlotId(slot: AdSlotName): string {
  const raw =
    slot === "home"
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME
      : process.env.NEXT_PUBLIC_ADSENSE_SLOT_CITY;
  return raw?.trim() ?? "";
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot }: { slot: AdSlotName }) {
  const client = readClient();
  const slotId = readSlotId(slot);
  if (!client || !slotId) return null;
  return <ConfiguredAd client={client} slotId={slotId} />;
}

function ConfiguredAd({
  client,
  slotId,
}: {
  client: string;
  slotId: string;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* One push per mount. A rejected call must not run again. */
    }
  }, []);

  return (
    <div style={{ display: "block", margin: "2rem 0", minHeight: "280px" }}>
      <Script
        id="adsbygoogle-js"
        async
        src={`${ADS_SCRIPT}?client=${encodeURIComponent(client)}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
