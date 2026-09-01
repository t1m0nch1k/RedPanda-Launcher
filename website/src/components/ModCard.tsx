import React from "react";
import { IconDownload, IconPuzzle, IconCheck } from "@tabler/icons-react";
import type { ModItem } from "../data/modsData";

export function ModCard({ mod }: { mod: ModItem }) {
  return (
    <div className="brutalist-card flex flex-col justify-between hover:border-primary transition-colors group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-card border border-border text-muted">
            {mod.category}
          </span>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <IconDownload size={12} />
            <span>{mod.downloads}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 bg-primary/10 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs shrink-0">
            {mod.name[0]}
          </div>
          <h3 className="font-display font-bold text-base text-foreground group-hover:text-primary transition-colors break-words">
            {mod.name}
          </h3>
        </div>

        <p className="text-muted text-[11px] font-mono mb-2">
          Автор: <span className="text-foreground/80">{mod.author}</span>
        </p>

        <p className="text-muted text-xs leading-relaxed mb-4">
          {mod.description}
        </p>
      </div>

      <div className="pt-3 border-t border-border flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {mod.loaders.map((l) => (
            <span
              key={l}
              className="text-[9px] font-mono px-1.5 py-0.5 bg-background border border-border text-muted"
            >
              {l}
            </span>
          ))}
        </div>

        <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider whitespace-nowrap">
          В каталоге ✔
        </span>
      </div>
    </div>
  );
}
