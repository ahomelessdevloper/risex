import type { NextRequest } from "next/server";
import { getLeaderboard } from "@/lib/risex";
import { LEADER_CATEGORIES, LEADER_WINDOWS, type LeaderCategory, type LeaderWindow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const window = params.get("window") ?? "24h";
  const category = params.get("category") ?? "volume";
  if (!LEADER_WINDOWS.includes(window as LeaderWindow) || !LEADER_CATEGORIES.includes(category as LeaderCategory)) {
    return Response.json({ error: "Unknown window or category" }, { status: 400 });
  }
  try {
    return Response.json(await getLeaderboard(window as LeaderWindow, category as LeaderCategory));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "RISEx API unavailable" }, { status: 502 });
  }
}
