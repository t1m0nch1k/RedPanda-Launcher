import React from "react";
import Link from "next/link";
import { IconCalendar, IconClock, IconArrowUpRight, IconFlame } from "@tabler/icons-react";
import type { MinecraftArticle } from "../data/minecraftNews";

export function NewsCard({ article }: { article: MinecraftArticle }) {
  return (
    <article className="brutalist-card flex flex-col justify-between hover:border-primary transition-colors group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary border border-primary/30">
            {article.category}
          </span>
          {article.hot && (
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <IconFlame size={12} />
              <span>HOT</span>
            </span>
          )}
        </div>

        <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors leading-snug mb-2.5 break-words">
          <Link href={`/minecraft-news/${article.slug}`}>
            {article.title}
          </Link>
        </h3>

        <p className="text-muted text-xs leading-relaxed mb-4 line-clamp-3">
          {article.excerpt}
        </p>
      </div>

      <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-muted text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <IconCalendar size={13} />
            <span>{article.date}</span>
          </span>
          <span className="flex items-center gap-1">
            <IconClock size={13} />
            <span>{article.readTime}</span>
          </span>
        </div>

        <Link
          href={`/minecraft-news/${article.slug}`}
          className="flex items-center gap-1 text-primary group-hover:underline font-bold"
        >
          <span>Читать</span>
          <IconArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
