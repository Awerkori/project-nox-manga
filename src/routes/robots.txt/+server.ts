export const GET = ({ url }) =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /auth\nDisallow: /api/action\nDisallow: /api/upload\nDisallow: /ler/\nSitemap: ${url.origin}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' } }
  );
