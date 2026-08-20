"use client";

import { Images, LayoutTemplate, MessageSquare } from "lucide-react";
import { BriefPanel } from "@/components/dashboard/BriefPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ResultsGallery } from "@/components/gallery/ResultsGallery";
import { Header } from "@/components/layout/Header";
import { useStudio } from "@/hooks/useStudio";
import { cn } from "@/lib/cn";
import type { StudioTab } from "@/lib/types";

const TABS: { id: StudioTab; label: string; icon: typeof LayoutTemplate }[] = [
  { id: "brief", label: "Бриф", icon: LayoutTemplate },
  { id: "chat", label: "Чат", icon: MessageSquare },
  { id: "gallery", label: "Галерея", icon: Images },
];

export function StudioShell() {
  const studio = useStudio();

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-5 px-4 py-5 pb-24 md:px-6 lg:h-screen lg:overflow-hidden lg:px-8 lg:pb-5">
      <Header onReset={studio.resetStudio} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(300px,380px)] lg:items-stretch">
        <div className={cn("h-[calc(100dvh-10.5rem)] lg:h-full lg:min-h-0 lg:block", studio.tab === "brief" ? "block" : "hidden lg:block")}>
          <BriefPanel
            brief={studio.brief}
            error={studio.error}
            isGenerating={studio.isGenerating}
            onPhoto={studio.setPhoto}
            onChange={studio.updateBrief}
            onSubmit={studio.submitBrief}
          />
        </div>

        <div className={cn("h-[calc(100dvh-10.5rem)] lg:h-full lg:min-h-0 lg:block", studio.tab === "chat" ? "block" : "hidden lg:block")}>
          <ChatPanel
            messages={studio.messages}
            job={studio.job}
            isGenerating={studio.isGenerating}
            onSend={studio.sendMessage}
          />
        </div>

        <div className={cn("h-[calc(100dvh-10.5rem)] lg:h-full lg:min-h-0 lg:block", studio.tab === "gallery" ? "block" : "hidden lg:block")}>
          <ResultsGallery
            results={studio.results}
            activeResult={studio.activeResult}
            onSelect={studio.setActiveResultId}
          />
        </div>
      </div>

      <nav className="sticky bottom-3 z-20 grid grid-cols-3 gap-1 rounded-full border border-line bg-cream/95 p-1 shadow-lg backdrop-blur lg:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = studio.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => studio.setTab(tab.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm transition",
                active ? "bg-ink text-cream" : "text-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
