import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * En-têtes de sécurité. La politique CSP n'autorise que les ressources du
 * site lui-même, plus OpenStreetMap pour la carte (affichée uniquement si la
 * localisation est vérifiée). Si un prestataire de paiement ou un outil de
 * mesure d'audience est ajouté, compléter form-action / script-src ici.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js injecte des scripts en ligne
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone", // image Docker légère
  poweredByHeader: false,
  images: {
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/placeholders/**" }],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [400, 640, 828, 1080, 1280, 1600],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // envoi de photos (limite fine dans UPLOAD_MAX_MB)
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
