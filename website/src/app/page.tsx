"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { NewsCard } from "../components/NewsCard";
import { ModCard } from "../components/ModCard";
import { MINECRAFT_NEWS } from "../data/minecraftNews";
import { LAUNCHER_RELEASES } from "../data/changelogData";
import { TOP_MODS } from "../data/modsData";
import { FAQ_ITEMS } from "../data/faqData";
import { 
  IconDownload, 
  IconBolt, 
  IconPuzzle, 
  IconLayoutGrid, 
  IconRocket, 
  IconGlobe, 
  IconShieldLock,
  IconHistory,
  IconNews,
  IconArrowUpRight,
  IconChevronDown,
  IconCheck,
  IconHelp
} from "@tabler/icons-react";

export default function Home() {
  const [typedIndex, setTypedIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const typedPhrases = [
    "[ LIGHTNING_FAST ]",
    "[ CUSTOM_GUI_INSTALLER ]",
    "[ AES_256_GCM_VAULT ]",
    "[ MODRINTH_&_CURSEFORGE ]",
    "[ E4MC_&_STEAM_P2P ]",
    "[ 3D_SKIN_PREVIEWER ]",
    "[ ZERO_BLOATWARE ]"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTypedIndex((prev) => (prev + 1) % typedPhrases.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [typedPhrases.length]);

  const features = [
    { icon: <IconBolt size={24} />, title: "LIGHTNING_FAST", desc: "{ built_with: 'Rust & Tauri',\n  memory_footprint: 'minimal',\n  startup: '< 0.8s' }" },
    { icon: <IconLayoutGrid size={24} />, title: "CUSTOM_GUI_INSTALLER", desc: "{ type: 'cyber_brutalist_gui',\n  setup: 'RedPanda_Setup_0.2.1.exe',\n  registry_integration: true }" },
    { icon: <IconShieldLock size={24} />, title: "AES_256_VAULT_&_SECURITY", desc: "{ encryption: 'AES-256-GCM + OsRng',\n  path_traversal: 'safe_join_protection',\n  concurrency: 'mutex_synchronized' }" },
    { icon: <IconPuzzle size={24} />, title: "DUAL_MOD_ECOSYSTEM", desc: "{ sources: ['Modrinth', 'CurseForge'],\n  dependencies: 'recursive_auto_resolve',\n  scope: 'mods_shaders_resourcepacks' }" },
    { icon: <IconGlobe size={24} />, title: "E4MC_&_STEAM_P2P", desc: "{ modes: ['e4mc.link', 'e4steam'],\n  p2p_hosting: 'built-in',\n  ports_required: false }" },
    { icon: <IconRocket size={24} />, title: "3D_SKIN_PREVIEWER", desc: "{ engine: 'skinview3d',\n  sources: ['Ely.by', 'Mojang', 'Fallback'],\n  interactivity: 'rotate & animate' }" },
  ];

  const metrics = [
    { value: "< 0.8s", label: "STARTUP_TIME", sub: "Мгновенный запуск UI" },
    { value: "40 MB", label: "RAM_FOOTPRINT", sub: "Минимум ресурсов в фоне" },
    { value: "5", label: "MOD_LOADERS", sub: "Fabric, Forge, NeoForge, etc." },
    { value: "100%", label: "OPEN_SOURCE", sub: "0 рекламы и телеметрии" },
  ];

  const latestRelease = LAUNCHER_RELEASES[0];
  const latestNews = MINECRAFT_NEWS.slice(0, 3);
  const featuredMods = TOP_MODS.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <main className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto flex flex-col items-start justify-center min-h-[80vh] relative w-full">
        {/* Floating System Status Badge */}
        <div className="hidden lg:block absolute top-16 right-8 p-4 bg-card border border-border font-mono text-xs text-muted w-72">
          <div className="text-primary font-bold mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            SYSTEM_DIAGNOSTICS
          </div>
          <div className="space-y-1">
            <div>STATUS: <span className="text-white">ONLINE</span></div>
            <div>VERSION: <span className="text-white">v0.2.1_RELEASE</span></div>
            <div>SECURITY: <span className="text-white">AES_256_GCM_VAULT</span></div>
            <div>INSTALLER: <span className="text-white">STANDALONE_GUI</span></div>
            <div>MULTIPLAYER: <span className="text-white">E4MC_&_STEAM</span></div>
          </div>
        </div>

        <div className="w-full flex flex-col items-start">
          <div className="mb-8 p-4 bg-card border border-border inline-block relative brutalist-shadow-orange">
             <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-primary"></div>
             <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-primary"></div>
             <Image src="/logo.png" width={90} height={90} alt="RedPanda Launcher Logo" className="object-contain" priority />
          </div>
          
          <h1 className="text-white mb-4 uppercase font-bold tracking-tight">
            RedPanda<br/><span className="text-primary">Launcher</span>
          </h1>

          {/* Dynamic Typed-Effect Badge */}
          <div className="h-10 mb-6 flex items-center">
            <span className="text-xl md:text-2xl text-primary font-bold font-mono transition-all duration-300">
              {typedPhrases[typedIndex]}
            </span>
          </div>

          <p className="text-sm sm:text-base md:text-lg text-muted mb-10 max-w-2xl font-mono leading-relaxed bg-card/40 p-4 border-l-2 border-primary">
            // Высокопроизводительный лаунчер Майнкрафт нового поколения на Rust & Tauri.<br/>
            // Кастомный GUI установщик, AES-256 хранилище, Modrinth & CurseForge, e4mc/e4steam и 3D скины.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link 
              href="/download" 
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-black px-8 py-4 font-bold text-base transition-all cursor-pointer uppercase brutalist-button"
            >
              <IconDownload size={22} /> СКАЧАТЬ_SETUP_v0.2.1.EXE
            </Link>
            <Link 
              href="/minecraft-news" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-card hover:bg-background border border-border text-white px-6 py-4 font-bold text-base transition-colors cursor-pointer uppercase"
            >
              <IconNews size={18} className="text-primary" /> НОВОСТИ_И_ГАЙДЫ
            </Link>
          </div>
        </div>
      </main>

      {/* Metrics Section */}
      <section id="metrics" className="py-14 border-t border-b border-border bg-card/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {metrics.map((m, idx) => (
              <div key={idx} className="p-5 sm:p-6 bg-background border border-border brutalist-shadow-orange">
                <div className="text-3xl md:text-5xl font-bold font-display text-primary mb-1 sm:mb-2">{m.value}</div>
                <div className="text-xs sm:text-sm font-bold text-white uppercase mb-1">{m.label}</div>
                <div className="text-[11px] sm:text-xs text-muted font-mono">{`// ${m.sub}`}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Свежие новости Minecraft */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12 border-l-4 border-primary pl-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-1">
                <IconNews size={16} />
                <span>Minecraft Newsroom</span>
              </div>
              <h2 className="text-white font-bold uppercase">Свежие новости и обзоры</h2>
            </div>
            <Link
              href="/minecraft-news"
              className="flex items-center gap-1 text-primary hover:underline font-mono text-xs font-bold uppercase tracking-wider"
            >
              <span>Все новости ({MINECRAFT_NEWS.length})</span>
              <IconArrowUpRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {latestNews.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </section>

      {/* Section: Последний релиз лаунчера v0.2.1 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-card/40">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12 border-l-4 border-primary pl-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-1">
                <IconHistory size={16} />
                <span>Release Spotlight</span>
              </div>
              <h2 className="text-white font-bold uppercase">Текущее обновление лаунчера</h2>
            </div>
            <Link
              href="/changelog"
              className="flex items-center gap-1 text-primary hover:underline font-mono text-xs font-bold uppercase tracking-wider"
            >
              <span>История версий</span>
              <IconArrowUpRight size={16} />
            </Link>
          </div>

          <div className="brutalist-card p-6 sm:p-10 border-primary/50">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border mb-6">
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-3xl text-primary">{latestRelease.version}</span>
                <span className="bg-primary text-black font-bold font-mono text-[10px] uppercase px-2 py-0.5 tracking-wider">
                  STABLE RELEASE
                </span>
                <span className="text-muted font-mono text-xs">{latestRelease.date}</span>
              </div>
              <Link
                href="/download"
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 font-display font-bold text-xs uppercase brutalist-button"
              >
                <IconDownload size={16} />
                <span>Установить v0.2.1</span>
              </Link>
            </div>

            <h3 className="font-display font-bold text-xl sm:text-2xl text-foreground uppercase mb-2">
              {latestRelease.title}
            </h3>
            <p className="text-primary font-mono text-xs sm:text-sm mb-6">
              {latestRelease.tagline}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {latestRelease.highlights.slice(0, 3).map((h, i) => (
                <div key={i} className="p-3 bg-background border border-border flex items-start gap-2 text-xs font-mono">
                  <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold">ИНТЕРФЕЙС ЛАУНЧЕРА</h2>
            <p className="text-muted font-mono">{"// Чистый кибер-брутализм без рекламы"}</p>
          </div>
        </div>
        
        {/* Infinite Carousel */}
        <div className="flex w-max animate-marquee mt-4">
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
                  className="h-[240px] sm:h-[350px] md:h-[450px] lg:h-[500px] flex-shrink-0 border border-border bg-background p-2 relative group hover:border-primary transition-all duration-300"
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
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-b border-border">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold">ОСНОВНЫЕ ВОЗМОЖНОСТИ</h2>
            <p className="text-muted font-mono">{"// Всё, что нужно для комфортной игры в Майнкрафт"}</p>
          </div>
          
          <div className="brutalist-grid">
            {features.map((feature, idx) => (
              <div key={idx} className="brutalist-card brutalist-shadow-orange group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 text-border group-hover:text-primary/20 transition-colors">
                  <span className="font-display text-5xl font-bold opacity-30">0{idx + 1}</span>
                </div>
                <div className="w-12 h-12 bg-border group-hover:bg-primary text-white flex items-center justify-center mb-8 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 text-white uppercase">{feature.title}</h3>
                <p className="text-muted font-mono text-sm break-words leading-relaxed whitespace-pre-wrap">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Каталог модов превью */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-card/30">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12 border-l-4 border-primary pl-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-1">
                <IconPuzzle size={16} />
                <span>Featured Mods</span>
              </div>
              <h2 className="text-white font-bold uppercase">Популярные моды</h2>
            </div>
            <Link
              href="/mods"
              className="flex items-center gap-1 text-primary hover:underline font-mono text-xs font-bold uppercase tracking-wider"
            >
              <span>Весь каталог модов ({TOP_MODS.length})</span>
              <IconArrowUpRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredMods.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        </div>
      </section>

      {/* SEO FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 border-b border-border bg-card/40">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-14 border-l-4 border-primary pl-6">
            <div>
              <h2 className="text-white font-bold uppercase font-display flex items-center gap-3">
                <IconHelp className="text-primary" size={30} />
                Часто задаваемые вопросы
              </h2>
              <p className="text-muted font-mono text-xs mt-1">{"// Быстрые ответы о лаунчере и игре"}</p>
            </div>
            <Link
              href="/faq"
              className="flex items-center gap-1 text-primary hover:underline font-mono text-xs font-bold uppercase tracking-wider"
            >
              <span>Вся база знаний</span>
              <IconArrowUpRight size={16} />
            </Link>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.slice(0, 4).map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-card border border-border transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-card-hover transition-colors"
                  >
                    <span className="font-bold text-white text-sm sm:text-base font-display flex items-center gap-3">
                      <span className="text-primary font-mono text-xs">0{idx + 1}.</span>
                      {faq.q}
                    </span>
                    <IconChevronDown 
                      className={`text-primary shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
                      size={20} 
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-border/60 text-muted font-mono text-xs sm:text-sm leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
