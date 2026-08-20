"use client";

import { useCallback, useState } from "react";
import type { ApiErrorBody, ChatRequest, ChatSseEvent, ImagePromptSpec } from "@/lib/types";

export class ChatStreamError extends Error {
  readonly code: "rate_limit" | "upstream" | "invalid";
  readonly status: number;

  constructor(message: string, code: "rate_limit" | "upstream" | "invalid", status: number) {
    super(message);
    this.name = "ChatStreamError";
    this.code = code;
    this.status = status;
  }
}

export type ChatStreamHandlers = {
  onToken?: (text: string) => void;
  onPromptSpec?: (spec: ImagePromptSpec) => void;
};

function parseErrorBody(body: ApiErrorBody | null, status: number): ChatStreamError {
  const code = body?.code === "rate_limit" || body?.code === "invalid" ? body.code : "upstream";
  const message =
    body?.error ||
    (status === 429
      ? "Слишком много запросов. Подождите несколько минут и попробуйте снова."
      : "Не удалось получить ответ дизайнера.");
  return new ChatStreamError(message, code, status);
}

async function readJsonError(response: Response): Promise<never> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  throw parseErrorBody(body, response.status);
}

function dispatchEvent(event: ChatSseEvent, handlers: ChatStreamHandlers, acc: { text: string; spec: ImagePromptSpec | null }) {
  if (event.type === "token") {
    acc.text += event.text;
    handlers.onToken?.(event.text);
    return;
  }
  if (event.type === "prompt_spec") {
    acc.spec = event.spec;
    handlers.onPromptSpec?.(event.spec);
    return;
  }
  throw new ChatStreamError(
    event.message,
    event.code,
    event.code === "rate_limit" ? 429 : event.code === "invalid" ? 400 : 502,
  );
}

export async function streamStudioChat(
  request: ChatRequest,
  handlers: ChatStreamHandlers = {},
  signal?: AbortSignal,
): Promise<{ text: string; spec: ImagePromptSpec | null }> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ChatStreamError("Не удалось открыть чат с дизайнером.", "upstream", 502);
  }

  if (!response.ok) {
    await readJsonError(response);
  }
  if (!response.body) {
    throw new ChatStreamError("Сервер не вернул поток ответа.", "upstream", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const acc = { text: "", spec: null as ImagePromptSpec | null };

  const consume = (chunk: string) => {
    const line = chunk.split("\n").find((item) => item.startsWith("data:"));
    if (!line) return;
    const payload = JSON.parse(line.slice(5).trim()) as ChatSseEvent;
    dispatchEvent(payload, handlers, acc);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) consume(frame);
  }

  if (buffer.trim()) consume(buffer);

  return acc;
}

export function useChatStream() {
  const [streaming, setStreaming] = useState(false);

  const send = useCallback(async (request: ChatRequest, handlers?: ChatStreamHandlers, signal?: AbortSignal) => {
    setStreaming(true);
    try {
      return await streamStudioChat(request, handlers, signal);
    } finally {
      setStreaming(false);
    }
  }, []);

  return { send, streaming };
}
