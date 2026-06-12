// HTTP trigger for the daily update routine (e.g. a Vercel cron job).
// GET /api/cron — syncs results, predicts upcoming matches, scores
// finished ones, and returns the summary as JSON.

import { NextResponse } from "next/server";
import { runDailyUpdate } from "@/lib/daily-update";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // predictions can take a while

export async function GET() {
  try {
    const summary = await runDailyUpdate();
    return NextResponse.json({
      ok: true,
      ...summary,
      message: `Synced ${summary.synced} matches. Made predictions for ${summary.predicted} matches. Scored ${summary.scored} matches.`,
    });
  } catch (err) {
    console.error("Cron run failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
