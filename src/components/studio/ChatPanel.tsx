"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Sparkles } from "lucide-react";
import { PromptComposer } from "@/components/studio/PromptComposer";
import type { StudioMessage } from "@/lib/idb";
import { cn } from "@/lib/cn";

type ChatPanelProps = {
  messages: StudioMessage[];
  streamingText: string;
  draft: string;
  disabled?: boolean;
  canGenerate?: boolean;
  generating?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onGenerate: () => void;
};

export function ChatPanel({
  messages,
  streamingText,
  draft,
  disabled,
  canGenerate,
  generating,
  textareaRef,
  onDraftChange,
  onSend,
  onGenerate,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <section className="flex h-[min(36rem,70dvh)] min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-cream/80 p-5 lg:h-full lg:max-h-none">
      <div className="mb-4 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Gemini Flash</p>
        <h2 className="font-display mt-1 text-3xl leading-none text-ink">Чат</h2>
      </div>

      <div ref={listRef} className="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {messages.length === 0 && !streamingText ? (
          <p className="rounded-3xl rounded-tl-md bg-parchment px-4 py-3 text-sm leading-6 text-ink-soft">
            Загрузите фото и опишите стиль — разберём комнату и соберём mood-render. Это не чертёж и не 3D-модель.
          </p>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <article key={message.id} className={cn("flex max-w-[92%] gap-2", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
              <div
                className={cn(
                  "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isUser ? "bg-ink text-cream" : "bg-blush text-copper",
                )}
              >
                {isUser ? "Вы" : <Sparkles className="h-3.5 w-3.5" />}
              </div>
              <p
                className={cn(
                  "overflow-hidden break-words rounded-3xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                  isUser ? "rounded-tr-md bg-ink text-cream" : "rounded-tl-md bg-parchment text-ink-soft",
                )}
              >
                {message.content}
              </p>
            </article>
          );
        })}

        {streamingText ? (
          <article className="mr-auto flex max-w-[92%] gap-2">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blush text-copper">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <p className="overflow-hidden break-words rounded-3xl rounded-tl-md bg-parchment px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-ink-soft">
              {streamingText}
              <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-copper align-middle" />
            </p>
          </article>
        ) : null}
      </div>

      <div className="mt-4 shrink-0">
        <PromptComposer
          value={draft}
          disabled={disabled}
          canGenerate={canGenerate}
          generating={generating}
          textareaRef={textareaRef}
          onChange={onDraftChange}
          onSend={onSend}
          onGenerate={onGenerate}
        />
      </div>
    </section>
  );
}
