"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { IconCookie, IconCheck, IconX, IconShieldCheck, IconAdjustmentsHorizontal } from "@tabler/icons-react";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [adsEnabled, setAdsEnabled] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem("redpanda_cookie_consent");
    if (!consent) {
      // Показываем с небольшой задержкой для плавности
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(
      "redpanda_cookie_consent",
      JSON.stringify({ necessary: true, analytics: true, ads: true, date: new Date().toISOString() })
    );
    setShow(false);
  };

  const handleAcceptNecessary = () => {
    localStorage.setItem(
      "redpanda_cookie_consent",
      JSON.stringify({ necessary: true, analytics: false, ads: false, date: new Date().toISOString() })
    );
    setShow(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem(
      "redpanda_cookie_consent",
      JSON.stringify({
        necessary: true,
        analytics: analyticsEnabled,
        ads: adsEnabled,
        date: new Date().toISOString()
      })
    );
    setShow(false);
    setShowSettings(false);
  };

  if (!show) return null;

  return (
    <aside
      aria-label="Уведомление об использовании файлов cookie"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 font-mono text-xs"
    >
      <div className="brutalist-card p-5 border-primary bg-background/95 backdrop-blur-xl brutalist-shadow-orange shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-[11px] tracking-wider">
            <IconCookie size={18} className="animate-spin-slow" />
            <span>Файлы Cookie & Конфиденциальность</span>
          </div>
          <button
            onClick={handleAcceptNecessary}
            className="text-muted hover:text-foreground transition-colors p-1"
            title="Закрыть (только обязательные)"
          >
            <IconX size={16} />
          </button>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">
          Мы используем обязательные cookies для работы сайта, а также аналитические и рекламные cookies (РСЯ) для персонализации сервиса. Подробнее в{" "}
          <Link href="/privacy" className="text-primary underline hover:text-primary-hover">
            Политике конфиденциальности
          </Link>
          .
        </p>

        {showSettings ? (
          <div className="space-y-2.5 pt-2 border-t border-border/60 text-[11px]">
            <div className="flex items-center justify-between p-2 bg-card/60 border border-border">
              <div>
                <p className="font-bold text-foreground">Технические (Обязательные)</p>
                <p className="text-muted text-[10px]">Для работы навигации и безопасности</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">Включено</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-card/60 border border-border">
              <div>
                <p className="font-bold text-foreground">Аналитические cookies</p>
                <p className="text-muted text-[10px]">Сбор анонимной статистики посещаемости</p>
              </div>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-2 bg-card/60 border border-border">
              <div>
                <p className="font-bold text-foreground">Рекламные cookies (Яндекс РСЯ)</p>
                <p className="text-muted text-[10px]">Персонализация объявлений</p>
              </div>
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(e) => setAdsEnabled(e.target.checked)}
                className="accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <button
              onClick={handleSaveCustom}
              className="w-full py-2 bg-primary text-black font-bold uppercase tracking-wider text-xs brutalist-button cursor-pointer"
            >
              Сохранить настройки
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleAcceptAll}
              className="flex-1 py-2 px-3 bg-primary hover:bg-primary-hover text-black font-display font-bold uppercase tracking-wider text-xs brutalist-button transition-colors cursor-pointer"
            >
              Принять все
            </button>
            <button
              onClick={handleAcceptNecessary}
              className="py-2 px-3 bg-card hover:bg-card-hover border border-border text-foreground text-xs uppercase transition-colors cursor-pointer"
            >
              Только важные
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-card hover:bg-card-hover border border-border text-muted hover:text-foreground transition-colors cursor-pointer"
              title="Настроить cookies"
            >
              <IconAdjustmentsHorizontal size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
