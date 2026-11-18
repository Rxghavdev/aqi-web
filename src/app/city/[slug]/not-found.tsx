import type { Metadata } from "next";
import { NotFoundView } from "@/components/pages/NotFoundView";

export const metadata: Metadata = {
  title: "City not found",
};

export default function CityNotFound() {
  return (
    <NotFoundView
      eyebrow="City not found"
      title="We could not find that city."
      lede="It may be spelled differently, or CPCB may not publish readings there. Search for another name, or browse every city."
    />
  );
}
