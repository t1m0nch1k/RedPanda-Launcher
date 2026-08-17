import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.redlauncher.ru"),
  title: "RedPanda Launcher — Быстрый лаунчер Майнкрафт с модами без рекламы",
  description: "Скачать RedPanda Launcher v0.2.1 для Windows. Быстрый и лёгкий Minecraft лаунчер на Rust & Tauri. Поддержка Modrinth и CurseForge, игра по сети без открытия портов (e4mc, Steam P2P), 3D скины и 0 рекламы.",
  keywords: [
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
  "@type": "SoftwareApplication",
  "name": "RedPanda Launcher",
  "operatingSystem": "Windows 10, Windows 11, Windows 8, Windows 7 (x64)",
  "applicationCategory": "GameApplication",
  "softwareVersion": "0.2.1",
  "description": "Высокопроизводительный лаунчер Minecraft на Rust и Tauri с поддержкой Modrinth, CurseForge, встроенным мультиплеером e4mc/Steam и 3D скинами.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "RUB"
  },
  "url": "https://www.redlauncher.ru/",
  "downloadUrl": "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.1/RedPanda_Setup_0.2.1.exe",
  "fileSize": "39MB",
  "author": {
    "@type": "Organization",
    "name": "RedPanda Team"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-background text-text">{children}</body>
    </html>
  );
}
