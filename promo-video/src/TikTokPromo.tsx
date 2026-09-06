import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CyberBackground } from "./components/CyberBackground";
import { HookScene } from "./components/HookScene";
import { RevealScene } from "./components/RevealScene";
import { FeaturesScene } from "./components/FeaturesScene";
import { ShowcaseScene } from "./components/ShowcaseScene";
import { CtaScene } from "./components/CtaScene";

interface TikTokPromoProps {
  version?: string;
  siteUrl?: string;
}

export const TikTokPromo: React.FC<TikTokPromoProps> = ({
  version = "v0.2.2",
  siteUrl = "redlauncher.ru"
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0F12" }}>
      {/* Persistent Animated Cyber Background */}
      <CyberBackground />

      {/* Scene 1: The Hook (0s - 3s / 0 - 90 frames) */}
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>

      {/* Scene 2: The Reveal (3s - 6s / 90 - 180 frames) */}
      <Sequence from={90} durationInFrames={90}>
        <RevealScene />
      </Sequence>

      {/* Scene 3: Top Features (6s - 9.5s / 180 - 285 frames) */}
      <Sequence from={180} durationInFrames={105}>
        <FeaturesScene />
      </Sequence>

      {/* Scene 4: Interface & Mod Loaders (9.5s - 12.5s / 285 - 375 frames) */}
      <Sequence from={285} durationInFrames={90}>
        <ShowcaseScene />
      </Sequence>

      {/* Scene 5: Call To Action (12.5s - 15s / 375 - 450 frames) */}
      <Sequence from={375} durationInFrames={75}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
