import { getInstrumentDetail, getYearRewardTrend } from "@/server/queries";
import { deleteInstrument, updateInstrument } from "@/server/mutations";
import { ApiError, handle, handleRead, type Params } from "@/lib/api";

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

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  return handle(async () => ({ updated: await updateInstrument(id, body) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteInstrument(id) }));
}
