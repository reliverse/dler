import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.reliverse.org"),
  title: {
    default: "Rempts - The Minimal CLI Framework for Bun",
    template: "%s | Rempts",
  },
  description:
    "Build type-safe CLIs with Rempts. Zero config, full TypeScript support, powered by Bun.",
  keywords: [
    "cli",
    "bun",
    "typescript",
    "command-line",
    "terminal",
    "developer-tools",
    "type-safe",
    "minimal",
  ],
  authors: [{ name: "Arya Labs, Inc." }],
  openGraph: {
    title: "Rempts - The Minimal CLI Framework for Bun",
    description: "Build type-safe CLIs with zero configuration",
    url: "https://docs.reliverse.org",
    siteName: "Rempts",
    type: "website",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rempts - The Minimal CLI Framework for Bun",
    description: "Build type-safe CLIs with zero configuration",
    images: ["/og-image.png"],
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
