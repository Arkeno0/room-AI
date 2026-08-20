import { hasGemini, hasHuggingFace, hasReplicate } from "@/lib/env";
import type { HealthResponse } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body: HealthResponse = {
    ok: true,
    pollinations: true,
    gemini: hasGemini(),
    huggingface: hasHuggingFace(),
    replicate: hasReplicate(),
  };
  return NextResponse.json(body);
}
