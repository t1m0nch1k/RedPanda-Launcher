"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { IconDownload, IconBolt, IconPuzzle, IconLayoutGrid, IconRocket, IconBrandTelegram, IconBrandGithub, IconHeart } from "@tabler/icons-react";

export default function Home() {
  const features = [
    { icon: <IconBolt size={24} />, title: "Lightning Fast", desc: "Built with Rust and Tauri for minimal memory footprint and instant startup times." },
    { icon: <IconLayoutGrid size={24} />, title: "Modern Desktop UI", desc: "A gorgeous, glassmorphism-inspired design with smooth animations that feels native." },
    { icon: <IconPuzzle size={24} />, title: "Modrinth Native", desc: "Easily search, download, and manage mods directly within the launcher." },
    { icon: <IconRocket size={24} />, title: "Multiple Loaders", desc: "Native, seamless support for Vanilla, Fabric, Forge, Quilt, and NeoForge." },
  ];

  return (
    <div className="min-h-screen relative selection:bg-primary/30">
      {/* Background glow effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-5xl pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 p-6 flex justify-between items-center bg-background/50 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" width={32} height={32} alt="RedPanda Logo" className="object-contain" />
          <span className="font-semibold text-lg tracking-wide text-white/90">RedPanda Launcher</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-muted">
          <a href="#features" className="hover:text-white transition-colors cursor-pointer">Features</a>
          <a href="#philosophy" className="hover:text-white transition-colors cursor-pointer">Philosophy</a>
        </div>
        <a href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/latest" target="_blank" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer">
          <IconBrandGithub size={16} /> GitHub
        </a>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl flex flex-col items-center"
        >
          <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md inline-block shadow-2xl">
             <Image src="/logo.png" width={128} height={128} alt="RedPanda Launcher Logo" className="object-contain drop-shadow-[0_0_15px_rgba(245,94,29,0.5)]" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
            The modern Minecraft launcher.
          </h1>
          <p className="text-xl md:text-2xl text-muted font-medium mb-2">Beautiful. Fast. Intelligent.</p>
          <p className="text-lg md:text-xl text-muted/70 mb-10 max-w-2xl">
            Built for Vanilla, Fabric, Forge, NeoForge, and Quilt. Every pixel has a purpose. Less clutter, more playing.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a href="https://github.com/t1m0nch1k/RedPanda-Launcher/releases/latest" target="_blank" className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-[0_0_30px_rgba(245,94,29,0.3)] cursor-pointer">
              <IconDownload size={20} /> Download for Windows
            </a>
            <a href="#features" className="flex items-center gap-2 bg-card hover:bg-card-hover border border-border text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors cursor-pointer">
              Learn More
            </a>
          </div>
        </motion.div>

        {/* Main Screenshot */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mt-20 w-full rounded-2xl border border-border/50 overflow-hidden shadow-[0_0_50px_rgba(245,94,29,0.1)] relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none"></div>
          <Image src="/screenshots/screenshot_1.png" width={1200} height={675} alt="RedPanda Launcher Main Interface" className="w-full h-auto object-cover" />
        </motion.div>
      </main>

      {/* Gallery Section */}
      <section id="gallery" className="pt-12 pb-24 relative z-10 bg-background/50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">A glance at the interface.</h2>
          </div>
        </div>
        
        {/* Infinite Carousel */}
        <div className="flex w-max animate-marquee mt-8">
          {[1, 2].map((set) => (
            <div key={set} className="flex gap-6 md:gap-8 pr-6 md:pr-8">
              {[
                { num: 2, w: 1304, h: 805 },
                { num: 3, w: 544, h: 464 },
                { num: 4, w: 531, h: 660 },
                { num: 5, w: 1127, h: 662 },
                { num: 6, w: 1126, h: 658 }
              ].map((item, idx) => (
                <div 
                  key={`${set}-${idx}`} 
                  className="h-[250px] sm:h-[350px] md:h-[450px] lg:h-[550px] flex-shrink-0 rounded-2xl overflow-hidden border border-border/50 shadow-xl hover:border-primary/50 relative group cursor-grab active:cursor-grabbing"
                  style={{ aspectRatio: `${item.w} / ${item.h}` }}
                >
                  <Image src={`/screenshots/screenshot_${item.num}.png`} fill alt={`Launcher Screenshot ${item.num}`} className="object-cover group-hover:scale-[1.02] transition-transform duration-700" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      {/* Features */}
      <section id="features" className="py-24 px-6 relative z-10 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Crafted to perfection.</h2>
            <p className="text-muted text-lg">We threw away the legacy baggage to build something truly modern.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="glass-panel p-8 hover:border-white/20 transition-colors">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section id="philosophy" className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <IconHeart className="mx-auto text-primary mb-6" size={48} />
          <h2 className="text-4xl font-bold mb-8">Why RedPanda?</h2>
          <div className="text-xl text-muted/90 space-y-4 font-medium">
            <p>Most Minecraft launchers focus on adding more settings.</p>
            <p>RedPanda focuses on making Minecraft easier to enjoy.</p>
            <p className="pt-4 text-white">Minimal interface. Fast startup. Beautiful experience.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" width={24} height={24} alt="RedPanda Logo" className="object-contain grayscale hover:grayscale-0 transition-all" />
            <span className="font-semibold text-muted">RedPanda Launcher</span>
          </div>
          <div className="flex items-center gap-6 text-muted">
            <a href="https://t.me/redpanda_launcher" target="_blank" className="hover:text-white transition-colors cursor-pointer flex items-center gap-2">
              <IconBrandTelegram size={18} /> Telegram
            </a>
            <a href="https://github.com/t1m0nch1k/RedPanda-Launcher" target="_blank" className="hover:text-white transition-colors cursor-pointer flex items-center gap-2">
              <IconBrandGithub size={18} /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
