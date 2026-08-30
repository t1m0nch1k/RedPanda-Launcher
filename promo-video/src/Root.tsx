import React from "react";
import { Composition } from "remotion";
import { TikTokPromo } from "./TikTokPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
    </>
  );
};
