import { getOverview } from "@/lib/risex";

export async function GET() {
  try {
    return Response.json(await getOverview());
  } catch (err) {
    console.error(err);
    return Response.json({ error: "RISEx API unavailable" }, { status: 502 });
  }
}
