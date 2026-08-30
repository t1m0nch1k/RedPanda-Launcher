import React from "react";
import { BattleSplit } from "./BattleSplit";

export const Round2Ram: React.FC = () => {
  return (
    <BattleSplit
      roundNumber={2}
      roundTitle="ОПЕРАТИВНАЯ ПАМЯТЬ (ОЗУ)"
      leftContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 62, fontWeight: 900, color: "#EF4444", fontFamily: "'Space Grotesk'" }}>
              950 МБ
            </span>
            <span style={{ fontSize: 22, color: "#8E939E" }}>в фоновом режиме</span>
          </div>

          {/* Progress Bar (Old launcher 95%) */}
          <div style={{ width: "100%", height: 28, backgroundColor: "#261316", border: "2px solid #EF4444", overflow: "hidden", position: "relative" }}>
            <div style={{ width: "92%", height: "100%", backgroundColor: "#EF4444" }} />
          </div>

          <div style={{ backgroundColor: "#201214", padding: "12px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
            🛑 Тормозит Windows и отбирает FPS
          </div>
        </div>
      }
      rightContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 62, fontWeight: 900, color: "#22C55E", fontFamily: "'Space Grotesk'" }}>
              40 МБ
            </span>
            <span style={{ fontSize: 22, color: "#8E939E" }}>легковесный Rust</span>
          </div>

          {/* Progress Bar (RedPanda 4%) */}
          <div style={{ width: "100%", height: 28, backgroundColor: "#0C1F15", border: "2px solid #22C55E", overflow: "hidden", position: "relative" }}>
            <div style={{ width: "6%", height: "100%", backgroundColor: "#22C55E" }} />
          </div>

          <div style={{ backgroundColor: "#0F2418", padding: "12px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
            ⚡ Вся память достаётся Minecraft!
          </div>
        </div>
      }
    />
  );
};
