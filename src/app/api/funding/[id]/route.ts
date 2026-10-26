import type { NextRequest } from "next/server";
import { getFundingHistory } from "@/lib/risex";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/funding/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid market id" }, { status: 400 });
  }
  try {
    return Response.json(await getFundingHistory(id));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "RISEx API unavailable" }, { status: 502 });
  }
}
