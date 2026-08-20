import Link from "next/link";
import { CONCEPT_DISCLAIMER } from "@/lib/types";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-copper uppercase">Zero-budget studio</p>
      <h1 className="font-display mt-3 text-6xl leading-none text-ink md:text-7xl">Atelier</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
        Загрузите фото комнаты, обсудите стиль с Gemini Flash и получите концепт-рендер интерьера. Без аккаунта, без
        чертежей, без стройдокументации.
      </p>
      <Link
        href="/studio"
        className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-copper px-5 py-3 text-sm font-semibold text-white"
      >
        Открыть студию →
      </Link>
      <p className="mt-8 max-w-xl text-sm leading-6 text-muted">{CONCEPT_DISCLAIMER}</p>
      <p className="mt-3 text-xs leading-5 text-muted">
        Бесплатный концепт. Запросы к Gemini на free-tier могут использоваться Google для улучшения продуктов.
      </p>
    </main>
  );
}
