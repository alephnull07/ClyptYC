import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { makeTransform, scale } from "@remotion/animation-utils";
import { Captions } from "./Captions";
import type { Caption } from "./Captions";

export interface TrackingFrame {
  time_ms: number;
  center_x: number;
  center_y: number;
  source: string;
  speaker_tag?: string | null;
}

export interface SpeakerSegment {
  start_ms: number;
  end_ms: number;
  speaker_tag: string;
}

export interface ClyptViralShortProps extends Record<string, unknown> {
  clipStartMs: number;
  clipEndMs: number;
  videoSrc: string;
  tracking: TrackingFrame[];
  speakerTimeline?: SpeakerSegment[];
  captions?: Caption[];
}

/** Find the active speaker_tag at a given timestamp. */
function getActiveSpeaker(
  timeline: SpeakerSegment[],
  timeMs: number,
): string | null {
  for (const seg of timeline) {
    if (timeMs >= seg.start_ms && timeMs < seg.end_ms) {
      return seg.speaker_tag;
    }
  }
  return null;
}

/**
 * Filter tracking frames to only those matching the active speaker.
 * Falls back to all frames if no speaker match or no timeline.
 */
function filterBySpeaker(
  tracking: TrackingFrame[],
  speakerTag: string | null,
): TrackingFrame[] {
  if (!speakerTag) return tracking;
  const filtered = tracking.filter(
    (f) => f.speaker_tag === speakerTag,
  );
  // Fall back to all frames if no matches for this speaker
  return filtered.length > 0 ? filtered : tracking;
}

/** Binary search for the closest tracking frame to a target timestamp. */
function findClosestTrack(
  tracking: TrackingFrame[],
  targetMs: number,
): { x: number; y: number } {
  if (tracking.length === 0) return { x: 0.5, y: 0.5 };

  let lo = 0;
  let hi = tracking.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tracking[mid].time_ms < targetMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (lo === 0) return { x: tracking[0].center_x, y: tracking[0].center_y };
  if (lo >= tracking.length) {
    const last = tracking[tracking.length - 1];
    return { x: last.center_x, y: last.center_y };
  }

  const prev = tracking[lo - 1];
  const next = tracking[lo];
  const closer =
    Math.abs(prev.time_ms - targetMs) <= Math.abs(next.time_ms - targetMs)
      ? prev
      : next;

  return { x: closer.center_x, y: closer.center_y };
}

// ── Spring-eased camera smoothing ──
// When the raw tracking position jumps significantly (speaker change),
// we animate from the old position to the new one over TRANSITION_FRAMES.
const JUMP_THRESHOLD = 0.1; // normalized distance that triggers a transition
const TRANSITION_FRAMES = 18; // ~0.6s at 30fps

function springEase(
  frame: number,
  transitionStartFrame: number,
  fps: number,
  from: number,
  to: number,
): number {
  const elapsed = frame - transitionStartFrame;
  if (elapsed >= TRANSITION_FRAMES) return to;

  const springProgress = spring({
    fps,
    frame: elapsed,
    config: { mass: 1, stiffness: 80, damping: 15 },
    durationInFrames: TRANSITION_FRAMES,
  });

  return interpolate(springProgress, [0, 1], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// Scale factor: 16:9 → 9:16 requires 1920/1080 ≈ 1.777x
const SCALE_FACTOR = 1920 / 1080;

// Clamp pan to prevent showing empty space beyond the video edges
const MAX_PAN_X = 28; // % — at 1.77x scale, ~28% keeps within source frame
const MAX_PAN_Y = 10; // % — vertical pan is more constrained

export const ClyptViralShort: React.FC<ClyptViralShortProps> = ({
  clipStartMs,
  clipEndMs,
  videoSrc,
  tracking,
  speakerTimeline = [],
  captions = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hasSpeakerData =
    speakerTimeline.length > 0 &&
    tracking.some((f) => f.speaker_tag != null);

  // ── Detect speaker transitions and apply spring easing ──
  // We compute the smoothed position by scanning forward from frame 0,
  // detecting jumps, and applying spring transitions. This is pure and
  // deterministic (same output for the same frame number).
  let smoothX = 0.5;
  let smoothY = 0.5;
  let prevTargetX = 0.5;
  let prevTargetY = 0.5;
  let transitionStartFrame = 0;
  let transitionFromX = 0.5;
  let transitionFromY = 0.5;
  let transitionToX = 0.5;
  let transitionToY = 0.5;

  for (let f = 0; f <= frame; f++) {
    const ms = clipStartMs + (f / fps) * 1000;

    // If speaker data is available, filter tracking to the active speaker
    let frameTracking = tracking;
    if (hasSpeakerData) {
      const activeSpeaker = getActiveSpeaker(speakerTimeline, ms);
      frameTracking = filterBySpeaker(tracking, activeSpeaker);
    }

    const target = findClosestTrack(frameTracking, ms);

    const jumpX = Math.abs(target.x - prevTargetX);
    const jumpY = Math.abs(target.y - prevTargetY);

    if (jumpX > JUMP_THRESHOLD || jumpY > JUMP_THRESHOLD) {
      transitionStartFrame = f;
      transitionFromX = smoothX;
      transitionFromY = smoothY;
      transitionToX = target.x;
      transitionToY = target.y;
    } else if (f > transitionStartFrame + TRANSITION_FRAMES) {
      transitionToX = target.x;
      transitionToY = target.y;
    }

    smoothX = springEase(f, transitionStartFrame, fps, transitionFromX, transitionToX);
    smoothY = springEase(f, transitionStartFrame, fps, transitionFromY, transitionToY);

    prevTargetX = target.x;
    prevTargetY = target.y;
  }

  const startFromFrame = Math.round((clipStartMs / 1000) * fps);
  const endAtFrame = Math.round((clipEndMs / 1000) * fps);

  // Convert normalized position (0-1) to percentage offset and clamp
  const panX = interpolate((0.5 - smoothX) * 100, [-MAX_PAN_X, MAX_PAN_X], [-MAX_PAN_X, MAX_PAN_X], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = interpolate((0.5 - smoothY) * 100, [-MAX_PAN_Y, MAX_PAN_Y], [-MAX_PAN_Y, MAX_PAN_Y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          transform: makeTransform([
            "translate(-50%, -50%)",
            scale(SCALE_FACTOR),
            `translate(${panX}%, ${panY}%)`,
          ]),
          transformOrigin: "center center",
        }}
      />
      {captions.length > 0 && (
        <Captions captions={captions} clipStartMs={clipStartMs} />
      )}
    </AbsoluteFill>
  );
};
