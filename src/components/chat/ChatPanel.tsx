"use client";

import { useEffect, useRef } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { GenerationStatus } from "@/components/chat/GenerationStatus";
import type { ChatMessage, GenerationJob } from "@/lib/types";

type ChatPanelProps = {
  messages: ChatMessage[];
  job: GenerationJob | null;
  isGenerating: boolean;
  onSend: (value: string) => void;
};

export function ChatPanel({ messages, job, isGenerating, onSend }: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, job]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-line bg-cream/80 p-5 shadow-[0_20px_50px_-32px_rgba(28,23,20,0.45)]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Диалог</p>
          <h2 className="font-display mt-1 text-3xl leading-none text-ink">Дизайнер</h2>
        </div>
        <p className="max-w-[12rem] text-right text-[11px] leading-4 text-muted">
          Советы, правки и статус генерации в одном окне
        </p>
      </div>

      <div className="chat-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {job ? <GenerationStatus job={job} /> : null}
        <div ref={endRef} />
      </div>

      <div className="mt-4">
        <ChatComposer disabled={isGenerating} onSend={onSend} />
      </div>
    </section>
  );
}
