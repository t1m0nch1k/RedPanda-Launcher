import type { Metadata } from "next";
import "./globals.css";
import { CookieBanner } from "../components/CookieBanner";
import { ScrollToTop } from "../components/ScrollToTop";
import { YandexAds } from "../components/YandexAds";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.3.1";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.redlauncher.ru"),
  title: "RedPanda Launcher (Ред Лаунчер) — Скачать лаунчер Майнкрафт",
  description: "Скачать RedPanda Launcher для Windows 10/11 x64. Minecraft лаунчер на Rust и Tauri с диагностикой сборок, Modrinth и CurseForge.",
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
    description: "Современный лаунчер Майнкрафт на Rust & Tauri. Моды из Modrinth и CurseForge, P2P-игра и 3D-скины.",
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
      "operatingSystem": "Windows 10, Windows 11 (x64)",
      "applicationCategory": "GameApplication",
      "softwareVersion": APP_VERSION,
      "description": "Лаунчер Minecraft на Rust и Tauri с поддержкой Modrinth, CurseForge, мультиплеера и 3D-скинов.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "RUB"
      },
      "url": "https://www.redlauncher.ru/",
      "downloadUrl": `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.3.1/RedPanda_Setup_${APP_VERSION}.exe`,
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-background text-text">
        {children}
        <CookieBanner />
        <ScrollToTop />

        <YandexAds />
      </body>
    </html>
  );
}
