/**
 * Contact address from `NEXT_PUBLIC_CONTACT_EMAIL`. Unset or malformed means
 * there is nothing to show, so callers render nothing at all.
 */
export function contactEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  if (!raw) return null;
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw) ? raw : null;
}

export function ContactLink({ email }: { email: string }) {
  return <a href={`mailto:${email}`}>{email}</a>;
}
