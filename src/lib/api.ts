import { NextResponse } from "next/server";
import { prepareDatabaseRead } from "@/db/client";
import { AuthenticationError } from "@/lib/auth";

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export class ApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ApiError";
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return fail(error.message, 401);
  }
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return fail(message, 500);
}

/** Route handlers share this so a thrown error never leaks a stack trace. */
export async function handle<T>(fn: () => T | Promise<T>) {
  try {
    return ok(await fn());
  } catch (error) {
    return errorResponse(error);
  }
}

function isTransientDatabaseError(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) messages.push(current.message);
    else if (typeof current === "object") {
      const value = current as { message?: unknown; code?: unknown };
      if (typeof value.message === "string") messages.push(value.message);
      if (typeof value.code === "string") messages.push(value.code);
    }
    current =
      typeof current === "object" && current && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }

  return /CONNECT_TIMEOUT|CONNECTION_DESTROYED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket|connection terminated/i.test(
    messages.join(" "),
  );
}

// Safe database reads get one invisible retry with a fresh connection pool.
export async function runDatabaseRead<T>(fn: () => T | Promise<T>) {
  try {
    await prepareDatabaseRead();
    return await fn();
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      await prepareDatabaseRead(true);
      return await fn();
    }
    throw error;
  }
}

export async function handleRead<T>(fn: () => T | Promise<T>) {
  try {
    return ok(await runDatabaseRead(fn));
  } catch (error) {
    return errorResponse(error);
  }
}

export type Params<K extends string = "id"> = {
  params: Promise<Record<K, string>>;
};
