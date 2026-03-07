import { useCurrentFrame, useVideoConfig } from "remotion";

export interface CaptionWord {
  word: string;
  start_time_ms: number;
  end_time_ms: number;
}

export interface Caption {
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  speaker_tag: string;
  words: CaptionWord[];
}

interface CaptionsProps {
  captions: Caption[];
  /** Absolute ms in the source video that corresponds to frame 0. */
  clipStartMs: number;
}

export const Captions: React.FC<CaptionsProps> = ({ captions, clipStartMs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Current absolute time in ms, matching the original audio timestamps
  const currentMs = clipStartMs + (frame / fps) * 1000;

  const activeCaption = captions.find(
    (cap) => currentMs >= cap.start_time_ms && currentMs < cap.end_time_ms,
  );

  if (!activeCaption) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 48px",
        flexWrap: "wrap",
        gap: "0 10px",
        pointerEvents: "none",
      }}
    >
      {activeCaption.words.map((w, i) => {
        const isPast = currentMs >= w.end_time_ms;
        const isCurrent =
          currentMs >= w.start_time_ms && currentMs < w.end_time_ms;

        let color: string;
        let scale: string;
        if (isCurrent) {
          color = "#ffffff";
          scale = "scale(1.06)";
        } else if (isPast) {
          color = "rgba(255,255,255,0.75)";
          scale = "scale(1)";
        } else {
          color = "rgba(255,255,255,0.4)";
          scale = "scale(1)";
        }

        return (
          <span
            key={i}
            style={{
              fontSize: 54,
              fontWeight: 800,
              fontFamily: "'Inter', 'Arial Black', Arial, sans-serif",
              color,
              textShadow:
                "0 2px 12px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,1)",
              lineHeight: 1.25,
              letterSpacing: "-0.5px",
              display: "inline-block",
              transform: scale,
              transformOrigin: "bottom center",
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
