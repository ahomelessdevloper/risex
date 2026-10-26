import { getPointsInfo } from "@/lib/risex";

export async function GET() {
  try {
    return Response.json(await getPointsInfo());
  } catch (err) {
    console.error(err);
    return Response.json({ error: "RISEx API unavailable" }, { status: 502 });
  }
}
