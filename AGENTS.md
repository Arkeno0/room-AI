# Room Creator — Agent Routing

Zero-budget interior concept studio. Read `docs/ARCHITECTURE.md` before any code.

| Agent | Role | Spec | Owns |
|---|---|---|---|
| 1 | Architect / PM | this file + `docs/` | contracts, stack lock, scope |
| 2 | Frontend | `docs/TZ-AGENT-2-FRONTEND.md` | `app/page.tsx`, `app/studio/`, `components/`, `hooks/`, `lib/pollinations.ts` |
| 3 | Backend / AI | `docs/TZ-AGENT-3-BACKEND.md` | `app/api/`, `lib/ai/`, `lib/rate-limit.ts` |
| Both | Shared types | `docs/CONTRACTS.md` | `lib/types.ts` (single source of truth) |

## Hard rules

1. **$0 for Gemini/hosting.** Vercel Hobby, Gemini free tier. Image generation is Replicate ControlNet Depth (`REPLICATE_API_TOKEN` server-only).
2. **Concept ≠ CAD.** Every generate path must disclose: output is a mood/concept render, not a to-scale 3D drawing or construction document.
3. **Secrets stay on the server.** `GEMINI_API_KEY`, `HF_TOKEN`, and `REPLICATE_API_TOKEN` never leak to the client bundle.
4. **Geometry comes from ControlNet Depth**, not from left/right prompt text. `/api/generate` sends the source photo as `control_image`.
5. Do not implement auth, payments, Postgres, Redis, Three.js CAD, or dimensioned floor plans in v1.

## Order of work

1. Agent 2: scaffold Next.js + Tailwind + empty studio shell.
2. Agent 3: `lib/types.ts` + Gemini analyze/chat routes (stub generate).
3. Agent 2: wire upload/chat/gallery to those routes + Pollinations.
4. Agent 3: HF fallback + rate limit + prompt compiler hardening.
5. Joint: disclaimer QA, rate-limit UX, Vercel env + deploy.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
