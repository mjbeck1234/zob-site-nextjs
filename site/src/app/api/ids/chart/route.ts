import { NextResponse } from "next/server";
import { resolveChartLink } from "@/lib/dtpp/resolveChartLink";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const airport = String(searchParams.get("airport") ?? "").trim();
    const proc = String(searchParams.get("proc") ?? "").trim();

    if (!airport || !proc) {
      return NextResponse.json(
        { ok: false, error: "Missing airport or proc" },
        { status: 400 }
      );
    }

    const out = await resolveChartLink({ airport, proc });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
