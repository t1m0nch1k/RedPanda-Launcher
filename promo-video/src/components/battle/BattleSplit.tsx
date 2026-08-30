import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface BattleSplitProps {
  leftTitle?: string;
  rightTitle?: string;
  roundTitle: string;
  roundNumber: number;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}

export const BattleSplit: React.FC<BattleSplitProps> = ({
  leftTitle = "СТАРЫЙ ЛАУНЧЕР",
  rightTitle = "REDPANDA LAUNCHER",
  roundTitle,
  roundNumber,
  leftContent,
  rightContent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const vsScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 140 },
  });

  const leftSlide = spring({
    frame: frame - 3,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const rightSlide = spring({
    frame: frame - 6,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

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
        padding: "80px 40px 60px",
        boxSizing: "border-box",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Round Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <div
          style={{
            backgroundColor: "#F55E1D",
            color: "#000000",
            fontWeight: 900,
            fontSize: 24,
            padding: "6px 20px",
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          РАУНД {roundNumber} // СРАВНЕНИЕ
        </div>
        <h2
          style={{
            fontSize: 46,
            color: "#FFFFFF",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            textTransform: "uppercase",
            margin: 0,
            textAlign: "center",
          }}
        >
          {roundTitle}
        </h2>
      </div>

      {/* Main Split Cards Container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 30,
          width: "100%",
          flex: 1,
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Top / Left: Old Launcher */}
        <div
          style={{
            transform: `scale(${leftSlide})`,
            backgroundColor: "#15161A",
            border: "3px solid #EF4444",
            boxShadow: "0 10px 30px rgba(239, 68, 68, 0.2), 8px 8px 0px #EF4444",
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            minHeight: 460,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -18,
              left: 24,
              backgroundColor: "#EF4444",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 20,
              padding: "4px 16px",
              letterSpacing: 2,
            }}
          >
            ❌ {leftTitle}
          </div>
          {leftContent}
        </div>

        {/* Floating Animated VS Badge */}
        <div
          style={{
            transform: `scale(${vsScale})`,
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: -45,
            marginLeft: -45,
            width: 90,
            height: 90,
            borderRadius: "50%",
            backgroundColor: "#F55E1D",
            color: "#000000",
            border: "4px solid #FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 32,
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: "0 0 25px rgba(245, 94, 29, 0.8)",
            zIndex: 10,
          }}
        >
          VS
        </div>

        {/* Bottom / Right: RedPanda Launcher */}
        <div
          style={{
            transform: `scale(${rightSlide})`,
            backgroundColor: "#17191E",
            border: "3px solid #22C55E",
            boxShadow: "0 10px 30px rgba(34, 197, 94, 0.25), 8px 8px 0px #22C55E",
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            minHeight: 460,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -18,
              left: 24,
              backgroundColor: "#22C55E",
              color: "#000000",
              fontWeight: 900,
              fontSize: 20,
              padding: "4px 16px",
              letterSpacing: 2,
            }}
          >
            ✅ {rightTitle} (RUST)
          </div>
          {rightContent}
        </div>
      </div>
    </div>
  );
};
