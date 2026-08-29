"use client";

import React, { useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { ModCard } from "../../components/ModCard";
import { TOP_MODS } from "../../data/modsData";
import { IconPuzzle, IconSearch, IconFlame, IconCheck } from "@tabler/icons-react";

export default function ModsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [selectedLoader, setSelectedLoader] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["Все", "Оптимизация", "Графика", "Мультиплеер", "Интерфейс"];
  const loaders = ["Все", "Fabric", "Forge", "NeoForge"];

  const filteredMods = TOP_MODS.filter((mod) => {
    const matchesCat = selectedCategory === "Все" || mod.category === selectedCategory;
    const matchesLoader = selectedLoader === "Все" || mod.loaders.includes(selectedLoader as any);
    const matchesSearch = 
      mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesLoader && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Заголовок */}
        <div className="mb-10 pb-8 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-3">
            <IconPuzzle size={16} />
            <span>Recommended Modpacks & Mods</span>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl uppercase tracking-tight text-foreground mb-4">
            Каталог рекомендованных модов
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed font-mono">
            Подборка лучших и проверенных модификаций для стабильного высокого FPS, фотореалистичной графики, позиционного голосового чата и комфортной игры.
          </p>
        </div>

        {/* Фильтры и поиск */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {/* Категории */}
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-primary text-black font-bold brutalist-button"
                    : "bg-card border border-border text-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}

            <span className="hidden sm:inline text-border">|</span>

            {/* Загрузчики */}
            {loaders.map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLoader(l)}
                className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer ${
                  selectedLoader === l
                    ? "bg-card border border-primary text-primary font-bold"
                    : "bg-card border border-border text-muted hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Поиск */}
          <div className="relative w-full lg:w-72">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или автору..."
              className="w-full bg-card border border-border pl-9 pr-3 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Сетка модов */}
        {filteredMods.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMods.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-border bg-card/40 p-8 font-mono">
            <p className="text-muted text-sm mb-2">Модов по выбранным фильтрам не найдено.</p>
            <button
              onClick={() => { setSelectedCategory("Все"); setSelectedLoader("Все"); setSearchQuery(""); }}
              className="text-primary hover:underline text-xs uppercase font-bold"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {/* Подсказка об установке в лаунчере */}
        <div className="mt-14 p-6 brutalist-card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base uppercase text-foreground">
              Установка в 1 клик прямо в RedPanda Launcher
            </h3>
            <p className="text-xs font-mono text-muted">
              Лаунчер автоматически скачивает все необходимые зависимости (Fabric API, Cloth Config, Architecture API).
            </p>
          </div>
          <a
            href="/download"
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-display font-bold text-xs uppercase tracking-wider shrink-0 brutalist-button"
          >
            Скачать лаунчер
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
