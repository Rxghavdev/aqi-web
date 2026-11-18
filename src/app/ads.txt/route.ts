export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client) {
    // Unconfigured: 404 so crawlers do not record a placeholder ads.txt.
    return new Response("ads.txt is not configured for this deployment\n", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const publisher = client.replace(/^ca-/, "");
  return new Response(
    `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
    {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    },
  );
}
