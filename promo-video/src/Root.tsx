import React from "react";
import { Composition } from "remotion";
import { TikTokPromo } from "./TikTokPromo";
import { TikTokUpdatePromo } from "./TikTokUpdatePromo";
import { BattlePromo } from "./BattlePromo";
import { ModpackBuilderPromo } from "./ModpackBuilderPromo";
import { FiveMinutesPromo } from "./FiveMinutesPromo";
import { SilentCyberPromo } from "./SilentCyberPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Promo Option 1: General Feature Promo (15s) */}
      <Composition
        id="TikTokPromo"
        component={TikTokPromo}
        durationInFrames={450} // 15 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.2.2",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 2: v0.3.0 Update Spotlight (15s) */}
      <Composition
        id="TikTokUpdatePromo"
        component={TikTokUpdatePromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.0",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 3: Split-Screen Battle Promo (16s) */}
      <Composition
        id="BattlePromo"
        component={BattlePromo}
        durationInFrames={480} // 16 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.2.2",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 4: Smart Modpack Builder v0.3.0 Feature Video (17s) */}
      <Composition
        id="ModpackBuilderPromo"
        component={ModpackBuilderPromo}
        durationInFrames={510} // 17 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.0",
          siteUrl: "redlauncher.ru"
        }}
      />

      <Composition
        id="ModpackBuilderPromo17s"
        component={ModpackBuilderPromo}
        durationInFrames={510} // 17 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.0",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 5: Smart Modpack Builder v0.3.0 Feature Video Extended (27s) */}
      <Composition
        id="ModpackBuilderPromo27s"
        component={ModpackBuilderPromo}
        durationInFrames={810} // 27 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.0",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 6: "I'll join in five minutes" story (18s) */}
      <Composition
        id="FiveMinutesPromo"
        component={FiveMinutesPromo}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.2",
          siteUrl: "redlauncher.ru"
        }}
      />

      {/* Promo Option 7: Cyber Promo with Voiceover & Beat (16s) */}
      <Composition
        id="CyberVoicePromo"
        component={SilentCyberPromo}
        durationInFrames={480}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.2",
          siteUrl: "redlauncher.ru",
          voiceover: true,
          includeBeat: true,
        }}
      />

      {/* Promo Option 8: Silent Cyber Promo v0.3.2 (16s - No Audio for TikTok trends) */}
      <Composition
        id="SilentCyberPromo"
        component={SilentCyberPromo}
        durationInFrames={480}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: "v0.3.2",
          siteUrl: "redlauncher.ru",
          voiceover: false,
          includeBeat: false,
        }}
      />
    </>
  );
};
