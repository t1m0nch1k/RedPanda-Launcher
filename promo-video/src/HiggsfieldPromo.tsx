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

const orange = "#F55E1D";
const green = "#22C55E";
const cyan = "#38BDF8";
const dark = "#0A0B0E";
const display = "'Arial Black', 'Space Grotesk', sans-serif";
const mono = "'JetBrains Mono', 'Cascadia Mono', monospace";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const springVal = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 130, mass: 0.9 },
  });

const SceneBackground: React.FC<{
  src: string;
  duration: number;
  zoomFrom?: number;
  zoomTo?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  overlay?: number;
}> = ({
  src,
  duration,
  zoomFrom = 1.04,
  zoomTo = 1.14,
  xFrom = 0,
  xTo = -30,
  yFrom = 0,
  yTo = -20,
  overlay = 0.45,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [zoomFrom, zoomTo], clamp);
  const x = interpolate(frame, [0, duration], [xFrom, xTo], clamp);
  const y = interpolate(frame, [0, duration], [yFrom, yTo], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: dark, overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(5,6,9,0.88) 0%, rgba(5,6,9,${overlay}) 32%, rgba(5,6,9,0.72) 68%, rgba(5,6,9,0.97) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, frame / (durationInFrames - 1));
  const blink = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 54,
          left: 70,
          right: 70,
          display: "flex",
          justifyContent: "space-between",
          color: "#B7BBC4",
          fontFamily: mono,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <span>// REDPANDA_CORE_v0.3.2</span>
        <span style={{ color: green }}>{blink ? "● NO ADS" : "○ NO ADS"}</span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 26,
          height: 26,
          borderTop: `3px solid ${orange}`,
          borderLeft: `3px solid ${orange}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 26,
          height: 26,
          borderTop: `3px solid ${orange}`,
          borderRight: `3px solid ${orange}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          width: 26,
          height: 26,
          borderBottom: `3px solid ${orange}`,
          borderLeft: `3px solid ${orange}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          width: 26,
          height: 26,
          borderBottom: `3px solid ${orange}`,
          borderRight: `3px solid ${orange}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: 58,
          height: 6,
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: orange,
            boxShadow: `0 0 18px ${orange}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
    }}
  />
);

const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = orange,
}) => (
  <div
    style={{
      display: "inline-block",
      padding: "10px 24px",
      border: `2px solid ${color}`,
      backgroundColor: `${color}18`,
      color,
      fontFamily: mono,
      fontWeight: 900,
      fontSize: 21,
      letterSpacing: 3,
      textTransform: "uppercase",
      boxShadow: `0 0 24px ${color}33`,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC<{
  children: React.ReactNode;
  size?: number;
  delay?: number;
}> = ({ children, size = 82, delay = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps, delay);

  return (
    <h1
      style={{
        margin: 0,
        color: "#FFFFFF",
        fontFamily: display,
        fontSize: size,
        lineHeight: 1.03,
        textAlign: "center",
        textTransform: "uppercase",
        transform: `scale(${pop})`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85)",
      }}
    >
      {children}
    </h1>
  );
};

const ScreenshotCard: React.FC<{
  src: string;
  label: string;
  color?: string;
  width?: number;
  top?: number;
  rotate?: number;
  delay?: number;
}> = ({
  src,
  label,
  color = orange,
  width = 900,
  top = 900,
  rotate = 0,
  delay = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps, delay);
  const float = Math.sin(frame / 18) * 6;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: "50%",
        width,
        transform: `translate(-50%, ${(1 - pop) * 70 + float}px) scale(${0.92 + pop * 0.08}) rotate(${rotate}deg)`,
        opacity: pop,
        borderRadius: 18,
        overflow: "hidden",
        border: `3px solid ${color}`,
        backgroundColor: "#0D0E12",
        boxShadow: `0 34px 90px rgba(0,0,0,0.72), 10px 10px 0 ${color}55`,
      }}
    >
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          backgroundColor: "#17191E",
          borderBottom: `1px solid ${color}55`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              backgroundColor: "#EF4444",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              backgroundColor: "#F59E0B",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              backgroundColor: green,
            }}
          />
        </div>
        <span
          style={{
            color,
            fontFamily: mono,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 2,
          }}
        >
          {label}
        </span>
      </div>
      <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
    </div>
  );
};

const BadgeRow: React.FC<{
  items: { text: string; color: string }[];
  top?: number;
}> = ({ items, top = 1520 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      {items.map((item, index) => {
        const pop = springVal(frame, fps, 18 + index * 5);
        return (
          <div
            key={item.text}
            style={{
              transform: `scale(${pop})`,
              opacity: pop,
              border: `2px solid ${item.color}`,
              backgroundColor: `${item.color}18`,
              color: "#FFFFFF",
              fontFamily: mono,
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1,
              padding: "12px 20px",
              boxShadow: `0 0 20px ${item.color}22`,
            }}
          >
            {item.text}
          </div>
        );
      })}
    </div>
  );
};

const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = springVal(frame, fps, 0);
  const sub = springVal(frame, fps, 22);

  return (
    <AbsoluteFill>
      <SceneBackground
        src="higgsfield/hook-redpanda.png"
        duration={105}
        zoomFrom={1.02}
        zoomTo={1.12}
        yTo={-40}
        overlay={0.42}
      />
      <AbsoluteFill
        style={{
          padding: "230px 60px 210px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ transform: `scale(${kicker})`, marginBottom: 28 }}>
          <Kicker>MINECRAFT-ЛАУНЧЕР НОВОГО ПОКОЛЕНИЯ</Kicker>
        </div>

        <Headline size={92}>
          ТВОЙ MINECRAFT
          <br />
          <span style={{ color: orange }}>БЕЗ ЛИШНИХ ПРОБЛЕМ</span>
        </Headline>

        <p
          style={{
            transform: `translateY(${(1 - sub) * 30}px)`,
            opacity: sub,
            color: "#D7DAE0",
            fontFamily: mono,
            fontSize: 27,
            lineHeight: 1.4,
            margin: "34px 0 0",
            maxWidth: 780,
            fontWeight: 700,
          }}
        >
          Быстрый запуск. Ноль рекламы. Моды и сборки в одном месте.
        </p>

        <div
          style={{
            transform: `translateY(${(1 - sub) * 30}px)`,
            opacity: sub,
            marginTop: 46,
            display: "flex",
            gap: 14,
          }}
        >
          {["RUST + TAURI", "0 РЕКЛАМЫ", "БЕСПЛАТНО"].map((text) => (
            <div
              key={text}
              style={{
                border: `2px solid ${orange}`,
                backgroundColor: "rgba(245,94,29,0.14)",
                color: "#FFFFFF",
                fontFamily: mono,
                fontSize: 19,
                fontWeight: 900,
                padding: "10px 16px",
                letterSpacing: 1,
              }}
            >
              {text}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CatalogScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = springVal(frame, fps, 0);
  const showCurseforge = frame >= 52;

  return (
    <AbsoluteFill>
      <SceneBackground
        src="higgsfield/mods-library.png"
        duration={105}
        zoomFrom={1.12}
        zoomTo={1.02}
        xFrom={20}
        xTo={-10}
        overlay={0.5}
      />
      <AbsoluteFill
        style={{
          padding: "230px 60px 210px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ transform: `scale(${kicker})`, marginBottom: 24 }}>
          <Kicker>ЕДИНЫЙ КАТАЛОГ</Kicker>
        </div>

        <Headline size={78}>
          МОДЫ И СБОРКИ
          <br />
          <span style={{ color: orange }}>В ОДНОМ МЕСТЕ</span>
        </Headline>

        <ScreenshotCard
          src={
            showCurseforge
              ? "references/v0.3.1/03_curseforge_catalog.png"
              : "references/v0.3.1/02_modrinth_catalog.png"
          }
          label={showCurseforge ? "CURSEFORGE" : "MODRINTH"}
          color={showCurseforge ? "#F97316" : green}
          top={850}
          rotate={showCurseforge ? 1.5 : -1.5}
          delay={showCurseforge ? 0 : 8}
        />

        <BadgeRow
          top={1470}
          items={[
            { text: "АВТО-ЗАВИСИМОСТИ", color: green },
            { text: "ШЕЙДЕРЫ И ТЕКСТУРЫ", color: cyan },
            { text: "1 КЛИК", color: orange },
          ]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BuilderScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = springVal(frame, fps, 0);
  const showThemes = frame >= 52;

  return (
    <AbsoluteFill>
      <SceneBackground
        src="higgsfield/builder.png"
        duration={105}
        zoomFrom={1.02}
        zoomTo={1.12}
        xFrom={-15}
        xTo={15}
        overlay={0.5}
      />
      <AbsoluteFill
        style={{
          padding: "230px 60px 210px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ transform: `scale(${kicker})`, marginBottom: 24 }}>
          <Kicker>УМНЫЙ КОНСТРУКТОР</Kicker>
        </div>

        <Headline size={84}>
          СБОРКА ПОД ТЕБЯ
          <br />
          <span style={{ color: orange }}>ЗА 2 КЛИКА</span>
        </Headline>

        <ScreenshotCard
          src={
            showThemes
              ? "references/v0.3.1/06_builder_themes.png"
              : "references/v0.3.1/05_modpack_builder.png"
          }
          label={showThemes ? "ТЕМАТИКИ СБОРКИ" : "MODPACK BUILDER"}
          color={showThemes ? "#A855F7" : orange}
          top={850}
          rotate={showThemes ? -1.5 : 1.5}
          delay={showThemes ? 0 : 8}
        />

        <BadgeRow
          top={1470}
          items={[
            { text: "ТЕМАТИКИ", color: "#A855F7" },
            { text: "МОДЫ", color: orange },
            { text: "ШЕЙДЕРЫ", color: cyan },
            { text: "БЕЗ КОНФЛИКТОВ", color: green },
          ]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const MultiplayerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = springVal(frame, fps, 0);
  const stat = springVal(frame, fps, 28);

  return (
    <AbsoluteFill>
      <SceneBackground
        src="higgsfield/islands.png"
        duration={105}
        zoomFrom={1.1}
        zoomTo={1.02}
        yFrom={-10}
        yTo={10}
        overlay={0.5}
      />
      <AbsoluteFill
        style={{
          padding: "230px 60px 210px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ transform: `scale(${kicker})`, marginBottom: 24 }}>
          <Kicker color={cyan}>МУЛЬТИПЛЕЕР БЕЗ ХАМАЧИ</Kicker>
        </div>

        <Headline size={84}>
          ИГРАЙ С ДРУЗЬЯМИ
          <br />
          <span style={{ color: cyan }}>В ОДИН КЛИК</span>
        </Headline>

        <ScreenshotCard
          src="references/v0.3.1/01_home.png"
          label="REDPANDA LAUNCHER"
          color={cyan}
          top={850}
          rotate={-1.2}
          delay={8}
        />

        <div
          style={{
            position: "absolute",
            top: 1460,
            left: 70,
            right: 70,
            display: "flex",
            justifyContent: "center",
            gap: 16,
            transform: `scale(${stat})`,
            opacity: stat,
          }}
        >
          {[
            { value: "P2P", label: "E4MC / STEAM" },
            { value: "0.1С", label: "СТАРТ" },
            { value: "0", label: "РЕКЛАМЫ" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                maxWidth: 280,
                border: "2px solid #343846",
                backgroundColor: "rgba(12,13,17,0.86)",
                padding: "16px 10px",
              }}
            >
              <div
                style={{
                  color: "#FFFFFF",
                  fontFamily: display,
                  fontSize: 38,
                  lineHeight: 1,
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  color: "#9CA3AF",
                  fontFamily: mono,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 1,
                  marginTop: 8,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springVal(frame, fps, 0);
  const button = springVal(frame, fps, 14);
  const pulse = Math.sin(frame / 5) * 0.04 + 1;

  return (
    <AbsoluteFill>
      <SceneBackground
        src="higgsfield/cta-hero.png"
        duration={90}
        zoomFrom={1.02}
        zoomTo={1.08}
        yTo={-30}
        overlay={0.55}
      />
      <AbsoluteFill
        style={{
          padding: "220px 60px 180px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div
          style={{
            transform: `scale(${pop})`,
            width: 150,
            height: 150,
            border: `4px solid ${orange}`,
            backgroundColor: "#101116",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `8px 8px 0 ${orange}, 0 0 50px rgba(245,94,29,0.35)`,
            marginBottom: 32,
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{ width: 116, height: 116, objectFit: "contain" }}
          />
        </div>

        <div style={{ transform: `scale(${pop})`, marginBottom: 18 }}>
          <Kicker color={green}>БЕСПЛАТНО • WINDOWS 10/11</Kicker>
        </div>

        <Headline size={96} delay={8}>
          СКАЧАЙ
          <br />
          <span style={{ color: orange }}>REDPANDA</span>
        </Headline>

        <p
          style={{
            color: "#D7DAE0",
            fontFamily: mono,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.4,
            margin: "26px 0 0",
          }}
        >
          Больше игры. Меньше проблем.
        </p>

        <div
          style={{
            transform: `scale(${button * pulse})`,
            opacity: button,
            marginTop: 52,
            backgroundColor: orange,
            color: "#050608",
            fontFamily: mono,
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 2,
            padding: "26px 54px",
            border: "4px solid #FFFFFF",
            boxShadow: `0 0 70px ${orange}99, 12px 12px 0 #FFFFFF`,
            textTransform: "uppercase",
          }}
        >
          СКАЧАТЬ ЛАУНЧЕР
        </div>

        <div
          style={{
            transform: `scale(${button})`,
            opacity: button,
            marginTop: 34,
            backgroundColor: "rgba(12,13,17,0.9)",
            border: "2px solid #3A3E4C",
            padding: "16px 38px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: mono,
          }}
        >
          <span style={{ fontSize: 28 }}>🌐</span>
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 33,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            REDLAUNCHER.RU
          </span>
        </div>

        <div
          style={{
            marginTop: 28,
            color: "#CBD5E1",
            fontFamily: mono,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 2,
          }}
        >
          ССЫЛКА В ШАПКЕ ПРОФИЛЯ
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface HiggsfieldPromoProps {
  version?: string;
  siteUrl?: string;
}

export const HiggsfieldPromo: React.FC<HiggsfieldPromoProps> = ({
  version = "v0.3.2",
  siteUrl = "redlauncher.ru",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const flash = [105, 210, 315, 420].reduce((value, cut) => {
    const local = interpolate(Math.abs(frame - cut), [0, 7], [0.55, 0], clamp);
    return Math.max(value, local);
  }, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: dark }}>
      <Audio src={staticFile("five-minutes-beat.wav")} volume={0.24} />

      <Sequence from={0} durationInFrames={105}>
        <HookScene />
      </Sequence>
      <Sequence from={105} durationInFrames={105}>
        <CatalogScene />
      </Sequence>
      <Sequence from={210} durationInFrames={105}>
        <BuilderScene />
      </Sequence>
      <Sequence from={315} durationInFrames={105}>
        <MultiplayerScene />
      </Sequence>
      <Sequence from={420} durationInFrames={90}>
        <CtaScene />
      </Sequence>

      <Vignette />
      <Hud />

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundColor: orange,
          opacity: flash,
          mixBlendMode: "screen",
        }}
      />

      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.035 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 1px, transparent 1px, transparent 4px)",
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 82,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.42)",
            fontFamily: mono,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 3,
          }}
        >
          {version.toUpperCase()} • {siteUrl.toUpperCase()}
        </span>
      </div>
    </AbsoluteFill>
  );
};
