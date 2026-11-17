export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client) {
    return new Response("# AdSense publisher id is not configured", {
      status: 200,
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
