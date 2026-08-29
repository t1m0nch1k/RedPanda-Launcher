"use client";

import React, { useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { FAQ_ITEMS } from "../../data/faqData";
import { IconHelp, IconChevronDown, IconSearch, IconBrandTelegram } from "@tabler/icons-react";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["Все", "Установка и Запуск", "Мультиплеер", "Моды и Шейдеры", "Безопасность", "Производительность"];

  const filteredFaq = FAQ_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === "Все" || item.category === selectedCategory;
    const matchesSearch = 
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Заголовок */}
        <div className="mb-10 pb-8 border-b border-border text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-3">
            <IconHelp size={16} />
            <span>Knowledge Base & Wiki</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight mb-4">
            База знаний и частые вопросы
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed font-mono">
            Ответы на популярные вопросы о настройке Java, совместной игре через e4mc P2P, управлении модами и криптографической защите аккаунтов.
          </p>
        </div>

        {/* Поиск и категории */}
        <div className="space-y-4 mb-8">
          <div className="relative w-full">
            <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Найти ответ на вопрос..."
              className="w-full bg-card border border-border pl-10 pr-4 py-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-primary text-black font-bold brutalist-button"
                    : "bg-card border border-border text-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Аккордеон вопросов */}
        <div className="space-y-3">
          {filteredFaq.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="brutalist-card p-0 overflow-hidden border border-border hover:border-primary/60 transition-colors"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase text-primary mb-1 block">
                      // {item.category}
                    </span>
                    <h3 className="font-display font-bold text-sm sm:text-base text-foreground leading-snug">
                      {item.q}
                    </h3>
                  </div>
                  <IconChevronDown
                    size={20}
                    className={`text-primary transition-transform duration-300 shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="p-5 pt-0 border-t border-border/50 bg-background/50 font-mono text-xs sm:text-sm text-muted leading-relaxed">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Блок поддержки */}
        <div className="mt-14 p-8 brutalist-card text-center space-y-4">
          <h3 className="font-display font-bold text-xl uppercase text-foreground">
            Не нашли ответ на свой вопрос?
          </h3>
          <p className="text-muted text-xs sm:text-sm font-mono max-w-lg mx-auto">
            Задайте вопрос разработчикам и сообществу в нашем официальном Telegram-канале. Мы оперативно помогаем решить любые проблемы.
          </p>
          <a
            href="https://t.me/redpanda_launcher"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-6 py-3 font-display font-bold text-xs uppercase tracking-wider transition-colors brutalist-button"
          >
            <IconBrandTelegram size={18} />
            <span>Задать вопрос в Telegram</span>
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
