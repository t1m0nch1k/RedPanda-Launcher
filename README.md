<div align="center">
  <img src="logo.png" width="128" alt="RedPanda Launcher Logo" />
  <h1>RedPanda Launcher</h1>
  <p>
    <a href="https://t.me/redpanda_launcher">Telegram</a> •
    <a href="https://www.tiktok.com/@redpanda_launcher?_r=1&_t=ZS-989vwnwL4LN">TikTok</a> •
    <a href="https://github.com/t1m0nch1k/RedPanda-Launcher">GitHub</a>
  </p>
</div>

A beautiful, modern, and lightweight Minecraft launcher built with Tauri, React, and TypeScript.
Powered by the robust `lighty-launcher` core on the backend, RedPanda provides a smooth experience for playing vanilla and modded Minecraft (Fabric, Forge, NeoForge, Quilt).

## ✨ Features

- **Modern UI/UX**: Clean, glassmorphism-inspired design with smooth animations.
- **Multiple Loaders**: Native support for Vanilla, Fabric, Forge, Quilt, and NeoForge.
- **Mod & Resource Pack Management**: Easily search, download, and manage mods directly from Modrinth within the launcher.
- **.mrpack Support**: Import and export Modrinth modpacks seamlessly.
- **Fast & Lightweight**: Built with Rust and Tauri, ensuring minimal memory footprint and fast startup times.
- **Customizable**: Customize Java arguments, memory allocation, and more per instance.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [Rust](https://www.rust-lang.org/)
- Minecraft Account (Microsoft) or Offline Account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/redpanda-launcher.git
cd redpanda-launcher
```

2. Install dependencies
```bash
npm install
```

3. Run in development mode
```bash
npm run tauri dev
```

### Build for Production
```bash
npm run tauri build
```

## 🛠️ Technology Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Rust, Tauri, lighty-launcher (Minecraft core)
- **Tooling**: Vite, TypeScript

## 📄 License
This project is open-source. (Add your license here)
