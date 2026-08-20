"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatStreamError, streamStudioChat } from "@/hooks/useChatStream";
import { compressRoomPhoto, ImageCompressError } from "@/hooks/useImageCompress";
import { generateImage } from "@/lib/ai/client";
import { capResults, clearAllSessions, createSession, loadActiveSession, saveSession, type StudioSession } from "@/lib/idb";
import {
  describeStyleFilters,
  excludedPresets,
  filtersFromPresets,
  includedPresets,
  primaryPreset,
  toggleStyleFilter,
} from "@/lib/style-presets";
import type {
  AnalyzeResponse,
  ApiErrorBody,
  ChatRequest,
  StyleFilterMode,
  StyleFilters,
  StylePreset,
} from "@/lib/types";

export type StudioStatus = "idle" | "compressing" | "analyzing" | "chatting" | "rendering";

const RATE_LIMIT_TEXT = "Слишком много запросов. Подождите несколько минут и попробуйте снова.";

function uid() {
  return crypto.randomUUID();
}

/** Keeps the derived single `stylePreset` in sync with the multi-select filters. */
function withStyleFilters(session: StudioSession, styleFilters: StyleFilters): StudioSession {
  return { ...session, styleFilters, stylePreset: primaryPreset(styleFilters) };
}

function toApiMessages(session: StudioSession): ChatRequest["messages"] {
  return session.messages
    .filter((item) => item.content.trim())
    .map((item) => ({ role: item.role, content: item.content }))
    .slice(-16);
}

async function readApiError(response: Response): Promise<never> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  const error = new ChatStreamError(
    body?.error || (response.status === 429 ? RATE_LIMIT_TEXT : "Ошибка сервера."),
    body?.code === "rate_limit" || body?.code === "invalid" ? body.code : "upstream",
    response.status,
  );
  throw error;
}

export function useStudioSession() {
  const [session, setSession] = useState<StudioSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<StudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const persistRef = useRef<StudioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActiveSession()
      .then((stored) => {
        if (cancelled) return;
        const next = stored ?? createSession();
        persistRef.current = next;
        setSession(next);
      })
      .catch(() => {
        if (cancelled) return;
        const next = createSession();
        persistRef.current = next;
        setSession(next);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((updater: (prev: StudioSession) => StudioSession) => {
    const base = persistRef.current ?? createSession();
    const next = updater(base);
    persistRef.current = next;
    setSession(next);
    void saveSession(next).catch(() => undefined);
    return next;
  }, []);

  const handleCaught = useCallback((caught: unknown) => {
    if (caught instanceof DOMException && caught.name === "AbortError") return;
    if (caught instanceof ChatStreamError && caught.code === "rate_limit") {
      setRateLimitMessage(caught.message || RATE_LIMIT_TEXT);
      setError(null);
      return;
    }
    const message =
      caught instanceof ImageCompressError || caught instanceof Error
        ? caught.message
        : "Не получилось выполнить действие.";
    setError(message);
  }, []);

  const updateDimensions = useCallback(
    (dimensions: StudioSession["dimensions"]) => {
      commit((prev) => ({ ...prev, dimensions }));
    },
    [commit],
  );

  const updateStyleQuery = useCallback(
    (styleQuery: string) => {
      commit((prev) => ({ ...prev, styleQuery }));
    },
    [commit],
  );

  const updateAnalysis = useCallback(
    (analysis: StudioSession["analysis"]) => {
      commit((prev) => ({ ...prev, analysis }));
    },
    [commit],
  );

  /** Local-only: filters are applied when the concept is generated, so no request per click. */
  const toggleStyle = useCallback(
    (preset: StylePreset, mode: StyleFilterMode) => {
      commit((prev) => withStyleFilters(prev, toggleStyleFilter(prev.styleFilters, preset, mode)));
    },
    [commit],
  );

  const resetStyleFilters = useCallback(() => {
    commit((prev) => withStyleFilters(prev, {}));
  }, [commit]);

  const applySuggestedStyles = useCallback(() => {
    commit((prev) => withStyleFilters(prev, filtersFromPresets(prev.analysis?.suggestedPresets)));
  }, [commit]);

  const analyzePhoto = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStatus("compressing");

      try {
        const compressed = await compressRoomPhoto(file);
        const prepared = commit((prev) => ({
          ...prev,
          thumbnail: compressed.dataUrl,
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          analysis: null,
        }));

        setStatus("analyzing");
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
            dimensions: prepared.dimensions,
            brief: prepared.styleQuery.trim() || undefined,
            stylePreset: prepared.stylePreset,
          }),
        });
        if (!response.ok) await readApiError(response);
        const body = (await response.json()) as AnalyzeResponse;
        commit((prev) => ({ ...prev, analysis: body.analysis }));
      } catch (caught) {
        handleCaught(caught);
      } finally {
        if (abortRef.current === controller) setStatus("idle");
      }
    },
    [commit, handleCaught],
  );

  const runChat = useCallback(
    async (content: string, options: { generate: boolean }) => {
      const current = persistRef.current;
      if (!current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStreamingText("");

      const userMessage = { id: uid(), role: "user" as const, content };
      const prepared = commit((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      setStatus(options.generate ? "rendering" : "chatting");

      const wanted = includedPresets(prepared.styleFilters);
      const unwanted = excludedPresets(prepared.styleFilters);

      const request: ChatRequest = {
        messages: toApiMessages(prepared),
        analysis: prepared.analysis,
        imageBase64: prepared.imageBase64,
        mimeType: prepared.mimeType,
        stylePreset: wanted[0],
        stylePresets: wanted,
        excludedPresets: unwanted,
        generate: options.generate,
        dimensions: prepared.dimensions,
      };

      const assistantId = uid();
      let assembled = "";

      try {
        const result = await streamStudioChat(
          request,
          {
            onToken: (text) => {
              assembled += text;
              setStreamingText(assembled);
            },
          },
          controller.signal,
        );

        const finalText = result.text.trim() || assembled.trim();
        if (finalText) {
          commit((prev) => ({
            ...prev,
            messages: [...prev.messages, { id: assistantId, role: "assistant", content: finalText }],
          }));
        }

        if (options.generate && result.spec) {
          if (!prepared.imageBase64) {
            throw new Error("Сначала загрузите фото комнаты — ControlNet Depth строится по исходному кадру.");
          }
          const generated = await generateImage(
            {
              spec: result.spec,
              provider: "replicate",
              imageBase64: prepared.imageBase64,
              mimeType: prepared.mimeType,
            },
            controller.signal,
          );
          const urls = generated.imageUrls?.filter(Boolean).length
            ? generated.imageUrls.filter(Boolean)
            : [generated.imageUrl];
          const createdAt = new Date().toISOString();
          const variants = urls.map((url, index) => ({
            id: uid(),
            url,
            seed: (result.spec?.seed ?? Math.floor(Math.random() * 1_000_000)) + index,
            spec: result.spec!,
            createdAt,
          }));
          commit((prev) => ({ ...prev, results: capResults([...prev.results, ...variants]) }));
        }
      } catch (caught) {
        handleCaught(caught);
      } finally {
        if (abortRef.current === controller) {
          setStreamingText("");
          setStatus("idle");
          requestAnimationFrame(() => composerRef.current?.focus());
        }
      }
    },
    [commit, handleCaught],
  );

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content) return;
      await runChat(content, { generate: false });
    },
    [runChat],
  );

  const generateConcept = useCallback(async () => {
    const current = persistRef.current;
    if (!current) return;
    if (!current.imageBase64) {
      setError("Сначала загрузите фото комнаты — ControlNet Depth строится по исходному кадру.");
      return;
    }
    const styleLine = describeStyleFilters(current.styleFilters);
    const content =
      [current.styleQuery.trim(), styleLine && `Стиль: ${styleLine}.`].filter(Boolean).join(" ") ||
      "Собери концепт-рендер этой комнаты.";
    await runChat(content, { generate: true });
  }, [runChat]);

  const retrySeed = useCallback(
    async (resultId: string) => {
      const current = persistRef.current;
      const item = current?.results.find((result) => result.id === resultId);
      if (!current || !item) return;
      if (!current.imageBase64) {
        setError("Сначала загрузите фото комнаты — ControlNet Depth строится по исходному кадру.");
        return;
      }
      setError(null);
      setStatus("rendering");
      try {
        const seed = item.seed + 11;
        const generated = await generateImage({
          spec: { ...item.spec, seed },
          provider: "replicate",
          imageBase64: current.imageBase64,
          mimeType: current.mimeType,
        });
        commit((prev) => ({
          ...prev,
          results: prev.results.map((result) =>
            result.id === resultId
              ? { ...result, seed, url: generated.imageUrl, createdAt: new Date().toISOString() }
              : result,
          ),
        }));
      } catch (caught) {
        handleCaught(caught);
      } finally {
        setStatus("idle");
      }
    },
    [commit, handleCaught],
  );

  const deleteResult = useCallback(
    (resultId: string) => {
      commit((prev) => ({
        ...prev,
        results: prev.results.filter((item) => item.id !== resultId),
      }));
    },
    [commit],
  );

  const resetSession = useCallback(() => {
    abortRef.current?.abort();
    const next = createSession();
    persistRef.current = next;
    setSession(next);
    setError(null);
    setStreamingText("");
    setStatus("idle");
    void saveSession(next);
  }, []);

  const clearHistory = useCallback(async () => {
    abortRef.current?.abort();
    await clearAllSessions();
    const next = createSession();
    persistRef.current = next;
    setSession(next);
    setError(null);
    setStreamingText("");
    setStatus("idle");
    void saveSession(next);
  }, []);

  const busy = status !== "idle";

  return {
    session,
    hydrated,
    status,
    busy,
    error,
    rateLimitMessage,
    streamingText,
    composerRef,
    setRateLimitMessage,
    updateDimensions,
    updateStyleQuery,
    updateAnalysis,
    toggleStyle,
    resetStyleFilters,
    applySuggestedStyles,
    analyzePhoto,
    sendMessage,
    generateConcept,
    retrySeed,
    deleteResult,
    resetSession,
    clearHistory,
  };
}
