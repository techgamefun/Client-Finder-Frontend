import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { Providers } from "./providers";
import { themeBootstrapScript } from "@/lib/theme";
import {
  WorkspaceLoadingScreen,
  WorkspaceShell,
} from "./components/workspace-shell";
import { SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: `${SITE_NAME} | Business Intelligence Agent`,
  description: "Discover, research, and manage websites for thoughtful outreach.",
  openGraph: {
    title: SITE_NAME,
    description: "Discover, research, and organize business opportunities.",
    url: SITE_ORIGIN,
    siteName: SITE_NAME,
    type: "website",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-preference-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <Providers>
          <Suspense fallback={<WorkspaceLoadingScreen />}>
            <WorkspaceShell>{children}</WorkspaceShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
