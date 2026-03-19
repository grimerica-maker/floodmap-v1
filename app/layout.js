import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Disaster Map — Simulate Floods, Asteroid Impacts & Nuclear Detonations",
  description: "Interactive world map to simulate rising sea levels, asteroid impacts, and nuclear detonations. See casualty estimates, blast zones, tsunami reach, and flood displaced populations in real time.",
  keywords: "flood simulation, sea level rise, asteroid impact, nuclear detonation, disaster map, climate change, tsunami, blast radius, interactive map",
  authors: [{ name: "Disaster Map" }],
  openGraph: {
    title: "Disaster Map",
    description: "Simulate floods, asteroid impacts and nuclear detonations on an interactive world map.",
    url: "https://www.disastermap.ca",
    siteName: "Disaster Map",
    images: [{ url: "/logo.png", width: 120, height: 120 }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Disaster Map",
    description: "Simulate floods, asteroid impacts and nuclear detonations on an interactive world map.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",          // iOS add-to-homescreen icon
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.json",    // PWA manifest for Android add-to-homescreen
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, padding: 0, overflow: "hidden" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
