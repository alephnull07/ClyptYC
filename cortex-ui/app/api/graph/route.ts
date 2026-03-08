import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const outputsDir = join(process.cwd(), "..", "outputs");

  const nodes = JSON.parse(
    readFileSync(join(outputsDir, "phase_1b_nodes.json"), "utf-8")
  );
  const edges = JSON.parse(
    readFileSync(join(outputsDir, "phase_1c_narrative_edges.json"), "utf-8")
  );

  let payloads = [];
  try {
    payloads = JSON.parse(
      readFileSync(join(outputsDir, "remotion_payloads_array.json"), "utf-8")
    );
  } catch {
    // payloads file may not exist yet
  }

  return NextResponse.json({ nodes, edges, payloads });
}

export async function POST(req: Request) {
  const { nodes, edges } = await req.json();
  const outputsDir = join(process.cwd(), "..", "outputs");
  const { writeFileSync } = await import("fs");

  writeFileSync(
    join(outputsDir, "phase_1b_nodes.json"),
    JSON.stringify(nodes, null, 2)
  );
  writeFileSync(
    join(outputsDir, "phase_1c_narrative_edges.json"),
    JSON.stringify(edges, null, 2)
  );

  return NextResponse.json({ ok: true });
}
