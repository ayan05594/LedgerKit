import { NextResponse } from "next/server";
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
    if (current instanceof Error) messages.push(current.name, current.message);
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

  return /DatabaseReadTimeout|CONNECT_TIMEOUT|CONNECTION_DESTROYED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket|connection terminated/i.test(
    messages.join(" "),
  );
}

function readWithTimeout<T>(fn: () => T | Promise<T>) {
  let timeout: ReturnType<typeof setTimeout>;
  const operation = Promise.resolve().then(fn);
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new Error("Database read timed out");
      error.name = "DatabaseReadTimeout";
      reject(error);
    }, 5_500);
  });
  return Promise.race([operation, deadline]).finally(() => clearTimeout(timeout));
}

// Safe Data API reads get one invisible retry for a transient network failure.
export async function runDatabaseRead<T>(fn: () => T | Promise<T>) {
  try {
    return await readWithTimeout(fn);
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      return await readWithTimeout(fn);
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
