import React from "react";
import { BattleSplit } from "./BattleSplit";

export const Round1Speed: React.FC = () => {
  return (
    <BattleSplit
      roundNumber={1}
      roundTitle="СКОРОСТЬ СТАРТА И РЕКЛАМА"
      leftContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: "#EF4444", fontFamily: "'Space Grotesk'" }}>
              8.5 сек
            </span>
            <span style={{ fontSize: 22, color: "#8E939E" }}>медленный запуск</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <div style={{ backgroundColor: "#201214", padding: "12px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
              🛑 Баннеры казино и спам
            </div>
            <div style={{ backgroundColor: "#201214", padding: "12px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
              🛑 Закрытый подозрительный код
            </div>
          </div>
        </div>
      }
      rightContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: "#22C55E", fontFamily: "'Space Grotesk'" }}>
              &lt; 0.8 сек
            </span>
            <span style={{ fontSize: 22, color: "#8E939E" }}>мгновенный старт</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <div style={{ backgroundColor: "#0F2418", padding: "12px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
              ⚡ 0% спам-рекламы и баннеров
            </div>
            <div style={{ backgroundColor: "#0F2418", padding: "12px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
              ⚡ 100% Open-Source (Rust + Tauri)
            </div>
          </div>
        </div>
      }
    />
  );
};
