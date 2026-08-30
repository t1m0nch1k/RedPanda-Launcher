import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const CyberBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const gridOffset = (frame * 2.5) % 60;
  const pulse = Math.sin(frame / 10) * 0.15 + 0.85;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1080,
        height: 1920,
        backgroundColor: "#0A0B0E",
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Dynamic Cyber Grid */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 1280,
          height: 2120,
          backgroundImage: `
            linear-gradient(to right, rgba(245, 94, 29, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(245, 94, 29, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          transform: `translateY(${gridOffset}px)`,
        }}
      />

      {/* Radiant Orange Glow Orbs */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 94, 29, 0.22) 0%, rgba(245, 94, 29, 0) 70%)",
          filter: "blur(40px)",
          opacity: pulse,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translate(-50%, 50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 94, 29, 0.15) 0%, rgba(245, 94, 29, 0) 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Cyber Corner Accents */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 30,
          height: 30,
          borderTop: "3px solid #F55E1D",
          borderLeft: "3px solid #F55E1D",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 30,
          height: 30,
          borderTop: "3px solid #F55E1D",
          borderRight: "3px solid #F55E1D",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          width: 30,
          height: 30,
          borderBottom: "3px solid #F55E1D",
          borderLeft: "3px solid #F55E1D",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          width: 30,
          height: 30,
          borderBottom: "3px solid #F55E1D",
          borderRight: "3px solid #F55E1D",
        }}
      />

      {/* Top Cyber Ticker */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 90,
          right: 90,
          display: "flex",
          justifyContent: "space-between",
          color: "#8E939E",
          fontSize: 18,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <span>// REDPANDA_CORE_v0.2.2</span>
        <span style={{ color: "#22C55E" }}>● LIVE_BUILD</span>
      </div>
    </div>
  );
};
