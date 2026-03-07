import { AbsoluteFill, OffthreadVideo, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import type { Caption } from "./Captions";

export interface CaptionTestProps extends Record<string, unknown> {
  clipStartMs: number;
  clipEndMs: number;
  captions: Caption[];
  videoSrc: string;
}

export const CaptionTestComposition: React.FC<CaptionTestProps> = ({
  clipStartMs,
  clipEndMs,
  captions,
  videoSrc,
}) => {
  const { fps } = useVideoConfig();

  const startFromFrame = Math.round((clipStartMs / 1000) * fps);
  const endAtFrame = Math.round((clipEndMs / 1000) * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <OffthreadVideo
        src={videoSrc}
        startFrom={startFromFrame}
        endAt={endAtFrame}
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) scale(1.7778)",
          transformOrigin: "center center",
        }}
      />
      <Captions captions={captions} clipStartMs={clipStartMs} />
    </AbsoluteFill>
  );
};
