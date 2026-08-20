import type { DesignResult } from "@/lib/types";

export const DEMO_RESULTS: DesignResult[] = [
  {
    id: "demo-1",
    title: "Гостиная · сканди",
    prompt: "Скандинавский минимализм, светлый дуб, льняной текстиль",
    beforeUrl:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
    afterUrl:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=80",
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
  {
    id: "demo-2",
    title: "Спальня · джапанди",
    prompt: "Джапанди, низкая кровать, тёплый свет, натуральные ткани",
    beforeUrl:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
    afterUrl:
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1600&q=80",
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
];

export const GENERATION_STEPS = [
  { step: "analyzing", label: "Считываю геометрию комнаты", progress: 22 },
  { step: "materials", label: "Подбираю материалы и свет", progress: 58 },
  { step: "rendering", label: "Собираю фотореалистичный рендер", progress: 86 },
  { step: "done", label: "Концепция готова", progress: 100 },
] as const;

export function buildAssistantReply(prompt: string, length: string, width: string, height: string) {
  const size = [length, width, height].every(Boolean)
    ? `${length} × ${width} м, потолок ${height} м`
    : "по загруженному кадру";

  return `Просмотрела пространство (${size}). Для запроса «${prompt}» оставляю чистую геометрию, убираю визуальный шум и собираю палитру вокруг двух акцентов: основной материал пола/стен и тёплый направленный свет. Рендер — первая концепция, её можно уточнить в чате.`;
}

export function buildFollowUpReply(message: string) {
  return `Приняла правку: «${message}». Смещаю композицию и материалы, не ломая исходную планировку. Новый кадр появится в галерее через несколько секунд.`;
}
