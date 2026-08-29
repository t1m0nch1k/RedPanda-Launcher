import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "../../../components/Navbar";
import { Footer } from "../../../components/Footer";
import { MINECRAFT_NEWS } from "../../../data/minecraftNews";
import { NewsCard } from "../../../components/NewsCard";
import { IconArrowLeft, IconCalendar, IconClock, IconUser, IconTag, IconDownload } from "@tabler/icons-react";

export function generateStaticParams() {
  return MINECRAFT_NEWS.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = MINECRAFT_NEWS.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const related = MINECRAFT_NEWS.filter((a) => a.slug !== slug).slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Хлебные крошки и возврат */}
        <div className="mb-8 flex items-center justify-between font-mono text-xs">
          <Link
            href="/minecraft-news"
            className="flex items-center gap-1.5 text-muted hover:text-primary transition-colors"
          >
            <IconArrowLeft size={16} />
            <span>Назад ко всем новостям</span>
          </Link>
          <span className="text-primary font-bold px-2 py-0.5 bg-primary/10 border border-primary/30 uppercase text-[10px]">
            {article.category}
          </span>
        </div>

        {/* Заголовок статьи */}
        <article className="brutalist-card p-6 sm:p-10 mb-12">
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-foreground uppercase tracking-tight leading-tight mb-6">
            {article.title}
          </h1>

          {/* Метаданные */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted pb-6 border-b border-border mb-8">
            <span className="flex items-center gap-1">
              <IconUser size={14} className="text-primary" />
              <span>{article.author}</span>
            </span>
            <span className="flex items-center gap-1">
              <IconCalendar size={14} />
              <span>{article.date}</span>
            </span>
            <span className="flex items-center gap-1">
              <IconClock size={14} />
              <span>{article.readTime} чтения</span>
            </span>
          </div>

          {/* Текст статьи */}
          <div className="space-y-6 font-mono text-sm leading-relaxed text-foreground/90">
            {article.content.map((paragraph, index) => (
              <p key={index} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Теги */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-muted flex items-center gap-1">
              <IconTag size={14} />
              <span>Теги:</span>
            </span>
            {article.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] font-mono px-2 py-0.5 bg-background border border-border text-muted"
              >
                #{t}
              </span>
            ))}
          </div>

          {/* Интерактивный CTA баннер */}
          <div className="mt-8 p-6 bg-primary/5 border border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display font-bold text-sm text-foreground uppercase">
                Хотите протестировать эти новинки?
              </p>
              <p className="text-xs font-mono text-muted mt-1">
                Скачайте RedPanda Launcher — играйте с модами и шейдерами в 1 клик.
              </p>
            </div>
            <Link
              href="/download"
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 font-display font-bold text-xs uppercase shrink-0 brutalist-button"
            >
              <IconDownload size={16} />
              <span>Скачать v0.2.1</span>
            </Link>
          </div>
        </article>

        {/* Похожие новости */}
        {related.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-xl uppercase tracking-wider mb-6 text-foreground">
              // Другие материалы
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((r) => (
                <NewsCard key={r.slug} article={r} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
