"use client";

import React, { useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { LAUNCHER_RELEASES } from "../../data/changelogData";
import { 
  IconHistory, 
  IconDownload, 
  IconShieldCheck, 
  IconSparkles, 
  IconBug, 
  IconBolt,
  IconCheck
} from "@tabler/icons-react";

export default function ChangelogPage() {
  const [filterType, setFilterType] = useState<string>("all");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Заголовок */}
        <div className="mb-12 pb-8 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-3">
            <IconHistory size={16} />
            <span>Release Notes & Changelog</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight mb-4">
            Журнал обновлений лаунчера
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed font-mono">
            Полная история версий RedPanda Launcher: внедрение новых технологий, аудит безопасности, оптимизация Rust-ядра и улучшение пользовательского опыта.
          </p>
        </div>

        {/* Список релизов */}
        <div className="space-y-12">
          {LAUNCHER_RELEASES.map((rel) => (
            <div key={rel.version} className="brutalist-card p-6 sm:p-8 relative">
              {/* Бейдж версии */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border mb-6">
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-2xl sm:text-3xl text-primary">
                    {rel.version}
                  </span>
                  {rel.isLatest && (
                    <span className="bg-primary text-black font-bold font-mono text-[10px] uppercase px-2 py-0.5 tracking-wider">
                      LATEST STABLE
                    </span>
                  )}
                  <span className="text-muted font-mono text-xs">
                    {rel.date}
                  </span>
                </div>

                <a
                  href={rel.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 font-display font-bold text-xs uppercase tracking-wider transition-all brutalist-button"
                >
                  <IconDownload size={16} />
                  <span>Скачать setup ({rel.fileSize})</span>
                </a>
              </div>

              {/* Название и слоган */}
              <h2 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-wide text-foreground mb-2">
                {rel.title}
              </h2>
              <p className="text-primary font-mono text-xs sm:text-sm mb-6">
                {rel.tagline}
              </p>

              {/* Ключевые хайлайты */}
              <div className="mb-8 p-4 bg-background border border-border">
                <p className="font-mono text-xs uppercase tracking-wider text-muted mb-3 font-bold">
                  // Ключевые нововведения:
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {rel.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-mono text-foreground">
                      <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Детальный чейнджлог */}
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-wider text-muted font-bold">
                  // Технические изменения:
                </p>
                <div className="space-y-3">
                  {rel.changes.map((c, i) => (
                    <div key={i} className="p-3.5 bg-card/40 border border-border flex items-start gap-3">
                      <div className="pt-0.5 shrink-0">
                        {c.type === "security" && <IconShieldCheck size={16} className="text-emerald-400" />}
                        {c.type === "feat" && <IconSparkles size={16} className="text-primary" />}
                        {c.type === "fix" && <IconBug size={16} className="text-amber-400" />}
                        {c.type === "perf" && <IconBolt size={16} className="text-sky-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display font-bold text-xs uppercase text-foreground">
                            {c.title}
                          </span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-background border border-border text-muted">
                            {c.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted font-mono leading-relaxed">
                          {c.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
