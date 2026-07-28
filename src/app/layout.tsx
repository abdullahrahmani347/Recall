import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recall — Study, Notes & Flashcards",
  description:
    "Capture notes, get AI summaries, turn them into flashcards, and review with spaced repetition. Mobile-first, offline-ready.",
  keywords: ["Recall", "study", "notes", "flashcards", "spaced repetition", "FSRS"],
  authors: [{ name: "Recall" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Recall — Study, Notes & Flashcards",
    description: "Capture, summarize, and remember — mobile-first.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#14161A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow zoom for accessibility (WCAG 1.4.4)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <QueryProvider>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            {children}
            <Toaster />
            <SonnerToaster position="top-center" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
