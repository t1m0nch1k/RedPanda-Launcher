import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const ShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const tilt = interpolate(frame, [0, 90], [4, -4]);

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
      }}
    >
      {/* Badge */}
      <div
        style={{
          backgroundColor: "#17191E",
          border: "2px solid #F55E1D",
          color: "#F55E1D",
          fontSize: 22,
          fontWeight: 800,
          padding: "10px 24px",
          marginBottom: 24,
          letterSpacing: 3,
        }}
      >
        // CYBER-BRUTALIST ИНТЕРФЕЙС
      </div>

      <h2
        style={{
          fontSize: 58,
          color: "#FFFFFF",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          marginBottom: 40,
          margin: 0,
        }}
      >
        СТИЛЬНЫЙ & ПОНЯТНЫЙ UI
      </h2>

      {/* Floating 3D Screenshot Frame */}
      <div
        style={{
          transform: `scale(${screenshotSpring}) rotate(${tilt}deg)`,
          width: 920,
          height: 560,
          backgroundColor: "#17191E",
          border: "4px solid #2B2E36",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8), 12px 12px 0px #F55E1D",
          position: "relative",
          overflow: "hidden",
          marginBottom: 50,
        }}
      >
        <Img
          src={staticFile("screenshot_2.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Terminal Header Bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 36,
            backgroundColor: "rgba(14, 15, 18, 0.9)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#EF4444" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#22C55E" }} />
          <span style={{ marginLeft: 12, fontSize: 13, color: "#8E939E", fontFamily: "'JetBrains Mono'" }}>
            REDPANDA_INTERFACE.EXE
          </span>
        </div>
      </div>

      {/* Loader badges list */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, maxWidth: 900 }}>
        {["Fabric", "Forge", "NeoForge", "Quilt", "Vanilla"].map((loader, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#17191E",
              border: "2px solid #2B2E36",
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: 800,
              padding: "12px 24px",
              letterSpacing: 2,
            }}
          >
            ✔ {loader}
          </div>
        ))}
      </div>
    </div>
  );
};
