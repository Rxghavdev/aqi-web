import type { Metadata } from "next";
import { NotFoundView } from "@/components/pages/NotFoundView";

export const metadata: Metadata = {
  title: "Station not found",
};

export default function StationNotFound() {
  return (
    <NotFoundView
      eyebrow="Station not found"
      title="We could not find that station."
      lede="The station may have been renamed or taken offline. Search by station or city name, or browse every city."
    />
  );
}
