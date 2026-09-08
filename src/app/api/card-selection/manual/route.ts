import { z } from "zod";
import { ApiError, handle } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { createManualCard } from "@/server/card-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  issuer: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  network: z.enum(["visa", "mastercard", "rupay", "amex", "diners", "other"]),
});

export async function POST(request: Request) {
  return handle(async () => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(
        "Enter the issuing bank, card name, and card network.",
        400,
      );
    }
    return createManualCard(await requireUserId(), parsed.data);
  });
}
