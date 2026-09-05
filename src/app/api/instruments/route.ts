import { getReference } from "@/server/queries";
import { createInstrument } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { instruments, rules } = await getReference();
    return instruments.map((instrument) => ({
      instrument,
      rules: rules.filter((r) => r.instrumentId === instrument.id),
    }));
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return handle(async () => ({ id: await createInstrument(body) }));
}
