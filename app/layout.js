import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "Disaster Map — Simulate Floods, Asteroid Impacts & Nuclear Detonations",
  description: "Interactive world map to simulate rising sea levels, asteroid impacts, and nuclear detonations. See casualty estimates, blast zones, tsunami reach, and flood displaced populations in real time.",
  keywords: "flood simulation, sea level rise, asteroid impact, nuclear detonation, disaster map, climate change, tsunami, blast radius, interactive map",
  openGraph: {
    title: "Disaster Map",
    description: "Simulate floods, asteroid impacts and nuclear detonations on an interactive world map.",
    url: "https://www.disastermap.ca",
    siteName: "Disaster Map",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Disaster Map" }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Disaster Map",
    description: "Simulate floods, asteroid impacts and nuclear detonations on an interactive world map.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorBackground: "#0a0f1e" }
      }}
    >
      <html lang="en" style={{ margin: 0, padding: 0, overflow: "hidden", height: "100%" }}>
        <body style={{ margin: 0, padding: 0, overflow: "hidden", height: "100%", display: "contents" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
