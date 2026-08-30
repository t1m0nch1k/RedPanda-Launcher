import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  // Strikethrough animations
  const strikeProgress1 = interpolate(frame, [25, 45], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const strikeProgress2 = interpolate(frame, [40, 60], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const strikeProgress3 = interpolate(frame, [55, 75], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
        justifyContent: "center",
        padding: "0 60px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {/* Warning Badge */}
      <div
        style={{
          transform: `scale(${scale})`,
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          border: "2px solid #EF4444",
          color: "#EF4444",
          padding: "12px 28px",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 40,
        }}
      >
        ⚠️ ХВАТИТ ЭТО ТЕРПЕТЬ!
      </div>

      {/* Main Hook Question */}
      <h1
        style={{
          transform: `scale(${scale})`,
          fontSize: 64,
          lineHeight: 1.15,
          color: "#FFFFFF",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          marginBottom: 60,
          textShadow: "0 0 30px rgba(245, 94, 29, 0.4)",
        }}
      >
        Твой лаунчер <br />
        <span style={{ color: "#EF4444" }}>ЖРЁТ ПАМЯТЬ</span> <br />
        И КРУТИТ РЕКЛАМУ?
      </h1>

      {/* Bad Launcher Pain Points (Strikethrough) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 840 }}>
        {/* Pain Point 1 */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#17191E",
            border: "2px solid #2B2E36",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            fontWeight: 700,
            color: "#8E939E",
          }}
        >
          <span>❌ Тонны спам-баннеров</span>
          {/* Strikethrough line */}
          <div
            style={{
              position: "absolute",
              left: 20,
              top: "50%",
              width: `${strikeProgress1}%`,
              height: 6,
              backgroundColor: "#EF4444",
              transform: "translateY(-50%)",
              boxShadow: "0 0 10px #EF4444",
            }}
          />
        </div>

        {/* Pain Point 2 */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#17191E",
            border: "2px solid #2B2E36",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            fontWeight: 700,
            color: "#8E939E",
          }}
        >
          <span>❌ 1 ГБ ОЗУ в фоновом режиме</span>
          <div
            style={{
              position: "absolute",
              left: 20,
              top: "50%",
              width: `${strikeProgress2}%`,
              height: 6,
              backgroundColor: "#EF4444",
              transform: "translateY(-50%)",
              boxShadow: "0 0 10px #EF4444",
            }}
          />
        </div>

        {/* Pain Point 3 */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#17191E",
            border: "2px solid #2B2E36",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            fontWeight: 700,
            color: "#8E939E",
          }}
        >
          <span>❌ Хамачи и закрытые порты</span>
          <div
            style={{
              position: "absolute",
              left: 20,
              top: "50%",
              width: `${strikeProgress3}%`,
              height: 6,
              backgroundColor: "#EF4444",
              transform: "translateY(-50%)",
              boxShadow: "0 0 10px #EF4444",
            }}
          />
        </div>
      </div>
    </div>
  );
};
