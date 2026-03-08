import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export const FunnyCaption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    fps,
    frame,
    config: { mass: 0.6, stiffness: 280, damping: 22 },
    durationInFrames: Math.round(fps * 0.4),
  });

  const scaleVal = interpolate(entrance, [0, 1], [0.7, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 48px",
        opacity,
        transform: `scale(${scaleVal})`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Arial Black', 'Impact', Arial, sans-serif",
          fontWeight: 900,
          fontSize: 52,
          color: "#FFFF00",
          textAlign: "center",
          lineHeight: 1.1,
          letterSpacing: -0.5,
          textShadow: [
            "-3px -3px 0 #000",
            " 3px -3px 0 #000",
            "-3px  3px 0 #000",
            " 3px  3px 0 #000",
            " 0px  4px 0 #000",
          ].join(","),
          textTransform: "uppercase",
        }}
      >
        {text}
      </div>
    </div>
  );
};
