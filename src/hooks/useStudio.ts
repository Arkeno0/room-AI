"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { stylizePhoto, uid, wait } from "@/lib/media";
import {
  buildAssistantReply,
  buildFollowUpReply,
  DEMO_RESULTS,
  GENERATION_STEPS,
} from "@/lib/studio-copy";
import type {
  ChatMessage,
  DesignResult,
  GenerationJob,
  RoomBrief,
  StudioTab,
} from "@/lib/types";

const INITIAL_BRIEF: RoomBrief = {
  length: "5.4",
  width: "3.8",
  height: "2.7",
  prompt: "",
  photoFile: null,
  photoUrl: null,
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Загрузите фото комнаты, укажите размеры и опишите стиль — соберу первую концепцию и покажу сравнение «до / после».",
  createdAt: new Date().toISOString(),
};

export function useStudio() {
  const [brief, setBrief] = useState<RoomBrief>(INITIAL_BRIEF);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [results, setResults] = useState<DesignResult[]>([...DEMO_RESULTS]);
  const [activeResultId, setActiveResultId] = useState<string>(DEMO_RESULTS[0].id);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [tab, setTab] = useState<StudioTab>("brief");
  const [error, setError] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);

  const isGenerating = Boolean(job && job.step !== "done");
  const activeResult = useMemo(
    () => results.find((item) => item.id === activeResultId) ?? results[0],
    [activeResultId, results],
  );

  const setPhoto = useCallback((file: File | null) => {
    setError(null);

    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }

    if (!file) {
      setBrief((prev) => ({ ...prev, photoFile: null, photoUrl: null }));
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Нужен JPG, PNG или WEBP.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setError("Файл слишком большой — до 12 МБ.");
      return;
    }

    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setBrief((prev) => ({ ...prev, photoFile: file, photoUrl: url }));
  }, []);

  const updateBrief = useCallback((patch: Partial<RoomBrief>) => {
    setBrief((prev) => ({ ...prev, ...patch }));
  }, []);

  const runGeneration = useCallback(
    async (userText: string, sourceUrl: string) => {
      const jobId = uid("job");
      setJob({
        id: jobId,
        step: "analyzing",
        progress: 8,
        label: GENERATION_STEPS[0].label,
      });

      for (const step of GENERATION_STEPS) {
        if (step.step === "done") continue;
        setJob({
          id: jobId,
          step: step.step,
          progress: step.progress,
          label: step.label,
        });
        await wait(step.step === "rendering" ? 1100 : 700);
      }

      const afterUrl = await stylizePhoto(sourceUrl).catch(() => sourceUrl);
      const result: DesignResult = {
        id: uid("result"),
        title: userText.slice(0, 42) || "Новая концепция",
        prompt: userText,
        beforeUrl: sourceUrl,
        afterUrl,
        createdAt: new Date().toISOString(),
      };

      setResults((prev) => [result, ...prev]);
      setActiveResultId(result.id);
      setJob({
        id: jobId,
        step: "done",
        progress: 100,
        label: GENERATION_STEPS[3].label,
      });

      return result;
    },
    [],
  );

  const submitBrief = useCallback(async () => {
    if (isGenerating) return;

    if (!brief.photoUrl) {
      setError("Сначала загрузите фото комнаты.");
      setTab("brief");
      return;
    }

    if (!brief.prompt.trim()) {
      setError("Опишите желаемый стиль.");
      setTab("brief");
      return;
    }

    setError(null);
    setTab("chat");

    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: `${brief.prompt.trim()}. Комната ${brief.length} × ${brief.width} × ${brief.height} м.`,
      createdAt: new Date().toISOString(),
      attachments: brief.photoUrl
        ? [{ type: "image", url: brief.photoUrl, alt: "Исходное фото комнаты" }]
        : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);

    const result = await runGeneration(brief.prompt.trim(), brief.photoUrl);

    setMessages((prev) => [
      ...prev,
      {
        id: uid("msg"),
        role: "assistant",
        content: buildAssistantReply(brief.prompt.trim(), brief.length, brief.width, brief.height),
        createdAt: new Date().toISOString(),
        attachments: [{ type: "image", url: result.afterUrl, alt: "Сгенерированный интерьер" }],
      },
    ]);

    setJob(null);
    setTab("gallery");
  }, [brief, isGenerating, runGeneration]);

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isGenerating) return;

      const sourceUrl = brief.photoUrl ?? activeResult?.beforeUrl;
      if (!sourceUrl) {
        setError("Нужно фото комнаты, чтобы продолжить генерацию.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);

      const result = await runGeneration(content, sourceUrl);

      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: "assistant",
          content: buildFollowUpReply(content),
          createdAt: new Date().toISOString(),
          attachments: [{ type: "image", url: result.afterUrl, alt: "Уточнённый рендер" }],
        },
      ]);

      setJob(null);
    },
    [activeResult?.beforeUrl, brief.photoUrl, isGenerating, runGeneration],
  );

  const resetStudio = useCallback(() => {
    setPhoto(null);
    setBrief(INITIAL_BRIEF);
    setMessages([WELCOME_MESSAGE]);
    setResults([...DEMO_RESULTS]);
    setActiveResultId(DEMO_RESULTS[0].id);
    setJob(null);
    setError(null);
    setTab("brief");
  }, [setPhoto]);

  return {
    brief,
    messages,
    results,
    activeResult,
    job,
    tab,
    error,
    isGenerating,
    setTab,
    setPhoto,
    updateBrief,
    submitBrief,
    sendMessage,
    setActiveResultId,
    resetStudio,
  };
}
