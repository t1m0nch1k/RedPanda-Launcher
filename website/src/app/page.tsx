"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { 
  IconDownload, 
  IconBolt, 
  IconPuzzle, 
  IconLayoutGrid, 
  IconRocket, 
  IconBrandTelegram, 
  IconBrandGithub, 
  IconTerminal2, 
  IconGlobe, 
  IconCpu,
  IconHelp,
  IconChevronDown,
  IconCheck
} from "@tabler/icons-react";

export default function Home() {
  const [typedIndex, setTypedIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const typedPhrases = [
    "[ LIGHTNING_FAST ]",
    "[ CUSTOM_GUI_INSTALLER ]",
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
    { icon: <IconLayoutGrid size={24} />, title: "CUSTOM_GUI_INSTALLER", desc: "{ type: 'cyber_brutalist_gui',\n  setup: 'RedPanda_Setup_0.2.0.exe',\n  registry_integration: true }" },
    { icon: <IconPuzzle size={24} />, title: "DUAL_MOD_ECOSYSTEM", desc: "{ sources: ['Modrinth', 'CurseForge'],\n  dependencies: 'recursive_auto_resolve',\n  scope: 'mods_shaders_resourcepacks' }" },
    { icon: <IconGlobe size={24} />, title: "E4MC_&_STEAM_P2P", desc: "{ modes: ['e4mc.link', 'e4steam'],\n  p2p_hosting: 'built-in',\n  ports_required: false }" },
    { icon: <IconRocket size={24} />, title: "3D_SKIN_PREVIEWER", desc: "{ engine: 'skinview3d',\n  sources: ['Ely.by', 'Mojang', 'Fallback'],\n  interactivity: 'rotate & animate' }" },
    { icon: <IconCpu size={24} />, title: "ADVANCED_INSTANCE_CONTROL", desc: "{ custom_java: 'auto_detect & path',\n  ram_tuning: 'per_instance',\n  backups: 'zip_export_import' }" },
  ];

  const metrics = [
    { value: "< 0.8s", label: "STARTUP_TIME", sub: "Instant UI load" },
    { value: "45 MB", label: "RAM_FOOTPRINT", sub: "Minimal background usage" },
    { value: "5", label: "MOD_LOADERS", sub: "Fabric, Forge, NeoForge, etc." },
    { value: "100%", label: "OPEN_SOURCE", sub: "Zero ads & telemetry" },
  ];

  const faqs = [
    {
      q: "Как играть с друзьями по сети без открытия портов и сторонних программ?",
      a: "В RedPanda Launcher встроен мультиплеер на базе e4mc и Steam P2P (e4steam). Откройте мир для сети (LAN), лаунчер сгенерирует публичную безопасную ссылку или позволит пригласить друзей через Steam (Shift+Tab) без настройки роутера, белых IP и Хамачи."
    },
    {
      q: "Какие версии и мод-лоадеры поддерживает RedPanda Launcher?",
      a: "Поддерживаются абсолютно все версии Minecraft (от классических релизов до новейших снапшотов 1.21+), а также ключевые загрузчики модов: Fabric, Forge, NeoForge, Quilt и чистая Vanilla."
    },
    {
      q: "Как устроена загрузка модов, шейдеров и ресурс-паков?",
      a: "Прямо внутри лаунчера доступен единый каталог Modrinth и CurseForge. Вы можете искать, устанавливать и обновлять моды в один клик с автоматической рекурсивной установкой всех требуемых библиотек и зависимостей."
    },
    {
      q: "Поддерживаются ли аккаунты Ely.by и Microsoft?",
      a: "Да! Вы можете авторизоваться через официальный аккаунт Microsoft, систему скинов Ely.by или играть в автономном (офлайн) режиме. Все скины и плащи отображаются в интерактивном 3D вьювере."
    },
    {
      q: "Почему RedPanda Launcher работает быстрее традиционных лаунчеров?",
      a: "Лаунчер написан на нативном Rust и Tauri, минуя тяжелые среды вроде Electron или Java-интерфейсов. Время холодного старта — менее 0.8 секунд, а потребление оперативной памяти в фоне составляет всего ~40 МБ."
    },
    {
      q: "Безопасен ли лаунчер и есть ли в нём реклама?",
      a: "RedPanda Launcher полностью бесплатен, свободен от рекламы, телеметрии и скрытых процессов. Исходный код открыт на GitHub для аудита сообществом."
    }
  ];

  return (
    <div className="min-h-screen relative selection:bg-primary selection:text-white">
      {/* Top Bar / Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 p-4 sm:p-6 flex justify-between items-center bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3">
          <IconTerminal2 className="text-primary" size={28} />
          <span className="font-bold text-lg tracking-widest text-white uppercase font-display">RedPanda</span>
          <span className="hidden sm:inline-block text-xs font-mono text-muted bg-card px-2 py-0.5 border border-border">{`{ v0.2.0 }`}</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-muted uppercase">
          <a href="#metrics" className="hover:text-primary transition-colors cursor-pointer">[ Metrics ]</a>
          <a href="#features" className="hover:text-primary transition-colors cursor-pointer">[ Features ]</a>
          <a href="#gallery" className="hover:text-primary transition-colors cursor-pointer">[ Interface ]</a>
          <a href="#faq" className="hover:text-primary transition-colors cursor-pointer">[ FAQ ]</a>
        </div>
        <a 
          href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/tag/v0.2.0" 
          target="_blank" 
          className="bg-card hover:bg-primary text-white px-5 py-2.5 font-bold transition-all flex items-center gap-2 cursor-pointer uppercase text-sm border border-border hover:border-primary brutalist-button"
        >
          <IconBrandGithub size={18} /> [ GitHub ]
        </a>
      </nav>

      {/* Hero Section */}
      <main className="pt-36 pb-20 px-6 max-w-[1400px] mx-auto flex flex-col items-start justify-center min-h-[85vh] relative">
        {/* Floating System Status Badge */}
        <div className="hidden lg:block absolute top-40 right-6 p-4 bg-card border border-border font-mono text-xs text-muted w-72">
          <div className="text-primary font-bold mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            SYSTEM_DIAGNOSTICS
          </div>
          <div className="space-y-1">
            <div>STATUS: <span className="text-white">ONLINE</span></div>
            <div>VERSION: <span className="text-white">v0.2.0_RELEASE</span></div>
            <div>INSTALLER: <span className="text-white">STANDALONE_GUI</span></div>
            <div>MULTIPLAYER: <span className="text-white">E4MC_&_STEAM</span></div>
          </div>
        </div>

        <div className="w-full flex flex-col items-start">
          <div className="mb-8 p-4 bg-card border border-border inline-block relative brutalist-shadow-orange">
             <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-primary"></div>
             <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-primary"></div>
             <Image src="/logo.png" width={90} height={90} alt="RedPanda Launcher Logo" className="object-contain" />
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

          <p className="text-base md:text-lg text-muted mb-10 max-w-2xl font-mono leading-relaxed bg-card/40 p-4 border-l-2 border-primary">
            // Высокопроизводительный лаунчер Майнкрафт нового поколения на Rust & Tauri.<br/>
            // Кастомный GUI установщик, Modrinth & CurseForge, e4mc/e4steam мультиплеер и 3D скины.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
            <a 
              href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.0/RedPanda_Setup_0.2.0.exe" 
              target="_blank" 
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-white px-10 py-5 font-bold text-lg transition-all border border-primary cursor-pointer uppercase brutalist-button"
            >
              <IconDownload size={24} /> СКАЧАТЬ_SETUP_v0.2.0.EXE
            </a>
            <a 
              href="#features" 
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-card hover:bg-background border border-border text-white px-10 py-5 font-bold text-lg transition-colors cursor-pointer uppercase"
            >
              ВОЗМОЖНОСТИ()
            </a>
          </div>
        </div>
      </main>

      {/* Metrics Section */}
      <section id="metrics" className="py-16 border-t border-b border-border bg-card/60">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {metrics.map((m, idx) => (
              <div key={idx} className="p-6 bg-background border border-border brutalist-shadow-orange">
                <div className="text-3xl md:text-5xl font-bold font-display text-primary mb-2">{m.value}</div>
                <div className="text-sm font-bold text-white uppercase mb-1">{m.label}</div>
                <div className="text-xs text-muted font-mono">{`// ${m.sub}`}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-12 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold">ИНТЕРФЕЙС ЛАУНЧЕРА</h2>
            <p className="text-muted font-mono">{"// Чистый кибер-брутализм без компромиссов"}</p>
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
                  className="h-[250px] sm:h-[350px] md:h-[450px] lg:h-[520px] flex-shrink-0 border border-border bg-background p-2 relative group hover:border-primary transition-all duration-300 cursor-grab active:cursor-grabbing"
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
      <section id="features" className="py-24 px-6 border-b border-border">
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

      {/* SEO FAQ Section */}
      <section id="faq" className="py-24 px-6 border-b border-border bg-card/40">
        <div className="max-w-[1000px] mx-auto">
          <div className="mb-16 border-l-4 border-primary pl-6">
            <h2 className="text-white mb-2 font-bold uppercase font-display flex items-center gap-3">
              <IconHelp className="text-primary" size={32} />
              Часто задаваемые вопросы (FAQ)
            </h2>
            <p className="text-muted font-mono">{"// Ответы на популярные вопросы о RedPanda Launcher"}</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-card border border-border transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-card-hover transition-colors"
                  >
                    <span className="font-bold text-white text-base md:text-lg font-display flex items-center gap-3">
                      <span className="text-primary font-mono text-sm">0{idx + 1}.</span>
                      {faq.q}
                    </span>
                    <IconChevronDown 
                      className={`text-primary shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
                      size={22} 
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-border/60 text-muted font-mono text-sm leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-card">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-4">
            <IconTerminal2 className="text-primary" size={32} />
            <div>
              <div className="font-bold text-white uppercase font-display tracking-widest text-xl">RedPanda</div>
              <div className="text-muted font-mono text-xs mt-1">{"// COPYRIGHT 2026 • BUILT WITH RUST & TAURI • REDLAUNCHER.RU"}</div>
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

