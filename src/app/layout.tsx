import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AriaRouterProvider } from "@/components/aria-router-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { MswBootstrap } from "./_mocks/MswBootstrap";

const playfairDisplayHeading = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tolo",
  applicationName: "Tolo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tolo",
    statusBarStyle: "default",
  },
  icons: {
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        notoSans.variable,
        playfairDisplayHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AriaRouterProvider>
              <PwaProvider>
                <MswBootstrap>{children}</MswBootstrap>
              </PwaProvider>
            </AriaRouterProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
