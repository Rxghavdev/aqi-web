export const PRIMARY_LINKS = [
  { href: "/cities", label: "Cities" },
  { href: "/near", label: "Near me" },
  { href: "/methodology", label: "Methodology" },
] as const;

export const EXPLORE_LINKS = [
  { href: "/cities", label: "Cities" },
  { href: "/near", label: "Near me" },
  // The ranking section on the home page.
  { href: "/#cities", label: "Worst right now" },
] as const;

export const ABOUT_LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
] as const;
