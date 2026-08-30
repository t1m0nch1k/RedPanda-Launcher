import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const BattleWinner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const winnerSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 120 },
  });

  const buttonGlow = Math.sin(frame / 4) * 20 + 25;
  const arrowY = Math.sin(frame / 3.5) * 15;

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
        textAlign: "center",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Crown / Winner Trophy Badge */}
      <div
        style={{
          transform: `scale(${winnerSpring})`,
          backgroundColor: "#22C55E",
          color: "#000000",
          fontSize: 32,
          fontWeight: 900,
          padding: "12px 32px",
          letterSpacing: 4,
          marginBottom: 30,
          boxShadow: "0 0 30px rgba(34, 197, 94, 0.6)",
        }}
      >
        🏆 БЕЗОГОВОРОЧНЫЙ ПОБЕДИТЕЛЬ 🏆
      </div>

      {/* Logo */}
      <div
        style={{
          transform: `scale(${winnerSpring})`,
          width: 180,
          height: 180,
          backgroundColor: "#17191E",
          border: "4px solid #F55E1D",
          boxShadow: "10px 10px 0px #F55E1D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 36,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: 140, height: 140, objectFit: "contain" }}
        />
      </div>

      <h1
        style={{
          fontSize: 72,
          color: "#FFFFFF",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.05,
          margin: 0,
          marginBottom: 40,
        }}
      >
        REDPANDA <br />
        <span style={{ color: "#F55E1D" }}>LAUNCHER v0.2.2</span>
      </h1>

      {/* Big Download Button */}
      <div
        style={{
          transform: `scale(${winnerSpring})`,
          backgroundColor: "#F55E1D",
          color: "#000000",
          fontSize: 40,
          fontWeight: 900,
          fontFamily: "'Space Grotesk', sans-serif",
          padding: "26px 44px",
          textTransform: "uppercase",
          boxShadow: `0 0 ${buttonGlow}px rgba(245, 94, 29, 0.8), 8px 8px 0px #000000`,
          border: "4px solid #000000",
          marginBottom: 40,
          width: "100%",
          maxWidth: 860,
        }}
      >
        ⚡ СКАЧАТЬ БЕСПЛАТНО ⚡
      </div>

      {/* Site URL badge */}
      <div
        style={{
          backgroundColor: "#17191E",
          border: "3px solid #2B2E36",
          padding: "18px 36px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 34,
          fontWeight: 900,
          color: "#FFFFFF",
          marginBottom: 40,
        }}
      >
        <span>🌐</span>
        <span>REDLAUNCHER.RU</span>
      </div>

      {/* Arrow */}
      <div
        style={{
          transform: `translateY(${arrowY}px)`,
          fontSize: 48,
          color: "#F55E1D",
          fontWeight: 800,
        }}
      >
        👇 ССЫЛКА В ШАПКЕ ПРОФИЛЯ 👇
      </div>
    </div>
  );
};
