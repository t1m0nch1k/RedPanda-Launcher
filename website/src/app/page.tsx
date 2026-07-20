"use client";

import Image from "next/image";
import { IconDownload, IconBolt, IconPuzzle, IconLayoutGrid, IconRocket, IconBrandTelegram, IconBrandGithub, IconTerminal2 } from "@tabler/icons-react";

export default function Home() {
  const features = [
    { icon: <IconBolt size={24} />, title: "LIGHTNING_FAST", desc: "{ built_with: 'Rust & Tauri',\n  memory_footprint: 'minimal',\n  startup: 'instant' }" },
    { icon: <IconLayoutGrid size={24} />, title: "MODERN_UI", desc: "{ design: 'cyber-brutalism',\n  animations: 'static/fast',\n  feels: 'native' }" },
    { icon: <IconPuzzle size={24} />, title: "MODRINTH_NATIVE", desc: "{ action: 'search_download_manage',\n  scope: 'in-launcher' }" },
    { icon: <IconRocket size={24} />, title: "MULTI_LOADER", desc: "[ 'Vanilla',\n  'Fabric',\n  'Forge',\n  'Quilt',\n  'NeoForge' ]" },
  ];

  return (
    <div className="min-h-screen relative selection:bg-primary selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 p-4 sm:p-6 flex justify-between items-center bg-background border-b border-border">
        <div className="flex items-center gap-3">
          <IconTerminal2 className="text-primary" size={28} />
          <span className="font-bold text-lg tracking-widest text-white uppercase font-display">RedPanda</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-muted uppercase">
          <a href="#features" className="hover:text-primary transition-colors cursor-pointer">Features</a>
          <a href="#gallery" className="hover:text-primary transition-colors cursor-pointer">Interface</a>
        </div>
        <a href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/latest" target="_blank" className="bg-border hover:bg-primary text-white px-5 py-2 font-bold transition-colors flex items-center gap-2 cursor-pointer uppercase text-sm border border-transparent hover:border-primary">
          <IconBrandGithub size={18} /> [ GitHub ]
        </a>
      </nav>

      {/* Hero Section */}
      <main className="pt-40 pb-20 px-6 max-w-[1400px] mx-auto flex flex-col items-start justify-center min-h-[90vh]">
        <div className="w-full flex flex-col items-start">
          <div className="mb-12 p-4 bg-card border border-border inline-block relative">
             <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-primary"></div>
             <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-primary"></div>
             <Image src="/logo.png" width={100} height={100} alt="RedPanda Launcher Logo" className="object-contain grayscale hover:grayscale-0 transition-all duration-300" />
          </div>
          
          <h1 className="text-white mb-6 uppercase font-bold">
            RedPanda<br/><span className="text-primary">Launcher</span>
          </h1>
          <p className="text-xl md:text-2xl text-primary font-bold mb-4">{"{ STATUS: 'READY' }"}</p>
          <p className="text-lg md:text-xl text-muted mb-12 max-w-2xl font-mono leading-relaxed">
            // Built for Vanilla, Fabric, Forge, NeoForge, and Quilt.<br/>
            // Every pixel has a purpose. Less clutter, more playing.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
            <a href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/latest" target="_blank" className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-white px-10 py-5 font-bold text-lg transition-colors border border-primary cursor-pointer uppercase">
              <IconDownload size={24} /> DOWNLOAD.EXE
            </a>
            <a href="#features" className="w-full sm:w-auto flex items-center justify-center gap-3 bg-transparent hover:bg-card border border-border text-white px-10 py-5 font-bold text-lg transition-colors cursor-pointer uppercase">
              READ_DOCS()
            </a>
          </div>
        </div>
      </main>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 border-t border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-12 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold">INTERFACE_PREVIEW</h2>
            <p className="text-muted font-mono">{"// Array of visual components"}</p>
          </div>
        </div>
        
        {/* Infinite Carousel */}
        <div className="flex w-max animate-marquee mt-8">
          {[1, 2].map((set) => (
            <div key={set} className="flex gap-8 pr-8">
              {[
                { num: 2, w: 1304, h: 805 },
                { num: 3, w: 544, h: 464 },
                { num: 4, w: 531, h: 660 },
                { num: 5, w: 1127, h: 662 },
                { num: 6, w: 1126, h: 658 }
              ].map((item, idx) => (
                <div 
                  key={`${set}-${idx}`} 
                  className="h-[250px] sm:h-[350px] md:h-[450px] lg:h-[550px] flex-shrink-0 border border-border bg-background p-2 relative group grayscale hover:grayscale-0 transition-all duration-500 cursor-grab active:cursor-grabbing"
                  style={{ aspectRatio: `${item.w} / ${item.h}` }}
                >
                  <Image src={`/screenshots/screenshot_${item.num}.png`} fill alt={`Launcher Screenshot ${item.num}`} className="object-cover" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-border">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold">SYSTEM_FEATURES</h2>
            <p className="text-muted font-mono">{"// We threw away the legacy baggage"}</p>
          </div>
          
          <div className="brutalist-grid">
            {features.map((feature, idx) => (
              <div key={idx} className="brutalist-card hover:border-primary transition-colors group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 text-border group-hover:text-primary/20 transition-colors">
                  <span className="font-display text-6xl font-bold opacity-50">0{idx + 1}</span>
                </div>
                <div className="w-12 h-12 bg-border group-hover:bg-primary text-white flex items-center justify-center mb-8 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white uppercase">{feature.title}</h3>
                <p className="text-muted font-mono break-words leading-relaxed whitespace-pre-wrap">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-card">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-4">
            <IconTerminal2 className="text-primary" size={32} />
            <div>
              <div className="font-bold text-white uppercase font-display tracking-widest text-xl">RedPanda</div>
              <div className="text-muted font-mono text-xs mt-1">{"// COPYRIGHT 2026"}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-muted font-bold uppercase text-sm">
            <a href="https://t.me/redpanda_launcher" target="_blank" className="hover:text-primary transition-colors flex items-center gap-2">
              <IconBrandTelegram size={18} /> [ Telegram ]
            </a>
            <a href="https://github.com/t1m0nch1k/RedPanda-Launcher" target="_blank" className="hover:text-primary transition-colors flex items-center gap-2">
              <IconBrandGithub size={18} /> [ GitHub ]
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
