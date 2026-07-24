import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeCLA — Decision Latency Intelligence",
  description: "Map, measure, and export source-to-decision latency and cost for data architecture.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
