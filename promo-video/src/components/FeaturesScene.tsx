import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const card1 = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 100 } });
  const card2 = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 100 } });
  const card3 = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 100 } });
  const card4 = spring({ frame: frame - 35, fps, config: { damping: 12, stiffness: 100 } });

  const features = [
    {
      icon: "📦",
      title: "MODRINTH + CURSEFORGE",
      desc: "Единый каталог модов, шейдеров и текстур в 1 клик с зависимостями",
      springVal: card1,
      color: "#F55E1D",
    },
    {
      icon: "🌐",
      title: "P2P МУЛЬТИПЛЕЕР (e4mc / Steam)",
      desc: "Открывай одиночный мир друзьям без портов и Хамачи!",
      springVal: card2,
      color: "#38BDF8",
    },
    {
      icon: "🔍",
      title: "ДИАГНОСТИКА СБОРОК (v0.2.2)",
      desc: "Авто-проверка Java, памяти и отключение модов без удаления",
      springVal: card3,
      color: "#22C55E",
    },
    {
      icon: "🛡️",
      title: "AES-256 КРИПТО-ХРАНИЛИЩЕ",
      desc: "Аппаратное шифрование аккаунтов Microsoft и Ely.by",
      springVal: card4,
      color: "#A855F7",
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 50px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ transform: `scale(${titleSpring})`, textAlign: "center", marginBottom: 40 }}>
        <span
          style={{
            fontSize: 24,
            color: "#F55E1D",
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          // ТОПОВЫЙ ФУНКЦИОНАЛ
        </span>
        <h2
          style={{
            fontSize: 60,
            color: "#FFFFFF",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            textTransform: "uppercase",
            marginTop: 10,
            margin: 0,
          }}
        >
          ВСЁ ДЛЯ КОМФОРТНОЙ ИГРЫ
        </h2>
      </div>

      {/* Feature Cards Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 920 }}>
        {features.map((f, i) => (
          <div
            key={i}
            style={{
              transform: `scale(${f.springVal})`,
              backgroundColor: "#17191E",
              border: `2px solid ${f.color}`,
              boxShadow: `6px 6px 0px ${f.color}`,
              padding: "24px 28px",
              display: "flex",
              alignItems: "center",
              gap: 24,
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 48,
                width: 80,
                height: 80,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {f.icon}
            </div>
            <div>
              <h3
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  margin: 0,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 20,
                  color: "#8E939E",
                  margin: "8px 0 0 0",
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.3,
                }}
              >
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
