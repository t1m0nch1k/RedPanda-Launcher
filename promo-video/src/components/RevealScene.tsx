import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const textSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const badgesSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const glow = Math.sin(frame / 6) * 15 + 35;

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
        padding: "0 60px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {/* Brand Logo with 3D Cyber Box */}
      <div
        style={{
          transform: `scale(${logoSpring}) rotate(${interpolate(frame, [0, 90], [-5, 5])}deg)`,
          width: 220,
          height: 220,
          backgroundColor: "#17191E",
          border: "4px solid #F55E1D",
          boxShadow: `0 0 ${glow}px rgba(245, 94, 29, 0.7), 12px 12px 0px #F55E1D`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 50,
          position: "relative",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: 170, height: 170, objectFit: "contain" }}
        />
        {/* Version Badge */}
        <div
          style={{
            position: "absolute",
            bottom: -18,
            backgroundColor: "#F55E1D",
            color: "#000000",
            fontWeight: 900,
            fontSize: 22,
            padding: "4px 16px",
            letterSpacing: 2,
          }}
        >
          v0.2.2 RELEASE
        </div>
      </div>

      {/* Main Title */}
      <div style={{ transform: `scale(${textSpring})`, marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 76,
            lineHeight: 1.05,
            color: "#FFFFFF",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          REDPANDA <br />
          <span style={{ color: "#F55E1D" }}>LAUNCHER</span>
        </h2>
        <p
          style={{
            fontSize: 28,
            color: "#8E939E",
            letterSpacing: 3,
            textTransform: "uppercase",
            marginTop: 20,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          // НА СТЕКЕ RUST 2021 + TAURI 2.0
        </p>
      </div>

      {/* 3 Metric Pills */}
      <div
        style={{
          transform: `scale(${badgesSpring})`,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: "100%",
          maxWidth: 860,
        }}
      >
        <div
          style={{
            backgroundColor: "#17191E",
            border: "2px solid #F55E1D",
            padding: "20px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 26, color: "#8E939E", fontWeight: 700 }}>⚡ ЗАПУСК ИГРЫ:</span>
          <span style={{ fontSize: 36, color: "#F55E1D", fontWeight: 900 }}>&lt; 0.8 СЕКУНД</span>
        </div>

        <div
          style={{
            backgroundColor: "#17191E",
            border: "2px solid #2B2E36",
            padding: "20px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 26, color: "#8E939E", fontWeight: 700 }}>🧠 ОПЕРАТИВНАЯ ПАМЯТЬ:</span>
          <span style={{ fontSize: 36, color: "#22C55E", fontWeight: 900 }}>ВСЕГО 40 МБ</span>
        </div>

        <div
          style={{
            backgroundColor: "#17191E",
            border: "2px solid #2B2E36",
            padding: "20px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 26, color: "#8E939E", fontWeight: 700 }}>🚫 РЕКЛАМА И МАЙНИНГ:</span>
          <span style={{ fontSize: 36, color: "#38BDF8", fontWeight: 900 }}>0% (OPEN SOURCE)</span>
        </div>
      </div>
    </div>
  );
};
