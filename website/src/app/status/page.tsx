"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { 
  IconActivity, 
} from "@tabler/icons-react";

interface ServiceStatus {
  id: string;
  name: string;
  category: "Minecraft Core" | "Community & Auth" | "Modding APIs" | "Multiplayer P2P";
  description: string;
  status?: "operational" | "degraded" | "outage" | "unknown";
  checkedAt?: string;
}

type StatusPayload = { checkedAt?: string; services?: Record<string, { status: ServiceStatus["status"] }> };

export default function StatusPage() {
  const [liveStatus, setLiveStatus] = useState<StatusPayload | null>(null);
  useEffect(() => {
    fetch("/status.json", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<StatusPayload> : null)
      .then((payload) => setLiveStatus(payload))
      .catch(() => setLiveStatus(null));
  }, []);

  const services: ServiceStatus[] = [
    {
      id: "minecraft-auth",
      name: "Mojang Authentication & Session",
      category: "Minecraft Core",
      description: "Официальные серверы проверки лицензий и сессий Microsoft / Mojang."
    },
    {
      id: "elyby",
      name: "Ely.by Skin & Account System",
      category: "Community & Auth",
      description: "Серверы авторизации и 3D-скинов системы Ely.by."
    },
    {
      id: "modrinth",
      name: "Modrinth API v2",
      category: "Modding APIs",
      description: "Каталог модов, модпаков, ресурс-паков и шейдеров Modrinth."
    },
    {
      id: "curseforge",
      name: "CurseForge Core API",
      category: "Modding APIs",
      description: "Поиск и загрузка модификаций из базы CurseForge."
    },
    {
      id: "e4mc",
      name: "e4mc P2P Tunneling Network",
      category: "Multiplayer P2P",
      description: "Серверы защищенных P2P-туннелей для сетевой игры без открытия портов."
    },
    {
      id: "redpanda-cdn",
      name: "RedPanda CDN & Update Server",
      category: "Minecraft Core",
      description: "Серверы доставки обновлений лаунчера и манифестов инсталлятора."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-10 pb-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
              <IconActivity size={16} />
              <span>Integration Status</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
              Статус сервисов
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-2">
              Список внешних сервисов, с которыми работает лаунчер. Их доступность может меняться независимо от RedPanda.
            </p>
          </div>
        </div>

        {/* Общий индикатор здоровья */}
        <div className="brutalist-card p-6 border-sky-500/40 bg-sky-500/5 mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-sky-400"></span>
            <div>
              <p className="font-display font-bold text-base uppercase text-foreground">
                {liveStatus ? "Состояние сервисов обновлено автоматически" : "Данные мониторинга пока недоступны"}
              </p>
              <p className="text-muted text-xs">
                {liveStatus?.checkedAt ? `Последняя проверка: ${new Date(liveStatus.checkedAt).toLocaleString("ru-RU")}` : "Статус отображается как Unknown, пока health-check не опубликовал данные."}
              </p>
            </div>
          </div>
          <span className="text-xs text-sky-400 font-bold uppercase hidden sm:inline">External Services</span>
        </div>

        {/* Сетка сервисов */}
        <div className="space-y-4">
          {services.map((svc) => {
            const status = liveStatus?.services?.[svc.id]?.status ?? "unknown";
            const statusLabel = { operational: "Operational", degraded: "Degraded", outage: "Outage", unknown: "Unknown" }[status];
            const statusClass = { operational: "bg-emerald-400", degraded: "bg-amber-400", outage: "bg-red-400", unknown: "bg-sky-400" }[status];
            return (
            <div key={svc.id} className="brutalist-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${statusClass}`}></span>
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

              <div className="flex items-center text-xs text-muted shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <span className="px-2 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase">
                  {statusLabel}
                  </span>
              </div>
            </div>
          );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
