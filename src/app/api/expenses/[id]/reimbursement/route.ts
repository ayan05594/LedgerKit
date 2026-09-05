import { recordReimbursement, writeOffReimbursement } from "@/server/mutations";
import { handle, type Params } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    action: "record" | "write_off";
    amountPaise?: number;
    note?: string;
  };
  return handle(async () => {
    if (body.action === "write_off") return { done: await writeOffReimbursement(id) };
    return { done: await recordReimbursement(id, body.amountPaise ?? 0, body.note) };
  });
}
