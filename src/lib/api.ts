import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Route handlers share this so a thrown error never leaks a stack trace. */
export async function handle<T>(fn: () => T | Promise<T>) {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail(error.message, 401);
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return fail(message, 500);
  }
}

export type Params<K extends string = "id"> = {
  params: Promise<Record<K, string>>;
};
