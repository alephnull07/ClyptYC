import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Caption } from "./Captions";

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = "speaker_change" | "stat";

interface MotionEvent {
  type: EventType;
  startMs: number;
  durationMs: number;
  text: string;
  speaker?: string;
}

// ── Speaker colors ────────────────────────────────────────────────────────────

const SPEAKER_COLORS: Record<string, string> = {
  "1": "#3B82F6",
  "2": "#10B981",
  "3": "#F59E0B",
  "4": "#EF4444",
  "5": "#8B5CF6",
};

function speakerColor(tag: string): string {
  return SPEAKER_COLORS[tag] ?? "#6366F1";
}

// ── Event extraction ──────────────────────────────────────────────────────────

const STAT_RE = /\$?[\d,]+\.?\d*\s*(?:billion|million|thousand|percent|k\b|bn\b|%)?/gi;

function extractEvents(captions: Caption[], isPodcast: boolean): MotionEvent[] {
  const events: MotionEvent[] = [];
  let lastSpeaker: string | null = null;
  // Deduplicate stats so the same number doesn't fire twice in adjacent captions
  const seenStats = new Set<string>();

  for (const cap of captions) {
    const speaker = cap.speaker_tag;

    // Speaker badge — podcast only
    if (isPodcast && speaker && speaker !== "unknown" && speaker !== lastSpeaker) {
      events.push({
        type: "speaker_change",
        startMs: cap.start_time_ms,
        durationMs: 2200,
        text: speaker,
        speaker,
      });
      lastSpeaker = speaker;
    }

    // Stat callout — all videos
    const statMatches = cap.text.match(STAT_RE);
    if (statMatches) {
      const raw = statMatches[0].trim();
      // Only show if it contains an actual digit and hasn't been seen
      if (/\d/.test(raw) && !seenStats.has(raw)) {
        seenStats.add(raw);
        // Find the word with the number for tighter timestamp
        const anchor = cap.words.find((w) => /\d/.test(w.word));
        events.push({
          type: "stat",
          startMs: anchor ? anchor.start_time_ms : cap.start_time_ms,
          durationMs: 2800,
          text: raw,
        });
      }
    }
  }

  return events;
}

// ── Speaker badge ─────────────────────────────────────────────────────────────

const SpeakerBadge: React.FC<{
  event: MotionEvent;
  currentMs: number;
  fps: number;
}> = ({ event, currentMs, fps }) => {
  const elapsed = currentMs - event.startMs;
  const frameElapsed = Math.max(0, (elapsed / 1000) * fps);
  const exitStart = event.durationMs - 400;
  const color = speakerColor(event.speaker ?? "1");

  const entrance = spring({
    fps,
    frame: frameElapsed,
    config: { mass: 0.5, stiffness: 220, damping: 22 },
    durationInFrames: Math.round(fps * 0.4),
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);
  const opacity =
    elapsed > exitStart
      ? interpolate(elapsed, [exitStart, event.durationMs], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 260,
        left: 48,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      {/* Colored circle */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 900,
          color: "white",
          fontFamily: "Arial Black, Arial, sans-serif",
          flexShrink: 0,
          boxShadow: `0 0 0 3px rgba(255,255,255,0.25)`,
        }}
      >
        {event.speaker}
      </div>
      {/* Label pill */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.72)",
          borderRadius: 10,
          padding: "8px 20px",
          borderLeft: `4px solid ${color}`,
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "white",
            letterSpacing: 2,
            fontFamily: "Arial, sans-serif",
            textTransform: "uppercase",
          }}
        >
          Speaker {event.speaker}
        </div>
      </div>
    </div>
  );
};

// ── Stat callout ──────────────────────────────────────────────────────────────

const StatCallout: React.FC<{
  event: MotionEvent;
  currentMs: number;
  fps: number;
}> = ({ event, currentMs, fps }) => {
  const elapsed = currentMs - event.startMs;
  const frameElapsed = Math.max(0, (elapsed / 1000) * fps);
  const exitStart = event.durationMs - 500;

  const entrance = spring({
    fps,
    frame: frameElapsed,
    config: { mass: 0.55, stiffness: 260, damping: 20 },
    durationInFrames: Math.round(fps * 0.35),
  });

  const scaleVal = interpolate(entrance, [0, 1], [0.75, 1]);
  const opacity =
    elapsed > exitStart
      ? interpolate(elapsed, [exitStart, event.durationMs], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 160,
        right: 48,
        opacity,
        transform: `scale(${scaleVal})`,
        transformOrigin: "top right",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.82)",
          borderRadius: 18,
          padding: "22px 32px",
          borderTop: "4px solid #F59E0B",
          textAlign: "center",
          minWidth: 140,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: "#F59E0B",
            fontFamily: "Arial Black, Arial, sans-serif",
            lineHeight: 1,
            letterSpacing: -1,
          }}
        >
          {event.text}
        </div>
      </div>
    </div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────

export const MotionGraphics: React.FC<{
  captions: Caption[];
  clipStartMs: number;
  isPodcast: boolean;
}> = ({ captions, clipStartMs, isPodcast }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = clipStartMs + (frame / fps) * 1000;

  // extractEvents is pure — same output for same inputs every frame
  const events = extractEvents(captions, isPodcast);

  const activeEvents = events.filter(
    (e) => currentMs >= e.startMs && currentMs < e.startMs + e.durationMs,
  );

  return (
    <>
      {activeEvents.map((event, i) => {
        if (event.type === "speaker_change") {
          return (
            <SpeakerBadge
              key={`${event.startMs}-${i}`}
              event={event}
              currentMs={currentMs}
              fps={fps}
            />
          );
        }
        if (event.type === "stat") {
          return (
            <StatCallout
              key={`${event.startMs}-${i}`}
              event={event}
              currentMs={currentMs}
              fps={fps}
            />
          );
        }
        return null;
      })}
    </>
  );
};
