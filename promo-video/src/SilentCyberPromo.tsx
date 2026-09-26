import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from "remotion";
import { CyberBackground } from "./components/CyberBackground";

interface SilentCyberPromoProps {
  version?: string;
  siteUrl?: string;
}

const orange = "#F55E1D";
const green = "#10B981";
const red = "#EF4444";
const cyan = "#06B6D4";
const yellow = "#F59E0B";
const mono = "'JetBrains Mono', 'Cascadia Mono', monospace";
const display = "'Arial Black', 'Space Grotesk', sans-serif";

function springVal(frame: number, fps: number, delay = 0) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 130, mass: 0.9 },
  });
}

function Kicker({ children, color = orange }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        padding: "10px 24px",
        border: `2px solid ${color}`,
        backgroundColor: `${color}18`,
        color,
        fontFamily: mono,
        fontWeight: 900,
        fontSize: 22,
        letterSpacing: 4,
        textTransform: "uppercase",
        boxShadow: `0 0 20px ${color}33`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCENE 1: THE CRASH HOOK (0 - 90 frames / 0 - 3s)
// ---------------------------------------------------------------------------
function CrashHookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps);
  const glitch = Math.sin(frame * 0.8) * 4;
  const cursorBlink = Math.floor(frame / 6) % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        padding: "120px 60px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ transform: `scale(${pop})`, marginBottom: 36 }}>
        <Kicker color={red}>⚠️ SYSTEM ERROR // CODE 1</Kicker>
      </div>

      <h1
        style={{
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 82,
          lineHeight: 1.04,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "0 0 40px",
          transform: `translateX(${glitch}px)`,
          textShadow: `3px 3px 0 ${red}, -3px -3px 0 ${cyan}`,
        }}
      >
        МАЙНКРАФТ
        <br />
        <span style={{ color: red }}>СНОВА КРАШНУЛСЯ?</span>
      </h1>

      {/* Terminal window showing the infamous Java OutOfMemory / Crash */}
      <div
        style={{
          width: 920,
          backgroundColor: "#0D0E12",
          border: `2px solid ${red}`,
          boxShadow: `0 16px 50px rgba(239, 68, 68, 0.25), 8px 8px 0 rgba(239, 68, 68, 0.4)`,
          padding: 0,
          overflow: "hidden",
          fontFamily: mono,
        }}
      >
        <div
          style={{
            backgroundColor: "#181A22",
            padding: "12px 20px",
            borderBottom: "1px solid #2B2E3C",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: red }} />
            <span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: yellow }} />
            <span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: green }} />
            <span style={{ color: "#9AA0AA", fontSize: 18, marginLeft: 8, fontWeight: 700 }}>
              crash-reports/crash-latest.txt
            </span>
          </div>
          <span style={{ color: red, fontWeight: 900, fontSize: 18 }}>EXIT CODE: 1</span>
        </div>

        <div style={{ padding: "28px 24px", color: "#E2E8F0", fontSize: 21, lineHeight: 1.6 }}>
          <div style={{ color: red, fontWeight: 700 }}>
            [ERROR] Exception in thread &quot;main&quot; java.lang.OutOfMemoryError: Java heap space
          </div>
          <div style={{ color: "#71798E" }}>
            &gt; at net.minecraft.client.main.Main.main(SourceFile:214)
          </div>
          <div style={{ color: "#71798E" }}>
            &gt; Memory allocated: 2048MB (Required: 4096MB)
          </div>
          <div style={{ color: yellow, marginTop: 12 }}>
            &gt; И снова искать ошибку 2 часа на форумах? {cursorBlink ? "█" : ""}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 48,
          backgroundColor: "#161820",
          border: "2px solid #333846",
          padding: "16px 36px",
          color: "#94A3B8",
          fontFamily: mono,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        ❌ ОБЫЧНЫЕ ЛАУНЧЕРЫ НЕ ПОМОГУТ
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// SCENE 2: SMART CRASH DIAGNOSTICS IN REDPANDA (90 - 210 frames / 3 - 7s)
// ---------------------------------------------------------------------------
function SmartDiagnosticsScene({ version }: { version: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = springVal(frame, fps);
  const scanProgress = Math.min(100, Math.floor(interpolate(frame, [10, 45], [10, 100])));
  const cardPop = springVal(frame, fps, 35);

  return (
    <AbsoluteFill
      style={{
        padding: "100px 50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ transform: `scale(${reveal})`, marginBottom: 28 }}>
        <Kicker color={orange}>✨ НОВОЕ В REDPANDA {version}</Kicker>
      </div>

      <h2
        style={{
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 72,
          lineHeight: 1.05,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "0 0 32px",
          transform: `scale(${reveal})`,
        }}
      >
        УМНАЯ ДИАГНОСТИКА
        <br />
        <span style={{ color: orange }}>КРАШЕЙ В 1 КЛИК</span>
      </h2>

      {/* Cyber Diagnostics Window */}
      <div
        style={{
          width: 940,
          backgroundColor: "#12141C",
          border: `3px solid ${orange}`,
          boxShadow: `0 20px 60px rgba(245, 94, 29, 0.25), 10px 10px 0 ${orange}44`,
          overflow: "hidden",
          fontFamily: mono,
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#1C1F2B",
            padding: "16px 24px",
            borderBottom: `2px solid ${orange}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 26 }}>🧠</span>
            <span style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>
              SMART CRASH ANALYSIS
            </span>
          </div>
          <span
            style={{
              backgroundColor: scanProgress === 100 ? `${green}22` : `${orange}22`,
              color: scanProgress === 100 ? green : orange,
              border: `1px solid ${scanProgress === 100 ? green : orange}`,
              padding: "4px 14px",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {scanProgress === 100 ? "АНАЛИЗ ЗАВЕРШЁН" : `СКАНИРОВАНИЕ ${scanProgress}%`}
          </span>
        </div>

        {/* Diagnosis Body */}
        <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              backgroundColor: "#1A1D27",
              borderLeft: `4px solid ${red}`,
              padding: "16px 20px",
            }}
          >
            <div style={{ color: "#94A3B8", fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>
              Обнаруженная проблема:
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 900, marginTop: 4 }}>
              Нехватка оперативной памяти (Out of Memory)
            </div>
            <div style={{ color: "#E2E8F0", fontSize: 19, marginTop: 6 }}>
              Сборка требует больше памяти, чем выделено лаунчером.
            </div>
          </div>

          {/* Quick Solution Card */}
          <div
            style={{
              backgroundColor: "#16231E",
              border: `2px solid ${green}`,
              padding: "20px 24px",
              transform: `scale(${cardPop})`,
              opacity: cardPop,
              boxShadow: `0 8px 30px ${green}22`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: green, fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>
                  ГОТОВОЕ РЕШЕНИЕ:
                </div>
                <div style={{ color: "#FFFFFF", fontSize: 26, fontWeight: 900, marginTop: 4 }}>
                  Увеличить ОЗУ: 2048 MB ➔ 4096 MB
                </div>
              </div>
              <div
                style={{
                  backgroundColor: green,
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: 20,
                  padding: "14px 28px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: `0 0 25px ${green}66`,
                }}
              >
                ИСПРАВИТЬ ⚡
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 38,
          color: green,
          fontFamily: mono,
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: 2,
          textAlign: "center",
        }}
      >
        ✓ ПЕРЕВОДИТ ОШИБКИ И ЧИНИТ ИХ В ОДИН КЛИК
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// SCENE 3: LIVE SERVER BROWSER & BUILDER (210 - 330 frames / 7 - 11s)
// ---------------------------------------------------------------------------
function LiveServerAndBuilderScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = springVal(frame, fps);
  const pingPulse = Math.sin(frame / 4) * 0.2 + 0.8;

  return (
    <AbsoluteFill
      style={{
        padding: "100px 50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ transform: `scale(${reveal})`, marginBottom: 28 }}>
        <Kicker color={cyan}>🌐 ВСТРОЕННЫЙ МОНИТОРИНГ</Kicker>
      </div>

      <h2
        style={{
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 72,
          lineHeight: 1.05,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "0 0 34px",
          transform: `scale(${reveal})`,
        }}
      >
        СЕРВЕРЫ С LIVE PING
        <br />
        <span style={{ color: cyan }}>И ЭКСПОРТ СБОРОК</span>
      </h2>

      {/* Server Browser Mockup */}
      <div
        style={{
          width: 940,
          backgroundColor: "#11131A",
          border: `2px solid ${cyan}`,
          boxShadow: `0 18px 50px rgba(6, 182, 212, 0.2), 10px 10px 0 ${cyan}44`,
          fontFamily: mono,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            backgroundColor: "#191D28",
            padding: "14px 24px",
            borderBottom: "1px solid #2B3040",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 900 }}>
            МОНИТОРИНГ СЕРВЕРОВ [ LIVE STATUS ]
          </span>
          <span style={{ color: green, fontSize: 17, fontWeight: 800 }}>
            ● ОБНОВЛЯЕТСЯ В РЕАЛЬНОМ ВРЕМЕНИ
          </span>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Server Item 1 */}
          <div
            style={{
              backgroundColor: "#171A24",
              border: "1px solid #282D3D",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  backgroundColor: orange,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  color: "#000",
                  fontWeight: 900,
                }}
              >
                RP
              </div>
              <div>
                <div style={{ color: "#FFF", fontSize: 24, fontWeight: 900 }}>
                  RedPanda Official Survival
                </div>
                <div style={{ color: "#94A3B8", fontSize: 17, marginTop: 3 }}>
                  mc.redlauncher.ru • 1.20.4 • Без доната
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: green, fontSize: 22, fontWeight: 900, opacity: pingPulse }}>
                  🟢 18 ms
                </div>
                <div style={{ color: "#CBD5E1", fontSize: 16 }}>482 / 1000 игроков</div>
              </div>
              <div
                style={{
                  backgroundColor: cyan,
                  color: "#000",
                  fontWeight: 900,
                  fontSize: 18,
                  padding: "10px 22px",
                }}
              >
                ВОЙТИ ➔
              </div>
            </div>
          </div>

          {/* Server Item 2 */}
          <div
            style={{
              backgroundColor: "#171A24",
              border: "1px solid #282D3D",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  backgroundColor: "#6366F1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  color: "#FFF",
                  fontWeight: 900,
                }}
              >
                H
              </div>
              <div>
                <div style={{ color: "#FFF", fontSize: 24, fontWeight: 900 }}>Hypixel Network</div>
                <div style={{ color: "#94A3B8", fontSize: 17, marginTop: 3 }}>
                  mc.hypixel.net • SkyBlock, BedWars
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: green, fontSize: 22, fontWeight: 900 }}>🟢 34 ms</div>
                <div style={{ color: "#CBD5E1", fontSize: 16 }}>38 920 игроков</div>
              </div>
              <div
                style={{
                  backgroundColor: "#2C3142",
                  color: "#FFF",
                  fontWeight: 900,
                  fontSize: 18,
                  padding: "10px 22px",
                }}
              >
                ВОЙТИ ➔
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Pills */}
      <div style={{ display: "flex", gap: 16, width: 940 }}>
        <div
          style={{
            flex: 1,
            backgroundColor: "#151821",
            border: `2px solid ${orange}`,
            padding: "18px 24px",
            fontFamily: mono,
            boxShadow: `0 8px 24px ${orange}22`,
          }}
        >
          <div style={{ color: orange, fontSize: 16, fontWeight: 900 }}>📦 ЭКСПОРТ СБОРОК</div>
          <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>
            Экспорт в .mrpack без логов и мусора
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#151821",
            border: `2px solid ${green}`,
            padding: "18px 24px",
            fontFamily: mono,
            boxShadow: `0 8px 24px ${green}22`,
          }}
        >
          <div style={{ color: green, fontSize: 16, fontWeight: 900 }}>🪄 КОНСТРУКТОР</div>
          <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>
            Сборка модов по тематикам в 1 клик
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// SCENE 4: WHY REDPANDA CRUSHES OTHERS (330 - 410 frames / 11 - 13.6s)
// ---------------------------------------------------------------------------
function ComparisonScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps);

  return (
    <AbsoluteFill
      style={{
        padding: "100px 50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ transform: `scale(${pop})`, marginBottom: 30 }}>
        <Kicker color={yellow}>⚡ СРАВНИ И ПОЧУВСТВУЙ РАЗНИЦУ</Kicker>
      </div>

      <h2
        style={{
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 76,
          lineHeight: 1.04,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "0 0 44px",
          transform: `scale(${pop})`,
        }}
      >
        ПОЧЕМУ ПЕРЕХОДЯТ
        <br />
        <span style={{ color: orange }}>НА REDPANDA?</span>
      </h2>

      {/* Comparison Grid */}
      <div style={{ display: "flex", gap: 24, width: 950, fontFamily: mono }}>
        {/* Old Launchers */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#13141A",
            border: `2px solid #3A3D4D`,
            padding: "32px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div style={{ color: red, fontSize: 24, fontWeight: 900, borderBottom: "2px solid #2B2E3C", paddingBottom: 12 }}>
            ❌ ДРУГИЕ ЛАУНЧЕРЫ
          </div>
          <div style={{ color: "#94A3B8", fontSize: 21, lineHeight: 1.4 }}>
            • Всплывающая реклама и спам
          </div>
          <div style={{ color: "#94A3B8", fontSize: 21, lineHeight: 1.4 }}>
            • Крашится и молчит (ищи в Google)
          </div>
          <div style={{ color: "#94A3B8", fontSize: 21, lineHeight: 1.4 }}>
            • Тяжелый Java-интерфейс
          </div>
          <div style={{ color: "#94A3B8", fontSize: 21, lineHeight: 1.4 }}>
            • Устаревшие каталоги модов
          </div>
        </div>

        {/* RedPanda */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#12141D",
            border: `3px solid ${orange}`,
            boxShadow: `0 16px 50px rgba(245, 94, 29, 0.3), 8px 8px 0 ${orange}66`,
            padding: "32px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div style={{ color: orange, fontSize: 24, fontWeight: 900, borderBottom: `2px solid ${orange}55`, paddingBottom: 12 }}>
            ✅ REDPANDA v0.3.2
          </div>
          <div style={{ color: "#FFF", fontSize: 21, lineHeight: 1.4, fontWeight: 800 }}>
            ⚡ 100% Rust + Tauri (старт 0.1с)
          </div>
          <div style={{ color: "#FFF", fontSize: 21, lineHeight: 1.4, fontWeight: 800 }}>
            🧠 Авто-расшифровка крашей
          </div>
          <div style={{ color: "#FFF", fontSize: 21, lineHeight: 1.4, fontWeight: 800 }}>
            🚫 Ноль рекламы и слежки
          </div>
          <div style={{ color: "#FFF", fontSize: 21, lineHeight: 1.4, fontWeight: 800 }}>
            📦 Modrinth + CurseForge + Экспорт
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// SCENE 5: CALL TO ACTION (410 - 480 frames / 13.6 - 16s)
// ---------------------------------------------------------------------------
function SilentCtaScene({ version, siteUrl }: { version: string; siteUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps);
  const btnPulse = Math.sin(frame / 3) * 0.05 + 1;

  return (
    <AbsoluteFill
      style={{
        padding: "100px 50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ transform: `scale(${pop})`, marginBottom: 30 }}>
        <Kicker color={green}>🔥 БЕСПЛАТНО • WINDOWS 10/11</Kicker>
      </div>

      <h1
        style={{
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 84,
          lineHeight: 1.03,
          textTransform: "uppercase",
          margin: "0 0 24px",
          transform: `scale(${pop})`,
          textShadow: `0 0 40px rgba(245, 94, 29, 0.4)`,
        }}
      >
        ПЕРЕХОДИ НА
        <br />
        <span style={{ color: orange }}>REDPANDA {version}</span>
      </h1>

      <p
        style={{
          color: "#94A3B8",
          fontFamily: mono,
          fontSize: 26,
          maxWidth: 820,
          margin: "0 0 48px",
          lineHeight: 1.4,
        }}
      >
        Забудь про вылеты, рекламу и лаги навсегда.
      </p>

      {/* Pulsing CTA Download Button */}
      <div
        style={{
          transform: `scale(${btnPulse})`,
          backgroundColor: orange,
          color: "#000000",
          fontFamily: mono,
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: 3,
          padding: "26px 56px",
          border: "4px solid #FFFFFF",
          boxShadow: `0 0 60px ${orange}99, 12px 12px 0 #FFFFFF`,
          textTransform: "uppercase",
          marginBottom: 44,
        }}
      >
        СКАЧАТЬ ЛАУНЧЕР ⚡
      </div>

      {/* Website Domain Box */}
      <div
        style={{
          backgroundColor: "#161822",
          border: "2px solid #383D52",
          padding: "18px 48px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: mono,
        }}
      >
        <span style={{ fontSize: 32 }}>🌐</span>
        <span style={{ color: "#FFFFFF", fontSize: 36, fontWeight: 900, letterSpacing: 2 }}>
          {siteUrl}
        </span>
      </div>

      <div
        style={{
          marginTop: 40,
          color: "#CBD5E1",
          fontFamily: mono,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        ССЫЛКА В ШАПКЕ ПРОФИЛЯ 👆
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// MAIN EXPORT: SilentCyberPromo
// ---------------------------------------------------------------------------
export const SilentCyberPromo: React.FC<SilentCyberPromoProps> = ({
  version = "v0.3.2",
  siteUrl = "redlauncher.ru",
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0B0E" }}>
      {/* Dynamic Cyber Background */}
      <CyberBackground version={version} />

      {/* Sequence 1: The Crash Hook (0 - 90 frames / 0 - 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <CrashHookScene />
      </Sequence>

      {/* Sequence 2: Smart Diagnostics (90 - 210 frames / 3 - 7s) */}
      <Sequence from={90} durationInFrames={120}>
        <SmartDiagnosticsScene version={version} />
      </Sequence>

      {/* Sequence 3: Live Server Browser & Builder (210 - 330 frames / 7 - 11s) */}
      <Sequence from={210} durationInFrames={120}>
        <LiveServerAndBuilderScene />
      </Sequence>

      {/* Sequence 4: Comparison (330 - 410 frames / 11 - 13.6s) */}
      <Sequence from={330} durationInFrames={80}>
        <ComparisonScene />
      </Sequence>

      {/* Sequence 5: CTA (410 - 480 frames / 13.6 - 16s) */}
      <Sequence from={410} durationInFrames={70}>
        <SilentCtaScene version={version} siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
