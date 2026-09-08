import { getInstrumentDetail, getYearRewardTrend } from "@/server/queries";
import { ApiError, fail, handleRead, type Params } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const year = Number(
    new URL(request.url).searchParams.get("year") ?? new Date().getFullYear(),
  );
  return handleRead(async () => {
    const detail = await getInstrumentDetail(id);
    if (!detail) throw new ApiError("Card not found", 404);
    return { ...detail, trend: await getYearRewardTrend(id, year) };
  });
}

export async function PATCH() {
  return fail(
    "Official catalogue cards are read-only. Manage which cards you use in Settings.",
    403,
  );
}

export async function DELETE() {
  return fail(
    "Remove this card from your collection in Settings instead.",
    403,
  );
}
