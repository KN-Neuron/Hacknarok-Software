import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustLayer — fundament cyfrowej autentyczności",
  description:
    "Warstwa weryfikacji treści dla wiadomości, ogłoszeń i mediów. C2PA + behavioral attestation + soft binding.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        {/* Fonty Google przez CSS link — działa też offline z fallbackami w globals.css. 
            W produkcji można podmienić na next/font/google. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist:wght@300..700&family=JetBrains+Mono:wght@400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased relative">{children}</body>
    </html>
  );
}
