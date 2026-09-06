import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CyberBackground } from "./components/CyberBackground";

interface ModpackBuilderPromoProps {
  version?: string;
  siteUrl?: string;
}

const mono = "'JetBrains Mono', monospace";
const display = "'Space Grotesk', sans-serif";

const sceneContainerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: 1080,
  height: 1920,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 60px",
  boxSizing: "border-box",
};

function SceneBadge({ children, color = "#F55E1D" }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        color,
        border: `2px solid ${color}`,
        backgroundColor: `${color}1A`,
        padding: "10px 24px",
        fontFamily: mono,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 3,
        textTransform: "uppercase",
        boxShadow: `0 0 20px ${color}33`,
      }}
    >
      {children}
    </div>
  );
}

// ==========================================
// SCENE 1: THE HOOK (Frames 0 - 85 / ~2.8s)
// ==========================================
function HookScene({ version }: { version: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const cardSpring = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 100 } });
  const pulse = Math.sin(frame / 6) * 6;

  return (
    <div style={{ ...sceneContainerStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${titleSpring})`, marginBottom: 36 }}>
        <SceneBadge>// РЕВОЛЮЦИЯ В MINECRAFT // {version}</SceneBadge>
      </div>

      <h1
        style={{
          transform: `scale(${titleSpring})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 72,
          lineHeight: 1.05,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 24px",
          textShadow: "0 0 36px rgba(245, 94, 29, 0.4)",
        }}
      >
        СОБРАТЬ СБОРКУ
        <br />
        <span style={{ color: "#F55E1D" }}>В 1 КЛИК БЕЗ КРАШЕЙ?</span>
      </h1>

      <p
        style={{
          color: "#C5CAD3",
          fontFamily: mono,
          fontSize: 28,
          lineHeight: 1.4,
          maxWidth: 880,
          margin: "0 0 44px",
        }}
      >
        ЗАБУДЬ ПРО ЧАСЫ ПОИСКА МОДОВ И ОШИБКИ ЗАПУСКА!
      </p>

      {/* Old Way vs New Way Comparison */}
      <div
        style={{
          transform: `translateY(${interpolate(cardSpring, [0, 1], [50, 0])}px)`,
          opacity: cardSpring,
          width: "100%",
          maxWidth: 920,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Old Way */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "24px 28px",
            backgroundColor: "#161114",
            border: "2px solid #EF4444",
            boxShadow: "6px 6px 0 #EF4444",
            textAlign: "left",
            fontFamily: mono,
          }}
        >
          <span style={{ fontSize: 36 }}>❌</span>
          <div>
            <div style={{ color: "#EF4444", fontSize: 24, fontWeight: 900 }}>СТАРЫЙ СПОСОБ:</div>
            <div style={{ color: "#8E939E", fontSize: 21, marginTop: 4 }}>
              Искать 50 модов вручную → забыть зависимости → <span style={{ color: "#EF4444", fontWeight: 700 }}>Exit Code 1</span>
            </div>
          </div>
        </div>

        {/* New Way */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "24px 28px",
            backgroundColor: "#111815",
            border: "2px solid #22C55E",
            boxShadow: `0 0 ${20 + pulse}px rgba(34, 197, 94, 0.4), 6px 6px 0 #22C55E`,
            textAlign: "left",
            fontFamily: mono,
          }}
        >
          <span style={{ fontSize: 36 }}>✨</span>
          <div>
            <div style={{ color: "#22C55E", fontSize: 24, fontWeight: 900 }}>REDPANDA CONSTRUCTOR:</div>
            <div style={{ color: "#FFFFFF", fontSize: 21, marginTop: 4, fontWeight: 600 }}>
              Выбери любимые тематики → лаунчер сделает всё сам!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================
// SCENE 2: THE BUILDER THEMES (Frames 85 - 195 / ~3.6s)
// ====================================================
function BuilderThemesScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });

  const categories = [
    {
      icon: "🪄",
      title: "МАГИЯ & ЗАКЛИНАНИЯ",
      mods: "Iron's Spells, Ars Nouveau, Botania",
      color: "#A855F7",
      selected: true,
    },
    {
      icon: "⚔️",
      title: "ПРИКЛЮЧЕНИЯ & ДАНЖИ",
      mods: "Alex's Mobs, Cataclysm, Better Combat",
      color: "#EF4444",
      selected: true,
    },
    {
      icon: "⚙️",
      title: "ТЕХНОЛОГИИ & CREATE",
      mods: "Create, Mekanism, AE2, Steam 'n' Rails",
      color: "#3B82F6",
      selected: true,
    },
    {
      icon: "⚡",
      title: "FPS БУСТ & ШЕЙДЕРЫ",
      mods: "Sodium, Lithium, Iris, FerriteCore",
      color: "#22C55E",
      selected: true,
    },
  ];

  return (
    <div style={{ ...sceneContainerStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${titleSpring})`, marginBottom: 30 }}>
        <SceneBadge color="#A855F7">// 01 // SMART MODPACK BUILDER [BETA]</SceneBadge>
      </div>

      <h2
        style={{
          transform: `scale(${titleSpring})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 66,
          lineHeight: 1.05,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        ВЫБИРАЙ ТЕМАТИКИ
        <br />
        <span style={{ color: "#A855F7" }}>ПОД СВОЙ ВКУС</span>
      </h2>

      <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 24, margin: "0 0 34px" }}>
        Версии 1.20.1 · 1.19.2 · 26.2 | Fabric & Forge
      </p>

      {/* Grid of Theme Cards */}
      <div style={{ width: "100%", maxWidth: 940, display: "flex", flexDirection: "column", gap: 16 }}>
        {categories.map((cat, index) => {
          const itemSpring = spring({ frame: frame - index * 8, fps, config: { damping: 14, stiffness: 120 } });
          const pulseBorder = Math.sin((frame - index * 6) / 5) * 4;

          return (
            <div
              key={cat.title}
              style={{
                opacity: itemSpring,
                transform: `translateX(${interpolate(itemSpring, [0, 1], [60, 0])}px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                backgroundColor: "#13151B",
                border: `2px solid ${cat.color}`,
                boxShadow: `0 0 ${12 + pulseBorder}px ${cat.color}44, 6px 6px 0 ${cat.color}`,
                textAlign: "left",
                fontFamily: mono,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span style={{ fontSize: 38 }}>{cat.icon}</span>
                <div>
                  <div style={{ color: "#FFFFFF", fontFamily: display, fontSize: 26, fontWeight: 900 }}>
                    {cat.title}
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 19, marginTop: 4 }}>
                    {cat.mods}
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: `${cat.color}22`,
                  border: `2px solid ${cat.color}`,
                  color: cat.color,
                  padding: "6px 14px",
                  fontSize: 20,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                ✓ ВЫБРАНО
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 32,
          padding: "14px 28px",
          backgroundColor: "#F55E1D1A",
          border: "2px solid #F55E1D",
          color: "#F55E1D",
          fontFamily: mono,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        // АЛГОРИТМ ПОДБИРАЕТ ТОЛЬКО СОВМЕСТИМЫЕ ВЕРСИИ
      </div>
    </div>
  );
}

// ==========================================================
// SCENE 3: AUTO-DEPENDENCY ENGINE (Frames 195 - 310 / ~3.8s)
// ==========================================================
function AutoDependencyScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const progress = interpolate(frame, [15, 85], [12, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const depLogs = [
    { name: "Create 0.5.1", type: "MOD", status: "СКАЧАНО", color: "#3B82F6" },
    { name: "Fabric API", type: "DEPENDENCY", status: "АВТО-ПОДТЯНУТО", color: "#22C55E" },
    { name: "Curios API", type: "DEPENDENCY", status: "АВТО-ПОДТЯНУТО", color: "#22C55E" },
    { name: "Architectury", type: "DEPENDENCY", status: "АВТО-ПОДТЯНУТО", color: "#22C55E" },
    { name: "Cloth Config", type: "DEPENDENCY", status: "АВТО-ПОДТЯНУТО", color: "#22C55E" },
  ];

  return (
    <div style={{ ...sceneContainerStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${titleSpring})`, marginBottom: 30 }}>
        <SceneBadge color="#22C55E">// 02 // ZERO CRASH ENGINE</SceneBadge>
      </div>

      <h2
        style={{
          transform: `scale(${titleSpring})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 66,
          lineHeight: 1.05,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        ЗАВИСИМОСТИ?
        <br />
        <span style={{ color: "#22C55E" }}>СКАЧАЮТСЯ АВТОМАТОМ!</span>
      </h2>

      <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 24, margin: "0 0 34px" }}>
        Каскадный поиск скрытых библиотек по дереву проекта
      </p>

      {/* Terminal Visualizer */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          backgroundColor: "#0F1116",
          border: "3px solid #282C34",
          boxShadow: "10px 10px 0 #22C55E",
          padding: "24px 28px",
          textAlign: "left",
          fontFamily: mono,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", color: "#8E939E", fontSize: 20, borderBottom: "2px solid #232730", paddingBottom: 14, marginBottom: 18 }}>
          <span>REDPANDA_BUILDER_STREAM</span>
          <span style={{ color: "#22C55E" }}>STATUS: RESOLVING</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {depLogs.map((log, index) => {
            const rowVisible = frame >= index * 12 + 8;
            return (
              <div
                key={log.name}
                style={{
                  opacity: rowVisible ? 1 : 0.2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: log.color }}>›</span>
                  <span style={{ color: "#FFFFFF", fontWeight: 700 }}>{log.name}</span>
                  <span style={{ color: "#6B7280", fontSize: 18 }}>[{log.type}]</span>
                </div>
                <span style={{ color: log.color, fontWeight: 800 }}>{rowVisible ? log.status : "ОЖИДАНИЕ..."}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: "2px solid #232730" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            <span style={{ color: "#D7DAE0" }}>СБОРКА ПАКЕТА:</span>
            <span style={{ color: "#22C55E" }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ width: "100%", height: 18, backgroundColor: "#1C1F26", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #F55E1D 0%, #22C55E 100%)",
                boxShadow: "0 0 16px rgba(34, 197, 94, 0.7)",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 36, color: "#22C55E", fontFamily: mono, fontSize: 26, fontWeight: 900 }}>
        ✓ 100% ГОТОВО К ИГРЕ ЗА СЕКУНДЫ
      </div>
    </div>
  );
}

// ====================================================
// SCENE 4: NEW ENGINE IN v0.3.0 (Frames 310 - 400 / ~3.0s)
// ====================================================
function ModernEngineScene({ version }: { version: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });

  const features = [
    {
      icon: "🚀",
      title: "MINECRAFT 26.X & СНАПШОТЫ",
      desc: "Поддержка новейших снапшотов и релизов прямо в списке версий",
      color: "#F55E1D",
    },
    {
      icon: "☕",
      title: "УМНАЯ JAVA 21",
      desc: "Автоматический выбор и привязка среды для любого движка",
      color: "#38BDF8",
    },
    {
      icon: "🎨",
      title: "RGB COLOR PICKER",
      desc: "Выбирай любой цвет акцентов и тем оформления лаунчера",
      color: "#FBBF24",
    },
  ];

  return (
    <div style={{ ...sceneContainerStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${titleSpring})`, marginBottom: 30 }}>
        <SceneBadge color="#38BDF8">// 03 // NEW ENGINE // {version}</SceneBadge>
      </div>

      <h2
        style={{
          transform: `scale(${titleSpring})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 66,
          lineHeight: 1.05,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        ЕЩЁ БОЛЬШЕ СВОБОДЫ
        <br />
        <span style={{ color: "#38BDF8" }}>В ОБНОВЛЕНИИ {version}</span>
      </h2>

      <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 24, margin: "0 0 40px" }}>
        Максимальная скорость, кастомизация и надежность
      </p>

      <div style={{ width: "100%", maxWidth: 920, display: "flex", flexDirection: "column", gap: 20 }}>
        {features.map((feat, index) => {
          const itemSpring = spring({ frame: frame - index * 9, fps, config: { damping: 14, stiffness: 120 } });
          return (
            <div
              key={feat.title}
              style={{
                opacity: itemSpring,
                transform: `translateX(${interpolate(itemSpring, [0, 1], [70, 0])}px)`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "22px 26px",
                backgroundColor: "#14171E",
                border: `2px solid ${feat.color}`,
                boxShadow: `6px 6px 0 ${feat.color}`,
                textAlign: "left",
                fontFamily: mono,
              }}
            >
              <span style={{ fontSize: 42 }}>{feat.icon}</span>
              <div>
                <div style={{ color: "#FFFFFF", fontFamily: display, fontSize: 27, fontWeight: 900 }}>
                  {feat.title}
                </div>
                <div style={{ color: "#9CA3AF", fontSize: 20, marginTop: 4 }}>
                  {feat.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==============================================
// SCENE 5: CALL TO ACTION (Frames 400 - 480 / ~2.7s)
// ==============================================
function CallToActionScene({ version, siteUrl }: { version: string; siteUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const pulse = Math.sin(frame / 4) * 14 + 26;

  return (
    <div style={{ ...sceneContainerStyle, textAlign: "center" }}>
      {/* Brand Icon */}
      <div
        style={{
          transform: `scale(${enter})`,
          width: 170,
          height: 170,
          backgroundColor: "#16181F",
          border: "4px solid #F55E1D",
          boxShadow: `0 0 40px rgba(245, 94, 29, 0.4), 8px 8px 0 #F55E1D`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 36,
        }}
      >
        <Img src={staticFile("logo.png")} style={{ width: 120, height: 120, objectFit: "contain" }} />
      </div>

      <h2
        style={{
          transform: `scale(${enter})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 66,
          lineHeight: 1.05,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        ТВОЙ ИДЕАЛЬНЫЙ
        <br />
        <span style={{ color: "#F55E1D" }}>MINECRAFT ЖДЁТ</span>
      </h2>

      <p
        style={{
          color: "#9CA3AF",
          fontFamily: mono,
          fontSize: 25,
          lineHeight: 1.35,
          margin: "0 0 40px",
        }}
      >
        НОВОЕ ОБНОВЛЕНИЕ {version} УЖЕ ДОСТУПНО
        <br />
        КОНСТРУКТОР СБОРОК [BETA]
      </p>

      {/* Primary Download Button */}
      <div
        style={{
          transform: `scale(${enter})`,
          width: "100%",
          maxWidth: 840,
          padding: "26px 32px",
          backgroundColor: "#F55E1D",
          color: "#000000",
          border: "4px solid #000000",
          boxShadow: `0 0 ${pulse}px rgba(245, 94, 29, 0.8), 8px 8px 0 #000000`,
          fontFamily: display,
          fontSize: 38,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        ⬇ СКАЧАТЬ В 1 КЛИК ⬇
      </div>

      {/* Domain */}
      <div
        style={{
          marginTop: 34,
          color: "#FFFFFF",
          fontFamily: mono,
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: 2,
          textShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
        }}
      >
        {siteUrl.toUpperCase()}
      </div>

      {/* Profile link */}
      <div
        style={{
          marginTop: 44,
          color: "#F55E1D",
          fontFamily: mono,
          fontSize: 26,
          fontWeight: 800,
        }}
      >
        // ССЫЛКА В ШАПКЕ ПРОФИЛЯ
      </div>
    </div>
  );
}

// ==============================================
// MAIN COMPOSITION
// ==============================================
export const ModpackBuilderPromo: React.FC<ModpackBuilderPromoProps> = ({
  version = "v0.3.0",
  siteUrl = "redlauncher.ru",
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0B0E" }}>
      {/* Background with glowing cyber grid */}
      <CyberBackground version={version} />

      {/* Scene 1: The Hook (0 - 85 frames / 0.0s - 2.8s) */}
      <Sequence from={0} durationInFrames={85}>
        <HookScene version={version} />
      </Sequence>

      {/* Scene 2: Interactive Theme Selection (85 - 195 frames / 2.8s - 6.5s) */}
      <Sequence from={85} durationInFrames={110}>
        <BuilderThemesScene />
      </Sequence>

      {/* Scene 3: Auto-Dependency Engine & Progress (195 - 310 frames / 6.5s - 10.3s) */}
      <Sequence from={195} durationInFrames={115}>
        <AutoDependencyScene />
      </Sequence>

      {/* Scene 4: Modern Minecraft Engine & Features (310 - 400 frames / 10.3s - 13.3s) */}
      <Sequence from={310} durationInFrames={90}>
        <ModernEngineScene version={version} />
      </Sequence>

      {/* Scene 5: Call to Action & Download (400 - 480 frames / 13.3s - 16.0s) */}
      <Sequence from={400} durationInFrames={80}>
        <CallToActionScene version={version} siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
