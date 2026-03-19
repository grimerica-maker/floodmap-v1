import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Disaster Map",
  description: "Simulate floods, asteroid impacts, and nuclear detonations on an interactive world map.",
  icons: { icon: "/favicon.png" },
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
