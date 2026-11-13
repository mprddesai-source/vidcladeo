import React from "react";
import { Composition } from "remotion";
import { KiteDay, MEADOW_FRAMES } from "./videos/meadow/Meadow";

export const RemotionRoot: React.FC = () => (
  <Composition id="KiteDay" component={KiteDay} durationInFrames={MEADOW_FRAMES} fps={30} width={1080} height={1920} />
);
