# Recall — Study, Notes & Flashcards

A mobile-first study application that bridges the gap between reading and remembering by combining note-taking, AI-powered summarization, flashcard creation, and spaced-repetition review into a single unified workflow.

**Live Preview:** [https://recall.space-z.ai](https://recall.space-z.ai)

---

## What is Recall?

Recall is built on the **FSRS-4.5 scheduling algorithm**, an open-source spaced-repetition system that benchmarks better than the classic SM-2 algorithm used by Anki. It uses Server-Sent Events (SSE) to stream AI-generated summaries directly into the user's notes in real time, and provides a complete knowledge-management system with bidirectional linking, a force-directed knowledge graph, and an incremental reading system.

The app is designed for readers and knowledge seekers who want to capture what they learn, connect it to what they already know, and review it on a scientifically-optimized schedule so it stays in long-term memory.

---

## Key Features

### Core (Phase 1 — MVP)
- **Email/password authentication** with JWT access tokens + httpOnly refresh cookies
- **Note capture** with full markdown editor (toolbar, split/preview modes, image paste, code blocks, tables)
- **AI summarization** via SSE streaming — summaries appear token-by-token
- **Manual flashcard creation** with basic and cloze deletion card types
- **FSRS-4.5 spaced-repetition engine** — 19-weight scheduler with stability, difficulty, and retrievability parameters
- **Tagging system** with colored tags and filtering
- **Global search** across notes and flashcards
- **Markdown/JSON export** and import
- **3D marketing landing page** with custom WebGL shader background and GSAP scroll animations
- **Dark/light theme** with WCAG 2.2 AA accessibility target
- **Mobile-first responsive design** with bottom navigation

### Depth (Phase 2)
- **AI-generated flashcards** from note content (review suggestions before bulk-creating)
- **TF-IDF semantic search** + "related notes" widget using cosine similarity
- **Anki (.apkg) export** — valid SQLite-based Anki package with proper schema
- **Analytics dashboard** — retention rate, streak, grade distribution, deck maturity, daily reviews chart
- **Due-card reminders** — in-app banner with configurable time + email toggle
- **Cloze deletion cards** — `{{c1::text}}` syntax with fill-in-the-blank review rendering
- **GitHub-style review heatmap** — 365-day grid on analytics + 30-day strip on home
- **Review forecasting** — 14-day due-count bar chart, next heavy day, estimated days to clear backlog
- **Quick-capture** — floating action button for instant note creation

### Real-time Collaboration (Phase 3)
- **WebSocket presence** — see who else is viewing a note (avatar bubbles in editor header)
- **Live cursors** — collaborator cursor positions displayed in real time
- **Comments** — threaded comments with resolve/delete, real-time sync
- **Shared notebooks** — invite by email with editor/viewer roles
- **4-step onboarding** — study goal, experience level, interests, daily time commitment
- **Production build optimization** — standalone server using ~3MB RSS

### Tier 1 — Killer Features
- **Inline flashcard creation** — type `Term :: Definition` in any note, cards auto-create on save
- **Bidirectional linking** — `[[Note Title]]` creates links + auto-generates stub notes + backlinks widget
- **Knowledge graph** — force-directed visualization of all notes and their connections (canvas-based)
- **Command palette** — Cmd/Ctrl+K for fuzzy search across notes, navigation, and actions

### Tier 2 — Retention Features
- **Cloze deletions** — Cmd+Shift+C wraps selected text in `{{c1::...}}`
- **Review heatmap** — 5-tier green intensity scale, compact 30-day strip on home
- **Review forecasting** — "At your current pace, you'll clear the backlog in N days"
- **Quick-capture** — Cmd+Shift+N or floating button for frictionless note capture

### Tier 3 — Polish
- **Keyboard shortcuts** — J/K navigation, G+H/N/D/S/A vim-style chords, Cmd+N, Cmd+/, Cmd+Shift+S
- **Templates** — 5 built-in: Blank, Lecture, Book summary, Vocabulary, Meeting notes
- **Review context** — "View source note" link + last 5 review grades with interval changes
- **Custom study** — Cram (all cards), Review ahead, Practice weak (3+ lapses)
- **Service worker PWA** — app shell caching, offline navigation fallback, installable

### Advanced AI
- **Auto-tagging** — LLM analyzes note content and suggests up to 5 tags
- **Knowledge gap detection** — identifies cards with 2+ lapses, suggests revisiting source note
- **Practice question generation** — scenario-based application questions from deck content
- **Scheduling explainer** — "Why is this due?" with FSRS parameters (stability, difficulty, recall probability)
- **Connection suggestions** — LLM finds conceptual relationships between notes

### Incremental Reading
- **Article import** — paste long text, AI splits into readable sections
- **Section-by-section reader** — one section at a time with prev/next navigation and progress tracking
- **Text highlighting** — select text → "Cloze" or "Q&A" button → auto-creates flashcard
- **Highlight cards** — appear in review queue alongside regular flashcards
- **Gradual extraction** — articles are progressively converted into your knowledge base

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite |
| State | Zustand (client) + TanStack Query (server) |
| Auth | JWT (jose) + bcryptjs + httpOnly cookies |
| AI | z-ai-web-dev-sdk (GLM-4-Flash) |
| Real-time | Socket.io (WebSocket mini-service) |
| 3D/Animation | Custom WebGL2 shader + GSAP |
| Charts | Recharts |
| Drag & Drop | @dnd-kit/sortable |
| PWA | Service Worker + Web Manifest |

---

## Use Cases

### Exam Preparation
Students capture lecture notes, generate AI summaries to identify key points, turn those summaries into flashcards (manually or via AI generation), and review on an FSRS-optimized schedule leading up to the exam. The cram mode allows last-minute review of all cards regardless of schedule.

### Language Learning
Vocabulary cards with cloze deletions reinforce recall in context. The inline `Term :: Definition` syntax lets learners create cards as fast as they can type. The quick-capture button captures new words the moment they encounter them.

### Professional Development
Practitioners document new concepts from articles and papers using the incremental reading system. The AI auto-tags content, suggests connections to existing knowledge, and the knowledge graph reveals how different concepts relate to each other.

### Research
Scholars paste research papers into the article reader, highlight key findings that automatically become flashcards, and use bidirectional links to connect related concepts across papers. The TF-IDF semantic search finds notes by meaning, not just keywords.

### Meeting Notes
Use the Meeting template to capture attendees, agenda, decisions, and action items. Inline flashcards turn key decisions into reviewable facts. Shared notebooks allow team members to collaborate on meeting notes in real time.

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- A `.z-ai-config` file for the z-ai-web-dev-sdk (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/abdullahrahmani347/Recall.git
cd Recall

# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the development server
bun run dev
```

### Production Build

```bash
bun run build
bun run start
```

### Environment Variables

Create a `.env` file:

```
DATABASE_URL=file:./db/custom.db
JWT_SECRET=your-secret-key-at-least-32-characters
```

For AI features, create a `.z-ai-config` file:

```json
{
  "baseUrl": "https://api.z.ai/api/paas/v4",
  "apiKey": "your-api-key"
}
```

---

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes (auth, notes, decks, AI, articles, etc.)
│   ├── globals.css          # Design tokens, animations, utilities
│   ├── layout.tsx           # Root layout with providers
│   └── page.tsx             # Main app router (landing → auth → app shell)
├── components/
│   ├── app/                 # App views (home, notes, editor, review, analytics, etc.)
│   ├── auth/                # Login/register screen
│   ├── icons/               # Custom animated SVG icons
│   ├── landing/             # Landing page (hero, nav, demo panel, background)
│   ├── providers/           # Theme, Query, ServiceWorker providers
│   └── ui/                  # shadcn/ui components
├── hooks/                   # useAuth, useCollab, useKeyboardShortcuts
├── lib/                     # fsrs, tfidf, apkg, inline-parser, auth, db
├── stores/                  # Zustand app store
mini-services/
└── collab-service/          # WebSocket collaboration service (port 3003)
public/
├── icons/                   # 50+ individual SVG icons
├── logo.svg                 # Brand logo
├── favicon.svg              # Favicon
├── sw.js                    # Service worker
└── manifest.webmanifest     # PWA manifest
```

---

## Design System

Recall uses an original design token system (not derived from any external reference):

- **Canvas:** `#0F1115` (dark graphite)
- **Accent Brand:** `#34E7A8` (signal green)
- **Accent Warm:** `#FFB454` (amber, for streaks/due indicators)
- **Grading Scale:** Red `#F0554B` / Amber `#F5A623` / Green `#34E7A8` / Blue `#4C8CFF`
- **Typography:** Inter (body), Space Grotesk (display), JetBrains Mono (code)
- **Radius:** 8px → 12px → 16px → 24px → 32px
- **Shadows:** 6-tier elevation system + brand glow

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+N` | New note (template picker) |
| `Cmd/Ctrl+Shift+N` | Quick capture |
| `Cmd/Ctrl+Shift+S` | Summarize current note |
| `Cmd/Ctrl+Shift+C` | Cloze deletion (in editor) |
| `Cmd/Ctrl+/` | Show keyboard shortcuts help |
| `G` then `H/N/D/S/A` | Go to Home/Notes/Decks/Search/Analytics |
| `J` / `K` | Navigate note list |
| `Enter` | Open note |
| `D` | Delete note |
| `Space` | Reveal answer (in review) |
| `1-4` | Grade: Again/Hard/Good/Easy |

---

## License

This project is proprietary. All rights reserved.

---

## Acknowledgments

- **FSRS** (Free Spaced Repetition Scheduler) — MIT-licensed, open-source scheduling algorithm
- **GSAP** — Animation library (free for commercial use as of April 2025)
- **Inter & Space Grotesk** — SIL Open Font License
- **shadcn/ui** — Component library
- **z-ai-web-dev-sdk** — AI integration (GLM-4-Flash model)
