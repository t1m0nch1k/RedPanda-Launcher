import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CyberBackground } from "./components/CyberBackground";

interface FiveMinutesPromoProps {
  version?: string;
  siteUrl?: string;
}

const orange = "#F55E1D";
const green = "#22C55E";
const red = "#FF4255";
const muted = "#9AA0AA";
const panel = "#15171C";
const mono = "'JetBrains Mono', 'Cascadia Mono', monospace";
const display = "'Arial Black', 'Segoe UI', sans-serif";

const screenshot = (name: string) => staticFile(`references/v0.3.1/${name}`);

const sceneBase: React.CSSProperties = {
  padding: "110px 64px 170px",
  boxSizing: "border-box",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

function enterSpring(frame: number, fps: number, delay = 0) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 125, mass: 0.85 },
  });
}

function Backdrop({ src, opacity = 0.18 }: { src: string; opacity?: number }) {
  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(28px) brightness(0.38) saturate(0.8)",
          transform: "scale(1.24)",
          opacity,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,11,14,0.55) 0%, rgba(10,11,14,0.08) 45%, rgba(10,11,14,0.9) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

function Kicker({ children, color = orange }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        padding: "11px 22px",
        border: `2px solid ${color}`,
        backgroundColor: `${color}18`,
        color,
        fontFamily: mono,
        fontWeight: 900,
        fontSize: 22,
        letterSpacing: 3,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function ScreenshotCard({
  src,
  label,
  frame,
  height = 770,
  objectPosition = "50% 50%",
  accent = orange,
  rotate = 0,
}: {
  src: string;
  label: string;
  frame: number;
  height?: number;
  objectPosition?: string;
  accent?: string;
  rotate?: number;
}) {
  const { fps } = useVideoConfig();
  const reveal = enterSpring(frame, fps);
  const zoom = interpolate(frame, [0, 100], [1.075, 1.01], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 930,
        height,
        overflow: "hidden",
        backgroundColor: "#0E0F12",
        border: `3px solid ${accent}`,
        boxShadow: `12px 12px 0 ${accent}55, 0 28px 80px rgba(0,0,0,0.65)`,
        transform: `translateY(${interpolate(reveal, [0, 1], [80, 0])}px) scale(${interpolate(reveal, [0, 1], [0.92, 1])}) rotate(${rotate}deg)`,
        opacity: reveal,
      }}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 22px",
          backgroundColor: "#17191E",
          borderBottom: "2px solid #2B2E36",
          color: "#D7DAE0",
          fontFamily: mono,
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        <span style={{ width: 13, height: 13, backgroundColor: red, borderRadius: "50%" }} />
        <span style={{ width: 13, height: 13, backgroundColor: "#FBBF24", borderRadius: "50%" }} />
        <span style={{ width: 13, height: 13, backgroundColor: green, borderRadius: "50%" }} />
        <span style={{ marginLeft: 10 }}>{label}</span>
      </div>
      <div style={{ width: "100%", height: height - 64, overflow: "hidden" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
            transform: `scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
}

function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = enterSpring(frame, fps);
  const title = enterSpring(frame, fps, 10);
  const timer = enterSpring(frame, fps, 28);

  return (
    <AbsoluteFill style={{ ...sceneBase, justifyContent: "flex-start", paddingTop: 210 }}>
      <Backdrop src={screenshot("01_home.png")} opacity={0.2} />

      <div style={{ transform: `scale(${pop})`, zIndex: 2 }}>
        <Kicker color="#38BDF8">POV // ДРУЗЬЯ УЖЕ ЖДУТ</Kicker>
      </div>

      <div
        style={{
          zIndex: 2,
          width: 880,
          marginTop: 80,
          padding: "26px 30px",
          backgroundColor: "#252831",
          border: "2px solid #4A4F5B",
          boxShadow: "9px 9px 0 #5865F2",
          transform: `translateX(${interpolate(pop, [0, 1], [100, 0])}px)`,
          opacity: pop,
          fontFamily: mono,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #5865F2, #8EA1E1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            D
          </div>
          <div>
            <div style={{ color: "#B9C5FF", fontSize: 22, fontWeight: 900 }}>ДРУЗЬЯ • сейчас</div>
            <div style={{ color: "white", fontSize: 34, marginTop: 5 }}>Ну что, заходишь? 👀</div>
          </div>
        </div>
      </div>

      <h1
        style={{
          zIndex: 2,
          transform: `scale(${title})`,
          opacity: title,
          color: "white",
          fontFamily: display,
          fontSize: 92,
          lineHeight: 1.02,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "110px 0 0",
          textShadow: "0 0 50px rgba(245,94,29,0.35)",
        }}
      >
        Я: ЗАЙДУ ЧЕРЕЗ
        <br />
        <span style={{ color: orange }}>ПЯТЬ МИНУТ</span>
      </h1>

      <div
        style={{
          zIndex: 2,
          marginTop: 85,
          padding: "24px 42px",
          color: green,
          border: `3px solid ${green}`,
          backgroundColor: "#0B1712",
          boxShadow: `0 0 ${30 + Math.sin(frame / 4) * 12}px ${green}66`,
          fontFamily: mono,
          fontSize: 60,
          fontWeight: 900,
          letterSpacing: 7,
          transform: `scale(${timer})`,
          opacity: timer,
        }}
      >
        00:05:00
      </div>
    </AbsoluteFill>
  );
}

function ChaosScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = enterSpring(frame, fps);
  const alerts = [
    ["86 МОДОВ", orange],
    ["MISSING DEPENDENCY", red],
    ["JAVA VERSION?", "#FBBF24"],
  ] as const;

  return (
    <AbsoluteFill style={{ ...sceneBase, justifyContent: "flex-start", paddingTop: 155 }}>
      <Backdrop src={screenshot("01_home.png")} opacity={0.16} />
      <h2
        style={{
          zIndex: 2,
          transform: `scale(${title})`,
          color: "white",
          fontFamily: display,
          fontSize: 79,
          textAlign: "center",
          textTransform: "uppercase",
          lineHeight: 1.02,
          margin: 0,
        }}
      >
        А ТАМ —
        <br />
        <span style={{ color: red }}>ВОСЕМЬДЕСЯТ ШЕСТЬ МОДОВ</span>
      </h2>

      <div style={{ zIndex: 2, marginTop: 65 }}>
        <ScreenshotCard
          src={screenshot("01_home.png")}
          label="REDPANDA / INSTANCE_VIEW"
          frame={frame - 8}
          height={720}
          objectPosition="50% 49%"
          accent={red}
          rotate={-1.2}
        />
      </div>

      <div
        style={{
          zIndex: 3,
          width: 900,
          marginTop: -40,
          display: "flex",
          flexDirection: "column",
          gap: 15,
        }}
      >
        {alerts.map(([text, color], index) => {
          const item = enterSpring(frame, fps, 20 + index * 9);
          return (
            <div
              key={text}
              style={{
                alignSelf: index === 1 ? "flex-end" : "flex-start",
                padding: "16px 22px",
                backgroundColor: "#111318",
                border: `3px solid ${color}`,
                boxShadow: `7px 7px 0 ${color}55`,
                color,
                fontFamily: mono,
                fontSize: 29,
                fontWeight: 900,
                transform: `translateX(${interpolate(item, [0, 1], [index === 1 ? 90 : -90, 0])}px) rotate(${index === 1 ? 2 : -2}deg)`,
                opacity: item,
              }}
            >
              {index === 0 ? "✓" : "⚠"} {text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function CatalogScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = enterSpring(frame, fps);
  const swap = interpolate(frame, [38, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ ...sceneBase, justifyContent: "flex-start", paddingTop: 145 }}>
      <Backdrop src={screenshot("04_curseforge_pack_detail.png")} opacity={0.15} />
      <div style={{ zIndex: 2, transform: `scale(${intro})` }}>
        <Kicker>// REDPANDA: ПОНЯЛ.</Kicker>
      </div>
      <h2
        style={{
          zIndex: 2,
          color: "white",
          fontFamily: display,
          fontSize: 72,
          lineHeight: 1.03,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "38px 0 52px",
          transform: `scale(${intro})`,
        }}
      >
        НАЙДИ СБОРКУ
        <br />
        <span style={{ color: orange }}>В ОДНОМ ОКНЕ</span>
      </h2>

      <div style={{ position: "relative", zIndex: 2, width: 930, height: 870 }}>
        <div style={{ position: "absolute", inset: 0, opacity: 1 - swap }}>
          <ScreenshotCard
            src={screenshot("02_modrinth_catalog.png")}
            label="MODRINTH_CATALOG"
            frame={frame}
            height={850}
            objectPosition="50% 50%"
            accent="#38BDF8"
          />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: swap }}>
          <ScreenshotCard
            src={screenshot("04_curseforge_pack_detail.png")}
            label="CURSEFORGE_CATALOG"
            frame={Math.max(0, frame - 42)}
            height={850}
            objectPosition="50% 50%"
            accent={orange}
          />
        </div>
      </div>

      <div
        style={{
          zIndex: 3,
          marginTop: 22,
          display: "flex",
          gap: 18,
          fontFamily: mono,
          fontSize: 25,
          fontWeight: 900,
        }}
      >
        <span style={{ padding: "15px 20px", color: "#38BDF8", border: "2px solid #38BDF8", backgroundColor: "#38BDF818" }}>MODRINTH</span>
        <span style={{ color: muted, padding: "15px 2px" }}>+</span>
        <span style={{ padding: "15px 20px", color: orange, border: `2px solid ${orange}`, backgroundColor: `${orange}18` }}>CURSEFORGE</span>
      </div>
    </AbsoluteFill>
  );
}

function BuilderScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = enterSpring(frame, fps);
  const shots = [
    { src: "05_modpack_builder.png", label: "1 / ПАРАМЕТРЫ", start: 0, end: 56 },
    { src: "06_builder_themes.png", label: "2 / ТЕМАТИКИ", start: 44, end: 106 },
    { src: "07_builder_mod_selection.png", label: "3 / АВТОПОДБОР МОДОВ", start: 94, end: 150 },
  ];

  return (
    <AbsoluteFill style={{ ...sceneBase, justifyContent: "flex-start", paddingTop: 120 }}>
      <Backdrop src={screenshot("07_builder_mod_selection.png")} opacity={0.14} />
      <div style={{ zIndex: 2, transform: `scale(${intro})` }}>
        <Kicker color={green}>// УМНЫЙ КОНСТРУКТОР</Kicker>
      </div>
      <h2
        style={{
          zIndex: 2,
          color: "white",
          fontFamily: display,
          fontSize: 69,
          lineHeight: 1.03,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "34px 0 38px",
        }}
      >
        ВЫБРАЛ ТЕМАТИКУ —
        <br />
        <span style={{ color: green }}>ОСТАЛЬНОЕ АВТОМАТИЧЕСКИ</span>
      </h2>

      <div style={{ position: "relative", zIndex: 2, width: 930, height: 930 }}>
        {shots.map((shot, index) => {
          const fadeIn = interpolate(frame, [shot.start, shot.start + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const fadeOut = interpolate(frame, [shot.end - 10, shot.end], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div key={shot.src} style={{ position: "absolute", inset: 0, opacity: fadeIn * fadeOut }}>
              <ScreenshotCard
                src={screenshot(shot.src)}
                label={shot.label}
                frame={Math.max(0, frame - shot.start)}
                height={900}
                objectPosition="50% 50%"
                accent={index === 2 ? green : orange}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          zIndex: 3,
          width: 900,
          marginTop: 15,
          padding: "18px 24px",
          backgroundColor: "#0B1712",
          border: `2px solid ${green}`,
          color: green,
          fontFamily: mono,
          fontSize: 26,
          fontWeight: 900,
          textAlign: "center",
          opacity: enterSpring(frame, fps, 85),
        }}
      >
        ✓ ЗАВИСИМОСТИ И JAVA ПОДГОТОВЛЕНЫ
      </div>
    </AbsoluteFill>
  );
}

function ReadyScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = enterSpring(frame, fps);
  const check = enterSpring(frame, fps, 18);
  const progress = interpolate(frame, [8, 50], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ ...sceneBase, justifyContent: "flex-start", paddingTop: 145 }}>
      <Backdrop src={screenshot("01_home.png")} opacity={0.19} />
      <h2
        style={{
          zIndex: 3,
          color: "white",
          fontFamily: display,
          fontSize: 80,
          lineHeight: 1.02,
          textAlign: "center",
          textTransform: "uppercase",
          margin: 0,
          transform: `scale(${reveal})`,
        }}
      >
        ПЯТЬ МИНУТ СПУСТЯ:
        <br />
        <span style={{ color: green }}>СБОРКА ГОТОВА</span>
      </h2>

      <div style={{ zIndex: 2, marginTop: 60, position: "relative" }}>
        <ScreenshotCard
          src={screenshot("01_home.png")}
          label="REDPANDA / READY_TO_PLAY"
          frame={frame}
          height={780}
          objectPosition="50% 46%"
          accent={green}
        />
        <div
          style={{
            position: "absolute",
            right: -25,
            top: -35,
            width: 132,
            height: 132,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: green,
            color: "#07110B",
            border: "5px solid #07110B",
            boxShadow: `0 0 45px ${green}88`,
            fontSize: 78,
            fontWeight: 900,
            transform: `scale(${check}) rotate(-7deg)`,
          }}
        >
          ✓
        </div>
      </div>

      <div style={{ zIndex: 3, width: 900, marginTop: 55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "white", fontFamily: mono, fontSize: 24, fontWeight: 800, marginBottom: 13 }}>
          <span>LAUNCH_READY</span>
          <span style={{ color: green }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 22, border: "2px solid #3A3E48", backgroundColor: panel, padding: 3 }}>
          <div style={{ height: "100%", width: `${progress}%`, backgroundColor: green, boxShadow: `0 0 24px ${green}` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ version, siteUrl }: { version: string; siteUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = enterSpring(frame, fps);
  const pulse = 1 + Math.sin(frame / 5) * 0.025;

  return (
    <AbsoluteFill style={{ ...sceneBase, paddingTop: 180 }}>
      <Backdrop src={screenshot("01_home.png")} opacity={0.11} />
      <div
        style={{
          zIndex: 2,
          width: 190,
          height: 190,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: panel,
          border: `4px solid ${orange}`,
          boxShadow: `12px 12px 0 ${orange}, 0 0 70px ${orange}55`,
          transform: `scale(${reveal * pulse}) rotate(-3deg)`,
        }}
      >
        <Img src={staticFile("logo.png")} style={{ width: 142, height: 142, objectFit: "contain" }} />
      </div>

      <h2
        style={{
          zIndex: 2,
          color: "white",
          fontFamily: display,
          fontSize: 83,
          lineHeight: 1.02,
          textAlign: "center",
          textTransform: "uppercase",
          margin: "85px 0 25px",
          transform: `scale(${reveal})`,
        }}
      >
        ПЯТЬ МИНУТ?
        <br />
        <span style={{ color: orange }}>СЕГОДНЯ РЕАЛЬНО.</span>
      </h2>

      <div style={{ zIndex: 2, color: muted, fontFamily: mono, fontSize: 29, textAlign: "center", lineHeight: 1.5 }}>
        MODRINTH · CURSEFORGE · АВТОЗАВИСИМОСТИ
      </div>

      <div
        style={{
          zIndex: 2,
          width: 860,
          marginTop: 70,
          padding: "30px 24px",
          backgroundColor: orange,
          color: "#050607",
          border: "4px solid #050607",
          boxShadow: `12px 12px 0 #050607, 0 0 ${42 + Math.sin(frame / 4) * 14}px ${orange}88`,
          fontFamily: display,
          fontSize: 45,
          fontWeight: 900,
          textAlign: "center",
          textTransform: "uppercase",
          transform: `scale(${reveal * pulse})`,
        }}
      >
        СКАЧАТЬ REDPANDA {version}
      </div>

      <div style={{ zIndex: 2, marginTop: 55, color: "white", fontFamily: mono, fontSize: 35, fontWeight: 900, letterSpacing: 3 }}>
        {siteUrl.toUpperCase()}
      </div>
      <div style={{ zIndex: 2, marginTop: 26, color: orange, fontFamily: mono, fontSize: 26, fontWeight: 900 }}>
        // ССЫЛКА В ПРОФИЛЕ
      </div>
    </AbsoluteFill>
  );
}

export const FiveMinutesPromo: React.FC<FiveMinutesPromoProps> = ({
  version = "v0.3.2",
  siteUrl = "redlauncher.ru",
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0B0E" }}>
      <CyberBackground version={version} />
      <Audio src={staticFile("five-minutes-beat.wav")} volume={0.11} />
      <Audio src={staticFile("five-minutes-voice.mp3")} volume={1} />

      <Sequence from={0} durationInFrames={75}>
        <HookScene />
      </Sequence>
      <Sequence from={75} durationInFrames={75}>
        <ChaosScene />
      </Sequence>
      <Sequence from={150} durationInFrames={90}>
        <CatalogScene />
      </Sequence>
      <Sequence from={240} durationInFrames={150}>
        <BuilderScene />
      </Sequence>
      <Sequence from={390} durationInFrames={75}>
        <ReadyScene />
      </Sequence>
      <Sequence from={465} durationInFrames={75}>
        <CtaScene version={version} siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
