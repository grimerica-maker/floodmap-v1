import "mapbox-gl/dist/mapbox-gl.css";

export const metadata = {
  title: "Floodmap V1",
  description: "Flood map app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
