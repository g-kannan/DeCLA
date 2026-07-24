import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeCLA — Decision Canvas",
  description: "Map source-to-consumption latency and cost for data architecture decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
