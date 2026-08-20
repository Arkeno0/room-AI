import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiErrorBody,
  ApiErrorCode,
  ChatJsonResponse,
  ChatRequest,
  ChatSseEvent,
  GenerateRequest,
  GenerateResponse,
  HealthResponse,
  ImagePromptSpec,
} from "@/lib/types";
import { buildPollinationsUrl, buildPollinationsVariants } from "@/lib/ai/pollinations";

export { buildPollinationsUrl, buildPollinationsVariants };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(message: string, code: ApiErrorCode, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

async function readApiError(response: Response): Promise<never> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    throw new ApiClientError(
      body.error || "Ошибка API",
      body.code || "upstream",
      response.status,
    );
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError("Ошибка API", "upstream", response.status);
  }
}

export async function fileToAnalyzePayload(
  file: File,
  extra: Omit<AnalyzeRequest, "imageBase64" | "mimeType"> = {},
): Promise<AnalyzeRequest> {
  const mimeType = file.type;
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    throw new ApiClientError("Нужен JPG, PNG или WEBP.", "invalid", 400);
  }

  const imageBase64 = await blobToBase64(file);
  return { imageBase64, mimeType, ...extra };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ApiClientError("Не удалось прочитать файл.", "invalid", 400));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    const response = await fetch("/api/health", { method: "GET", cache: "no-store", signal });
    if (!response.ok) await readApiError(response);
    return (await response.json()) as HealthResponse;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError("Не удалось проверить статус API.", "upstream", 502);
  }
}

export async function analyzeRoom(
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) await readApiError(response);
    return (await response.json()) as AnalyzeResponse;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Анализ отменён.", "upstream", 499);
    }
    throw new ApiClientError("Не удалось проанализировать комнату.", "upstream", 502);
  }
}

export type ChatStreamHandlers = {
  onToken?: (text: string) => void;
  onPromptSpec?: (spec: ImagePromptSpec) => void;
  onError?: (message: string, code: Extract<ChatSseEvent, { type: "error" }>["code"]) => void;
};

/** JSON: текст дизайнера + английский промпт для Flux. */
export async function sendChat(request: ChatRequest, signal?: AbortSignal): Promise<ChatJsonResponse> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) await readApiError(response);
    return (await response.json()) as ChatJsonResponse;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Чат отменён.", "upstream", 499);
    }
    throw new ApiClientError("Не удалось получить ответ дизайнера.", "upstream", 502);
  }
}

export async function streamChat(
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
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Чат отменён.", "upstream", 499);
    }
    throw new ApiClientError("Не удалось открыть чат.", "upstream", 502);
  }

  if (!response.ok) await readApiError(response);
  if (!response.body) {
    throw new ApiClientError("Сервер не вернул поток.", "upstream", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let spec: ImagePromptSpec | null = null;
  let streamError: ApiClientError | null = null;

  const handleEvent = (event: ChatSseEvent) => {
    if (event.type === "token") {
      text += event.text;
      handlers.onToken?.(event.text);
      return;
    }
    if (event.type === "prompt_spec") {
      spec = event.spec;
      handlers.onPromptSpec?.(event.spec);
      return;
    }
    handlers.onError?.(event.message, event.code);
    streamError = new ApiClientError(
      event.message,
      event.code === "rate_limit" || event.code === "invalid" ? event.code : "upstream",
      event.code === "rate_limit" ? 429 : event.code === "invalid" ? 400 : 502,
    );
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      try {
        handleEvent(JSON.parse(line.slice(5).trim()) as ChatSseEvent);
      } catch {
        /* skip malformed frame */
      }
    }
  }

  if (buffer.trim()) {
    const line = buffer.split("\n").find((item) => item.startsWith("data:"));
    if (line) {
      try {
        handleEvent(JSON.parse(line.slice(5).trim()) as ChatSseEvent);
      } catch {
        /* skip */
      }
    }
  }

  if (streamError) throw streamError;
  return { text, spec };
}

export async function generateImage(
  request: GenerateRequest,
  signal?: AbortSignal,
): Promise<GenerateResponse> {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) await readApiError(response);
    return (await response.json()) as GenerateResponse;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Генерация отменена.", "upstream", 499);
    }
    throw new ApiClientError("Не удалось сгенерировать концепт.", "upstream", 502);
  }
}

/**
 * Instant client path: Pollinations Flux URL, no API key.
 */
export function conceptRenderUrls(spec: ImagePromptSpec, variants = 2): string[] {
  return buildPollinationsVariants(spec, variants);
}
