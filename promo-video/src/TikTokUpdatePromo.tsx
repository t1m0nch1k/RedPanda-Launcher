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

interface TikTokUpdatePromoProps {
  version?: string;
  siteUrl?: string;
}

const mono = "'JetBrains Mono', monospace";
const display = "'Space Grotesk', sans-serif";

const sceneStyle: React.CSSProperties = {
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

function SceneTag({ children, color = "#F55E1D" }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        color,
        border: `2px solid ${color}`,
        backgroundColor: `${color}1A`,
        padding: "10px 22px",
        fontFamily: mono,
        fontSize: 23,
        fontWeight: 800,
        letterSpacing: 3,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function UpdateHookScene({ version }: { version: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const warningOpacity = interpolate(frame, [28, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ ...sceneStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${intro})`, marginBottom: 42 }}>
        <SceneTag>// UPDATE SPOTLIGHT // {version}</SceneTag>
      </div>

      <h1
        style={{
          transform: `scale(${intro})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 76,
          lineHeight: 1.02,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 26px",
          textShadow: "0 0 32px rgba(245, 94, 29, 0.35)",
        }}
      >
        НОВОЕ В REDPANDA
        <br />
        <span style={{ color: "#F55E1D" }}>{version}</span>
      </h1>

      <p
        style={{
          opacity: warningOpacity,
          color: "#D7DAE0",
          fontFamily: mono,
          fontSize: 29,
          lineHeight: 1.35,
          maxWidth: 820,
          margin: "0 0 44px",
        }}
      >
        СБОРКА НЕ ЗАПУСКАЕТСЯ?<br />
        ТЕПЕРЬ НЕ НУЖНО УГАДЫВАТЬ ПОЧЕМУ.
      </p>

      <div
        style={{
          transform: `translateY(${interpolate(frame, [0, 30], [30, 0], { extrapolateRight: "clamp" })}px)`,
          width: "100%",
          maxWidth: 850,
          backgroundColor: "#111318",
          border: "3px solid #2B2E36",
          boxShadow: "10px 10px 0 #F55E1D",
          padding: "26px 32px",
          textAlign: "left",
          fontFamily: mono,
          fontSize: 25,
          lineHeight: 1.65,
        }}
      >
        <div style={{ color: "#8E939E" }}>REDPANDA_DIAGNOSTICS.EXE</div>
        <div style={{ color: "#22C55E" }}>› scan_instance() ........ STARTED</div>
        <div style={{ color: "#22C55E" }}>› java / loader / memory ... OK</div>
        <div style={{ color: "#FBBF24" }}>› mods .................... 1 WARNING</div>
        <div style={{ color: "#F55E1D", fontWeight: 800 }}>› recommendation .......... DISABLE CONFLICT</div>
      </div>
    </div>
  );
}

function DiagnosticsScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 12, stiffness: 110 } });
  const checks = [
    ["Папка сборки", "FOUND", "#22C55E"],
    ["Java Runtime", "JAVA 21", "#22C55E"],
    ["Загрузчик", "FABRIC 0.16", "#22C55E"],
    ["Оперативная память", "4096 MB", "#22C55E"],
    ["Состояние модов", "1 CONFLICT", "#FBBF24"],
  ];

  return (
    <div style={sceneStyle}>
      <div style={{ transform: `scale(${title})`, textAlign: "center", marginBottom: 44 }}>
        <SceneTag color="#22C55E">// 01 // PRE-FLIGHT CHECK</SceneTag>
        <h2
          style={{
            color: "#FFFFFF",
            fontFamily: display,
            fontSize: 64,
            lineHeight: 1.05,
            fontWeight: 900,
            textTransform: "uppercase",
            margin: "22px 0 14px",
          }}
        >
          ПРОВЕРКА СБОРКИ
          <br />
          <span style={{ color: "#22C55E" }}>ДО ЗАПУСКА</span>
        </h2>
        <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 25, margin: 0 }}>
          Java · память · загрузчик · моды
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 16 }}>
        {checks.map(([label, value, color], index) => {
          const progress = spring({ frame: frame - index * 8, fps, config: { damping: 14, stiffness: 130 } });
          return (
            <div
              key={label}
              style={{
                transform: `translateX(${interpolate(progress, [0, 1], [80, 0])}px)`,
                opacity: progress,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                padding: "23px 26px",
                backgroundColor: "#17191E",
                border: `2px solid ${color}`,
                boxShadow: `6px 6px 0 ${color}`,
                fontFamily: mono,
                fontSize: 26,
              }}
            >
              <span style={{ color: "#D7DAE0" }}>{label}</span>
              <span style={{ color, fontWeight: 900, whiteSpace: "nowrap" }}>{value} {color === "#FBBF24" ? "⚠" : "✓"}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 48, color: "#F55E1D", fontFamily: mono, fontSize: 27, fontWeight: 800, letterSpacing: 2 }}>
        // ПОНЯТНАЯ РЕКОМЕНДАЦИЯ ВМЕСТО ВЫЛЕТА
      </div>
    </div>
  );
}

function ModControlScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 12, stiffness: 115 } });
  const mods = [
    ["sodium-fabric.jar", "ВКЛЮЧЁН", "#22C55E"],
    ["iris-shaders.jar", "ВКЛЮЧЁН", "#22C55E"],
    ["renderfix-1.0.4.jar", "ОТКЛЮЧЁН", "#FBBF24"],
  ];

  return (
    <div style={{ ...sceneStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${reveal})`, marginBottom: 32 }}>
        <SceneTag color="#FBBF24">// 02 // MOD CONTROL</SceneTag>
      </div>
      <h2
        style={{
          transform: `scale(${reveal})`,
          color: "#FFFFFF",
          fontFamily: display,
          fontSize: 61,
          lineHeight: 1.03,
          fontWeight: 900,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        КОНФЛИКТНЫЙ МОД?
        <br />
        <span style={{ color: "#FBBF24" }}>НЕ УДАЛЯЙ.</span>
      </h2>
      <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 25, margin: "0 0 42px" }}>
        ОТКЛЮЧИ ЕГО В ОДИН КЛИК И СОХРАНИ ФАЙЛ.
      </p>

      <div style={{ width: "100%", maxWidth: 900, backgroundColor: "#111318", border: "3px solid #2B2E36", padding: 22, textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#8E939E", fontFamily: mono, fontSize: 21, padding: "0 10px 16px", borderBottom: "2px solid #2B2E36" }}>
          <span>INSTALLED_MODS</span>
          <span>3 ITEMS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
          {mods.map(([name, status, color], index) => {
            const item = spring({ frame: frame - index * 10 - 5, fps, config: { damping: 13, stiffness: 120 } });
            const disabled = status === "ОТКЛЮЧЁН";
            return (
              <div
                key={name}
                style={{
                  opacity: item,
                  transform: `translateY(${interpolate(item, [0, 1], [30, 0])}px)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "18px 20px",
                  backgroundColor: disabled ? "#2A2114" : "#17191E",
                  border: `2px solid ${disabled ? "#FBBF24" : "#2B2E36"}`,
                  fontFamily: mono,
                  fontSize: 23,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <span style={{ color: disabled ? "#FBBF24" : "#22C55E", fontSize: 27 }}>{disabled ? "◐" : "●"}</span>
                  <span style={{ color: disabled ? "#FBBF24" : "#FFFFFF", overflowWrap: "anywhere" }}>{name}{disabled ? ".disabled" : ""}</span>
                </div>
                <span style={{ color, fontWeight: 900, whiteSpace: "nowrap" }}>{status}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 38, padding: "16px 24px", backgroundColor: "#FBBF2422", border: "2px solid #FBBF24", color: "#FBBF24", fontFamily: mono, fontSize: 25, fontWeight: 800 }}>
        ФАЙЛ ОСТАЁТСЯ НА МЕСТЕ
      </div>
    </div>
  );
}

function RecoveryScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 105 } });
  const steps = [
    ["01", "Запусти диагностику", "Найди причину до старта", "#F55E1D"],
    ["02", "Отключи конфликт", "Без удаления и ручного поиска", "#FBBF24"],
    ["03", "Верни мод", "Один клик — файл снова активен", "#22C55E"],
  ];

  return (
    <div style={{ ...sceneStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${enter})`, marginBottom: 42 }}>
        <SceneTag color="#38BDF8">// 03 // SAFE RECOVERY</SceneTag>
      </div>
      <h2 style={{ transform: `scale(${enter})`, color: "#FFFFFF", fontFamily: display, fontSize: 62, lineHeight: 1.04, fontWeight: 900, textTransform: "uppercase", margin: "0 0 52px" }}>
        СБОРКА СНОВА
        <br />
        <span style={{ color: "#38BDF8" }}>ПОД КОНТРОЛЕМ</span>
      </h2>

      <div style={{ width: "100%", maxWidth: 880, display: "flex", flexDirection: "column", gap: 20 }}>
        {steps.map(([number, title, description, color], index) => {
          const step = spring({ frame: frame - index * 8, fps, config: { damping: 14, stiffness: 125 } });
          return (
            <div key={number} style={{ opacity: step, transform: `translateX(${interpolate(step, [0, 1], [70, 0])}px)`, display: "flex", alignItems: "center", gap: 24, textAlign: "left", padding: "22px 26px", backgroundColor: "#17191E", border: `2px solid ${color}`, boxShadow: `6px 6px 0 ${color}` }}>
              <span style={{ color, fontFamily: display, fontSize: 42, fontWeight: 900 }}>{number}</span>
              <div>
                <div style={{ color: "#FFFFFF", fontFamily: display, fontSize: 30, fontWeight: 900, textTransform: "uppercase" }}>{title}</div>
                <div style={{ color: "#8E939E", fontFamily: mono, fontSize: 21, marginTop: 5 }}>{description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpdateCtaScene({ version, siteUrl }: { version: string; siteUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const glow = Math.sin(frame / 5) * 18 + 32;

  return (
    <div style={{ ...sceneStyle, textAlign: "center" }}>
      <div style={{ transform: `scale(${enter})`, width: 170, height: 170, backgroundColor: "#17191E", border: "4px solid #F55E1D", boxShadow: "8px 8px 0 #F55E1D", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 38 }}>
        <Img src={staticFile("logo.png")} style={{ width: 125, height: 125, objectFit: "contain" }} />
      </div>
      <h2 style={{ transform: `scale(${enter})`, color: "#FFFFFF", fontFamily: display, fontSize: 65, lineHeight: 1.05, fontWeight: 900, textTransform: "uppercase", margin: "0 0 22px" }}>
        ПРОВЕРЬ СБОРКУ
        <br />
        <span style={{ color: "#F55E1D" }}>ПЕРЕД ЗАПУСКОМ</span>
      </h2>
      <p style={{ color: "#8E939E", fontFamily: mono, fontSize: 26, lineHeight: 1.35, margin: "0 0 34px" }}>
        НОВОЕ ОБНОВЛЕНИЕ {version}
        <br />
        ДИАГНОСТИКА + MOD CONTROL
      </p>
      <div style={{ transform: `scale(${enter})`, width: "100%", maxWidth: 820, padding: "25px 32px", backgroundColor: "#F55E1D", color: "#000000", border: "4px solid #000000", boxShadow: `0 0 ${glow}px rgba(245, 94, 29, 0.8), 8px 8px 0 #000000`, fontFamily: display, fontSize: 38, fontWeight: 900, textTransform: "uppercase" }}>
        ⬇ СКАЧАТЬ {version} ⬇
      </div>
      <div style={{ marginTop: 32, color: "#FFFFFF", fontFamily: mono, fontSize: 31, fontWeight: 900, letterSpacing: 2 }}>
        {siteUrl.toUpperCase()}
      </div>
      <div style={{ marginTop: 46, color: "#F55E1D", fontFamily: mono, fontSize: 25, fontWeight: 800 }}>
        // ССЫЛКА В ПРОФИЛЕ
      </div>
    </div>
  );
}

export const TikTokUpdatePromo: React.FC<TikTokUpdatePromoProps> = ({ version = "v0.3.0", siteUrl = "redlauncher.ru" }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0F12" }}>
      <CyberBackground version={version} />
      <Sequence from={0} durationInFrames={75}>
        <UpdateHookScene version={version} />
      </Sequence>
      <Sequence from={75} durationInFrames={105}>
        <DiagnosticsScene />
      </Sequence>
      <Sequence from={180} durationInFrames={105}>
        <ModControlScene />
      </Sequence>
      <Sequence from={285} durationInFrames={90}>
        <RecoveryScene />
      </Sequence>
      <Sequence from={375} durationInFrames={75}>
        <UpdateCtaScene version={version} siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
