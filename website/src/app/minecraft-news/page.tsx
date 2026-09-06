"use client";

import React, { useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { NewsCard } from "../../components/NewsCard";
import { MINECRAFT_NEWS } from "../../data/minecraftNews";
import { IconSearch, IconNews } from "@tabler/icons-react";

export default function MinecraftNewsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["Все", "Обновления", "Моды и Шейдеры", "Гайды", "Снапшоты"];

  const filteredNews = MINECRAFT_NEWS.filter((item) => {
    const matchesCategory = selectedCategory === "Все" || item.category === selectedCategory;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Заголовок страницы */}
        <div className="mb-10 pb-8 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-3">
            <IconNews size={16} />
            <span>Minecraft Newsroom</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight mb-4">
            Новости & Гайды Minecraft
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed font-mono">
            Свежие анонсы обновлений от Mojang, обзоры лучших шейдеров и модов, пошаговые инструкции по оптимизации и сетевой игре.
          </p>
        </div>

        {/* Панель поиска и фильтрации */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-8">
          {/* Категории */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-primary text-black font-bold brutalist-button"
                    : "bg-card border border-border text-muted hover:text-foreground hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Поиск */}
          <div className="relative w-full md:w-72">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по статьям..."
              className="w-full bg-card border border-border pl-9 pr-3 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Сетка статей */}
        {filteredNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNews.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-border bg-card/40 p-8 font-mono">
            <p className="text-muted text-sm mb-2">Статей по вашему запросу не найдено.</p>
            <button
              onClick={() => { setSelectedCategory("Все"); setSearchQuery(""); }}
              className="text-primary hover:underline text-xs uppercase font-bold"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
