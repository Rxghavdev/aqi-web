import type { Metadata } from "next";
import { NotFoundView } from "@/components/pages/NotFoundView";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <NotFoundView
      eyebrow="Error 404"
      title="This page does not exist."
      lede="The address may be mistyped or out of date. Search for a city or station, or pick one of the places below."
    />
  );
}
