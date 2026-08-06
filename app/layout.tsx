import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeCLA — Decision Latency Architecture",
  description: "Version, compare, and measure source-to-decision dataflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
