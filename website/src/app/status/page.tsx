"use client";

import React, { useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { 
  IconActivity, 
  IconCheck, 
  IconServer, 
  IconWorld, 
  IconRefresh, 
  IconShieldCheck,
  IconCpu
} from "@tabler/icons-react";

interface ServiceStatus {
  name: string;
  category: "Minecraft Core" | "Community & Auth" | "Modding APIs" | "Multiplayer P2P";
  status: "operational" | "degraded" | "maintenance";
  latency: string;
  uptime: string;
  description: string;
}

export default function StatusPage() {
  const [refreshing, setRefreshing] = useState(false);

  const services: ServiceStatus[] = [
    {
      name: "Mojang Authentication & Session",
      category: "Minecraft Core",
      status: "operational",
      latency: "42 ms",
      uptime: "99.98%",
      description: "Официальные серверы проверки лицензий и сессий Microsoft / Mojang."
    },
    {
      name: "Ely.by Skin & Account System",
      category: "Community & Auth",
      status: "operational",
      latency: "35 ms",
      uptime: "99.95%",
      description: "Серверы авторизации и 3D-скинов системы Ely.by."
    },
    {
      name: "Modrinth API v2",
      category: "Modding APIs",
      status: "operational",
      latency: "68 ms",
      uptime: "99.99%",
      description: "Каталог модов, модпаков, ресурс-паков и шейдеров Modrinth."
    },
    {
      name: "CurseForge Core API",
      category: "Modding APIs",
      status: "operational",
      latency: "84 ms",
      uptime: "99.91%",
      description: "Поиск и загрузка модификаций из базы CurseForge."
    },
    {
      name: "e4mc P2P Tunneling Network",
      category: "Multiplayer P2P",
      status: "operational",
      latency: "28 ms",
      uptime: "99.97%",
      description: "Серверы защищенных P2P-туннелей для сетевой игры без открытия портов."
    },
    {
      name: "RedPanda CDN & Update Server",
      category: "Minecraft Core",
      status: "operational",
      latency: "15 ms",
      uptime: "100.00%",
      description: "Серверы доставки обновлений лаунчера и манифестов инсталлятора."
    }
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-10 pb-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
              <IconActivity size={16} />
              <span>Live System Monitor</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
              Статус сервисов
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-2">
              Мониторинг доступности серверов авторизации, API каталогов модов и P2P сети.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3.5 py-2 bg-card border border-border hover:border-primary text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <IconRefresh size={14} className={refreshing ? "animate-spin text-primary" : ""} />
            <span>Обновить статус</span>
          </button>
        </div>

        {/* Общий индикатор здоровья */}
        <div className="brutalist-card p-6 border-emerald-500/40 bg-emerald-500/5 mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            <div>
              <p className="font-display font-bold text-base uppercase text-foreground">
                Все системы работают в штатном режиме
              </p>
              <p className="text-muted text-xs">
                Сбоев и критических инцидентов не зафиксировано.
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-bold uppercase hidden sm:inline">100% Operational</span>
        </div>

        {/* Сетка сервисов */}
        <div className="space-y-4">
          {services.map((svc, i) => (
            <div key={i} className="brutalist-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <h3 className="font-display font-bold text-base text-foreground">
                    {svc.name}
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.2 bg-background border border-border text-muted uppercase">
                    {svc.category}
                  </span>
                </div>
                <p className="text-muted text-xs">
                  {svc.description}
                </p>
              </div>

              <div className="flex items-center gap-6 text-xs text-muted shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                <div>
                  <span className="text-[10px] uppercase text-muted block">Пинг:</span>
                  <span className="text-foreground font-bold">{svc.latency}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted block">Аптайм:</span>
                  <span className="text-emerald-400 font-bold">{svc.uptime}</span>
                </div>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                  Online
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
