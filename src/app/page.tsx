import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { getOverview } from "@/lib/risex";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardWithData />
    </Suspense>
  );
}

async function DashboardWithData() {
  const overview = await getOverview();
  return <Dashboard initial={overview} />;
}

function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="text-lg font-semibold tracking-tight text-ink">RiseLlama</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-line bg-surface" />
    </div>
  );
}
