import "./index.css";
import { Composition, staticFile } from "remotion";
import { ClyptViralShort } from "./ClyptViralShort";
import type { SpeakerSegment, TrackingFrame } from "./ClyptViralShort";
import { CaptionTestComposition } from "./CaptionTestComposition";
import type { Caption } from "./Captions";


interface Payload {
  clip_start_ms: number;
  clip_end_ms: number;
  tracking_uris?: string[];
  active_speaker_timeline?: SpeakerSegment[];
  [key: string]: unknown;
}

let payloads: Payload[] = [];
try {
  const raw = require("./remotion_payloads_array.json");
  payloads = Array.isArray(raw) ? raw : [raw];
} catch {
  try {
    const single = require("./remotion_payload.json");
    payloads = [single];
  } catch {
    // no payload found — compositions will be empty
  }
}

let allTracking: Record<string, TrackingFrame[]> = {};
try {
  allTracking = require("../public/merged_tracking.json");
} catch {
  // not yet generated
}

interface TestCaptionsFile {
  clip_start_ms: number;
  clip_end_ms: number;
  captions: Caption[];
}

let testCaptionData: TestCaptionsFile | null = null;
try {
  testCaptionData = require("./test_captions.json");
} catch {
  // not yet generated — run scripts/test_caption_clip.py first
}

const FPS = 24;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {payloads.map((payload, i) => {
        const clipDurationMs = payload.clip_end_ms - payload.clip_start_ms;
        const durationInFrames = Math.ceil((clipDurationMs / 1000) * FPS);
        const clipId = payloads.length === 1
          ? "ClyptViralShort"
          : `ClyptViralShort-${i + 1}`;

        const tracking: TrackingFrame[] = allTracking[String(i)] || [];
        const speakerTimeline: SpeakerSegment[] =
          payload.active_speaker_timeline || [];
        const captions: Caption[] = (payload.captions as Caption[]) || [];
        const isPodcast: boolean = (payload.is_podcast as boolean) ?? false;
        const funnyCaption: string = (payload.funny_caption as string) || "";

        return (
          <Composition
            key={clipId}
            id={clipId}
            component={ClyptViralShort}
            durationInFrames={durationInFrames}
            fps={FPS}
            width={1080}
            height={1920}
            defaultProps={{
              clipStartMs: payload.clip_start_ms,
              clipEndMs: payload.clip_end_ms,
              videoSrc: staticFile("video.mp4"),
              tracking,
              speakerTimeline,
              captions,
              isPodcast,
              funnyCaption,
            }}
          />
        );
      })}

      {testCaptionData && (() => {
        const { clip_start_ms, clip_end_ms, captions } = testCaptionData;
        const durationInFrames = Math.ceil(
          ((clip_end_ms - clip_start_ms) / 1000) * FPS,
        );
        return (
          <Composition
            id="CaptionTest"
            component={CaptionTestComposition}
            durationInFrames={durationInFrames}
            fps={FPS}
            width={1080}
            height={1920}
            defaultProps={{
              clipStartMs: clip_start_ms,
              clipEndMs: clip_end_ms,
              captions,
              videoSrc: staticFile("video.mp4"),
            }}
          />
        );
      })()}
    </>
  );
};
