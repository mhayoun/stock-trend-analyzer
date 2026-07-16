import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trend Tape — Stock Trend Analyzer",
  description:
    "Runs a same-direction trend analysis on a stock's daily closes: distribution of winning/losing streaks, strong-move follow-through, and reversal odds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-ink text-fg antialiased">{children}</body>
    </html>
  );
}
