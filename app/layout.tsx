import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeCLA — Decision Latency Architecture",
  description: "Map, version, compare, and save business decision processes locally.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
