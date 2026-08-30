import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { CookieBanner } from "../components/CookieBanner";
import { ScrollToTop } from "../components/ScrollToTop";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.redlauncher.ru"),
  title: "RedPanda Launcher (Ред Лаунчер) — Скачать быстрый лаунчер Майнкрафт без рекламы",
  description: "Скачать RedPanda Launcher (Ред Лаунчер / RedLauncher) v0.2.2 для Windows. Быстрый и лёгкий Minecraft лаунчер на Rust & Tauri с диагностикой сборок и управлением модами. Поддержка Modrinth и CurseForge, e4mc, Steam P2P, 3D скины и 0 рекламы.",
  keywords: [
    "редлаунчер",
    "ред лаунчер",
    "redlauncher",
    "redlauncher что это",
    "редлаунчер это",
    "скачать ред лаунчер",
    "скачать redlauncher",
    "скачать ред лаунчер майнкрафт",
    "redlauncher майнкрафт",
    "ред панда лаунчер",
    "майнкрафт лаунчер",
    "скачать лаунчер майнкрафт",
    "redpanda launcher",
    "minecraft launcher",
    "лаунчер с модами",
    "modrinth лаунчер",
    "curseforge лаунчер",
    "e4mc мультиплеер",
    "e4steam",
    "ely.by лаунчер",
    "лаунчер без рекламы",
    "minecraft лаунчер на пк",
    "красивый лаунчер майнкрафт",
    "быстрый лаунчер майнкрафт"
  ],
  authors: [{ name: "RedPanda Team" }],
  creator: "RedPanda Team",
  publisher: "RedPanda Team",
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://www.redlauncher.ru/",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "RedPanda Launcher — Современный Minecraft лаунчер нового поколения",
    description: "Сверхбыстрый лаунчер Майнкрафт на Rust & Tauri. Моды из Modrinth & CurseForge, P2P игра по сети без Хамачи, 3D скины и ноль рекламы.",
    url: "https://www.redlauncher.ru/",
    siteName: "RedPanda Launcher",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "RedPanda Launcher Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "RedPanda Launcher — Быстрый лаунчер Майнкрафт",
    description: "Современный Minecraft лаунчер на Rust & Tauri. Modrinth, CurseForge, e4mc мультиплеер и 3D скины.",
    images: ["/logo.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "RedPanda Launcher",
      "url": "https://www.redlauncher.ru/",
      "description": "Официальный сайт RedPanda Launcher — Open-Source лаунчера Minecraft нового поколения на Rust & Tauri.",
      "publisher": {
        "@type": "Organization",
        "name": "RedPanda Team",
        "url": "https://www.redlauncher.ru",
        "logo": "https://www.redlauncher.ru/logo.png"
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "RedPanda Launcher",
      "operatingSystem": "Windows 10, Windows 11, Windows 8, Windows 7 (x64)",
      "applicationCategory": "GameApplication",
      "softwareVersion": "0.2.2",
      "description": "Высокопроизводительный лаунчер Minecraft на Rust и Tauri с поддержкой Modrinth, CurseForge, встроенным мультиплеером e4mc/Steam и 3D скинами.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "RUB"
      },
      "url": "https://www.redlauncher.ru/",
      "downloadUrl": "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.2/RedPanda_Setup_0.2.2.exe",
      "fileSize": "38.8MB",
      "author": {
        "@type": "Organization",
        "name": "RedPanda Team"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <meta name="theme-color" content="#F55E1D" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-background text-text">
        {children}
        <CookieBanner />
        <ScrollToTop />

        {/* Yandex Autoplacement 19834583 */}
        <Script
          src="https://yandex.ru/ads/system/context.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://yandex.ru/ads/system/ap-loader.js"
          strategy="afterInteractive"
          data-page-id="19834583"
        />
      </body>
    </html>
  );
}
