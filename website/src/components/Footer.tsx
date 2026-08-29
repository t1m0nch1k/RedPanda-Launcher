import React from "react";
import Link from "next/link";
import Image from "next/image";
import { IconBrandTelegram, IconBrandGithub, IconArrowUpRight, IconShieldCheck, IconCpu, IconRocket } from "@tabler/icons-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60 pt-16 pb-12 font-mono text-xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-border">
          {/* Бренд */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3.5 group">
              <div className="w-10 h-10 p-1 bg-card border border-border group-hover:border-primary flex items-center justify-center transition-colors brutalist-shadow-orange">
                <Image
                  src="/logo.png"
                  width={32}
                  height={32}
                  alt="RedPanda Launcher Logo"
                  className="object-contain"
                />
              </div>
              <span className="font-display font-bold text-base tracking-wider text-foreground group-hover:text-primary transition-colors">
                REDPANDA LAUNCHER
              </span>
            </Link>
            <p className="text-muted leading-relaxed text-xs max-w-sm">
              Высокопроизводительный Open-Source лаунчер Minecraft нового поколения на стеке Rust & Tauri. Поддержка Modrinth, CurseForge, P2P игра по сети без открытия портов и нулевая реклама.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://t.me/redpanda_launcher"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-muted hover:text-foreground hover:border-primary transition-colors text-[11px]"
              >
                <IconBrandTelegram size={14} className="text-sky-400" />
                <span>@redpanda_launcher</span>
              </a>
              <a
                href="https://github.com/t1m0nch1k/RedPanda-Launcher"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-muted hover:text-foreground hover:border-primary transition-colors text-[11px]"
              >
                <IconBrandGithub size={14} className="text-primary" />
                <span>GitHub</span>
              </a>
            </div>
          </div>

          {/* Разделы сайта */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Разделы
            </p>
            <ul className="space-y-2 text-muted">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Главная</span>
                </Link>
              </li>
              <li>
                <Link href="/minecraft-news" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Новости Minecraft</span>
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Журнал версий</span>
                </Link>
              </li>
              <li>
                <Link href="/mods" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Каталог модов</span>
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>База знаний (FAQ)</span>
                </Link>
              </li>
              <li>
                <Link href="/download" className="hover:text-foreground transition-colors flex items-center gap-1 text-primary font-bold">
                  <span>Скачать лаунчер</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Экосистема */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Технологии
            </p>
            <ul className="space-y-2 text-muted">
              <li className="flex items-center gap-1.5">
                <IconCpu size={14} className="text-primary" />
                <span>Rust & Tauri 2.0</span>
              </li>
              <li className="flex items-center gap-1.5">
                <IconShieldCheck size={14} className="text-emerald-400" />
                <span>AES-256 Vault</span>
              </li>
              <li className="flex items-center gap-1.5">
                <IconRocket size={14} className="text-sky-400" />
                <span>e4mc & Steam P2P</span>
              </li>
              <li>
                <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Modrinth API</span>
                  <IconArrowUpRight size={12} />
                </a>
              </li>
              <li>
                <a href="https://curseforge.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>CurseForge API</span>
                  <IconArrowUpRight size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Быстрая загрузка */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Релиз v0.2.1
            </p>
            <p className="text-muted text-[11px] leading-relaxed">
              Автономный инсталлятор для Windows 10/11 x64.
            </p>
            <Link
              href="/download"
              className="inline-block w-full text-center bg-primary hover:bg-primary-hover text-black py-2.5 px-3 font-display font-bold text-xs uppercase tracking-wider transition-colors brutalist-button"
            >
              Скачать v0.2.1 (.exe)
            </Link>
            <p className="text-[10px] text-muted">Размер: 38.6 МБ · SHA-256 Verified</p>
          </div>
        </div>

        {/* Копирайт и дисклеймер */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-muted text-[11px]">
          <p>
            © 2026 RedPanda Launcher. Распространяется по лицензии Open Source.
          </p>
          <p className="text-center md:text-right text-[10px] max-w-lg">
            Minecraft является зарегистрированным товарным знаком Mojang AB / Microsoft. RedPanda Launcher не связан с Mojang AB.
          </p>
        </div>
      </div>
    </footer>
  );
}
