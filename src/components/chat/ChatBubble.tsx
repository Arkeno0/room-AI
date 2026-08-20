"use client";

import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/cn";

type ChatBubbleProps = {
  message: ChatMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "flex max-w-[92%] animate-[atelier-rise_0.35s_ease] gap-3",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto",
      )}
    >
      <div
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-ink text-cream" : "bg-blush text-copper",
        )}
      >
        {isUser ? <span className="text-[11px] font-semibold">Вы</span> : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      <div className={cn("space-y-2", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-3xl px-4 py-3 text-sm leading-6",
            isUser ? "rounded-tr-md bg-ink text-cream" : "rounded-tl-md bg-parchment text-ink-soft",
          )}
        >
          {message.content}
        </div>

        {message.attachments?.map((attachment) => (
          <div key={attachment.url} className="overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt={attachment.alt} className="max-h-52 w-full object-cover" />
          </div>
        ))}
      </div>
    </article>
  );
}
