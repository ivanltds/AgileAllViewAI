import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgileAllView",
  description: "Azure DevOps analytics dashboard — visibility across all squads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[var(--bg)] antialiased">{children}</body>
    </html>
  );
}
