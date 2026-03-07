const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const path = require("path");

const ARRAY_PATH = path.resolve(__dirname, "../src/remotion_payloads_array.json");
const SINGLE_PATH = path.resolve(__dirname, "../src/remotion_payload.json");
const OUTPUT_PATH = path.resolve(__dirname, "../public/merged_tracking.json");

function parseTrackingFrames(trackingData) {
  const frames = [];
  const faceDetections = trackingData.face_detections || [];
  const personDetections = trackingData.person_detections || [];

  for (const detection of faceDetections) {
    const speakerTag = detection.speaker_tag || null;
    for (const tsObj of detection.timestamped_objects || []) {
      const bbox = tsObj.bounding_box || tsObj.normalized_bounding_box;
      frames.push({
        time_ms: tsObj.time_ms || tsObj.time_offset_ms,
        center_x: bbox ? (bbox.left + bbox.right) / 2 : 0.5,
        center_y: bbox ? (bbox.top + bbox.bottom) / 2 : 0.5,
        source: "face",
        speaker_tag: speakerTag,
      });
    }
  }

  for (const detection of personDetections) {
    for (const tsObj of detection.timestamped_objects || []) {
      const bbox = tsObj.bounding_box || tsObj.normalized_bounding_box;
      frames.push({
        time_ms: tsObj.time_ms || tsObj.time_offset_ms,
        center_x: bbox ? (bbox.left + bbox.right) / 2 : 0.5,
        center_y: bbox ? (bbox.top + bbox.bottom) / 2 : 0.5,
        source: "person",
        speaker_tag: null,
      });
    }
  }

  return frames;
}

async function downloadUri(storage, uri) {
  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    console.warn(`Skipping invalid GCS URI: ${uri}`);
    return [];
  }
  const [, bucketName, objectPath] = match;
  console.log(`Downloading: ${uri}`);
  const [contents] = await storage.bucket(bucketName).file(objectPath).download();
  return parseTrackingFrames(JSON.parse(contents.toString("utf-8")));
}

async function main() {
  let payloads;
  if (fs.existsSync(ARRAY_PATH)) {
    const raw = JSON.parse(fs.readFileSync(ARRAY_PATH, "utf-8"));
    payloads = Array.isArray(raw) ? raw : [raw];
    console.log(`Loaded array payload with ${payloads.length} clip(s)`);
  } else if (fs.existsSync(SINGLE_PATH)) {
    payloads = [JSON.parse(fs.readFileSync(SINGLE_PATH, "utf-8"))];
    console.log("Loaded single payload (legacy mode)");
  } else {
    console.log("No payload file found. Writing empty object.");
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({}, null, 2));
    return;
  }

  const storage = new Storage();
  const result = {};

  for (let i = 0; i < payloads.length; i++) {
    const trackingUris = payloads[i].tracking_uris || [];
    const clipFrames = [];

    for (const uri of trackingUris) {
      const frames = await downloadUri(storage, uri);
      clipFrames.push(...frames);
    }

    clipFrames.sort((a, b) => a.time_ms - b.time_ms);
    result[String(i)] = clipFrames;
    console.log(`Clip ${i + 1}: ${clipFrames.length} tracking frames`);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`Merged tracking for ${payloads.length} clip(s) → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
