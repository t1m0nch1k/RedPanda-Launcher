import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CyberBackground } from "./components/CyberBackground";
import { Round1Speed } from "./components/battle/Round1Speed";
import { Round2Ram } from "./components/battle/Round2Ram";
import { Round3ModsMultiplayer } from "./components/battle/Round3ModsMultiplayer";
import { BattleWinner } from "./components/battle/BattleWinner";

export const BattlePromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0F12" }}>
      {/* Background Cyber Grid */}
      <CyberBackground />

      {/* Round 1: Speed & Ads (0 - 110 frames / ~3.6s) */}
      <Sequence from={0} durationInFrames={110}>
        <Round1Speed />
      </Sequence>

      {/* Round 2: RAM Consumption (110 - 220 frames / ~3.6s) */}
      <Sequence from={110} durationInFrames={110}>
        <Round2Ram />
      </Sequence>

      {/* Round 3: Mods & Multiplayer (220 - 350 frames / ~4.3s) */}
      <Sequence from={220} durationInFrames={130}>
        <Round3ModsMultiplayer />
      </Sequence>

      {/* Round 4 / Winner & CTA (350 - 480 frames / ~4.3s) */}
      <Sequence from={350} durationInFrames={130}>
        <BattleWinner />
      </Sequence>
    </AbsoluteFill>
  );
};
