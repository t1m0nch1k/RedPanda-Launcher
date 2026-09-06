import React from "react";
import { Composition } from "remotion";
import { TikTokPromo } from "./TikTokPromo";
import { TikTokUpdatePromo } from "./TikTokUpdatePromo";
import { BattlePromo } from "./BattlePromo";

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
    </>
  );
};
