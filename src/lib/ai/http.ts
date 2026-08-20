import "server-only";

import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/types";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfter?: number;

  constructor(status: number, code: ApiErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function jsonError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof HttpError) {
    const headers: HeadersInit = {};
    if (error.retryAfter) {
      headers["Retry-After"] = String(error.retryAfter);
    }
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers },
    );
  }

  const message = error instanceof Error ? error.message : "Неизвестная ошибка сервера";

  console.error("[api]", message);
  return NextResponse.json(
    { error: "Сервис временно недоступен. Попробуйте ещё раз.", code: "upstream" },
    { status: 502 },
  );
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new HttpError(502, "upstream", "Превышено время ожидания внешнего API.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readRetryAfterMs(response: Response, fallbackMs: number): number {
  const header = response.headers.get("retry-after");
  if (!header) return fallbackMs;
  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber > 120 ? asNumber : asNumber * 1000;
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return fallbackMs;
}
