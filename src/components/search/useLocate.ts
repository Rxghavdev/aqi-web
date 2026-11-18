"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { writePoint } from "@/components/place/storage";

/** Browser location, then the nearest-station page. Shared by hero and palette. */
export function useLocate(onDone?: () => void) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const mounted = useRef(true);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    setNote(null);
    if (!("geolocation" in navigator)) {
      setNote("This browser cannot share a location. Search for a city or station instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setLocating(false);
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        writePoint(Number(lat), Number(lon));
        done.current?.();
        router.push(`/near?lat=${lat}&lon=${lon}`);
      },
      (error) => {
        if (!mounted.current) return;
        setLocating(false);
        setNote(
          error.code === error.PERMISSION_DENIED
            ? "Location is turned off for this site. Search for a city or station instead."
            : "Location could not be read. Search for a city or station instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [router]);

  return { locate, locating, note, clearNote: () => setNote(null) };
}
