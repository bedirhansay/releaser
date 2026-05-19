import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Editorial serif reserved for display moments (hero headlines, pull-quotes).
// Instrument Serif pairs well with Geist and has a true italic with character.
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Releaser — turn commits into release notes",
  description:
    "Compare any two refs or merged PRs and let Releaser draft polished, categorized release notes — with risk analysis baked in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
