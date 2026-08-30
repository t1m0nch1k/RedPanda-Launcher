import React from "react";
import { BattleSplit } from "./BattleSplit";

export const Round3ModsMultiplayer: React.FC = () => {
  return (
    <BattleSplit
      roundNumber={3}
      roundTitle="МОДЫ И ИГРА С ДРУЗЬЯМИ"
      leftContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ backgroundColor: "#201214", padding: "14px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
            ❌ Поиск модов по левым сайтам с вирусами
          </div>
          <div style={{ backgroundColor: "#201214", padding: "14px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
            ❌ Мучения с Хамачи, белыми IP и портами
          </div>
          <div style={{ backgroundColor: "#201214", padding: "14px 18px", borderLeft: "4px solid #EF4444", color: "#FCA5A5", fontSize: 22, fontWeight: 700 }}>
            ❌ Ручной перебор модов при вылетах
          </div>
        </div>
      }
      rightContent={
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ backgroundColor: "#0F2418", padding: "14px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
            ✅ Modrinth + CurseForge в 1 клик с авто-зависимостями
          </div>
          <div style={{ backgroundColor: "#0F2418", padding: "14px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
            ✅ Встроенный P2P мультиплеер (e4mc / Steam)
          </div>
          <div style={{ backgroundColor: "#0F2418", padding: "14px 18px", borderLeft: "4px solid #22C55E", color: "#86EFAC", fontSize: 22, fontWeight: 700 }}>
            ✅ Авто-диагностика сборок и отключение модов (v0.2.2)
          </div>
        </div>
      }
    />
  );
};
