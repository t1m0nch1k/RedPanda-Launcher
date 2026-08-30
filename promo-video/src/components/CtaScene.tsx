import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 120 },
  });

  const arrowY = Math.sin(frame / 4) * 15;
  const buttonGlow = Math.sin(frame / 5) * 20 + 20;

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
      {/* Brand Icon */}
      <div
        style={{
          transform: `scale(${ctaSpring})`,
          width: 160,
          height: 160,
          backgroundColor: "#17191E",
          border: "4px solid #F55E1D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
          boxShadow: "8px 8px 0px #F55E1D",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: 120, height: 120, objectFit: "contain" }}
        />
      </div>

      <h2
        style={{
          fontSize: 68,
          color: "#FFFFFF",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.1,
          margin: 0,
          marginBottom: 30,
        }}
      >
        ИГРАЙ В MINECRAFT <br />
        <span style={{ color: "#F55E1D" }}>БЕЗ ЛАГОВ И СПАМА!</span>
      </h2>

      {/* Main Download Button */}
      <div
        style={{
          transform: `scale(${ctaSpring})`,
          backgroundColor: "#F55E1D",
          color: "#000000",
          fontSize: 42,
          fontWeight: 900,
          fontFamily: "'Space Grotesk', sans-serif",
          padding: "28px 48px",
          textTransform: "uppercase",
          boxShadow: `0 0 ${buttonGlow}px rgba(245, 94, 29, 0.8), 8px 8px 0px #000000`,
          border: "4px solid #000000",
          marginBottom: 40,
          width: "100%",
          maxWidth: 820,
        }}
      >
        ⬇ СКАЧАТЬ SETUP v0.2.2 ⬇
      </div>

      {/* Website Domain Box */}
      <div
        style={{
          backgroundColor: "#17191E",
          border: "3px solid #2B2E36",
          padding: "20px 40px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 36,
          fontWeight: 900,
          color: "#FFFFFF",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2,
          marginBottom: 50,
        }}
      >
        <span>🌐</span>
        <span>REDLAUNCHER.RU</span>
      </div>

      {/* Animated Arrow Pointer */}
      <div
        style={{
          transform: `translateY(${arrowY}px)`,
          fontSize: 54,
          color: "#F55E1D",
        }}
      >
        👇 ССЫЛКА В ШАПКЕ ПРОФИЛЯ 👇
      </div>
    </div>
  );
};
