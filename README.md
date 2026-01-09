# PatchPad

<!-- SB:APP
name: PatchPad
slug: patchpad
type: web
health: green
owner: Grif
last_verified: 2026-01-07
-->

A personal knowledge operating system that transforms scattered thoughts into interconnected intelligence. Capture ideas through voice or keyboard, let AI refine and connect them, then explore relationships through spatial canvases and knowledge graphs.

<!-- SB:SECTION:STATUS -->
## Status

```
[█████████░░░░░░░░░░░] 49% complete
```

**Current Focus:** Horizon 2 — System Expansions
**Last Updated:** 2026-01-09

| Section | Progress | Tasks |
|---------|----------|-------|
| Horizon 1 | `██████████` 100% | 36/36 |
| Horizon 2 | `███████░░░` 70% | 66/94 |
| Horizon 3 | `█░░░░░░░░░` 7% | 6/85 |
| Moonshot  | `████░░░░░░` 42% | 23/55 |

See [docs/PROGRESS.md](docs/PROGRESS.md) for full details.

**Production Ready** - Full-featured personal knowledge base with:
- Multi-device sync via Supabase (with offline support)
- Voice-first capture with transcription and dictation mode
- AI Research Partner with semantic search and citations
- Canvas mode for spatial thinking
- Knowledge graph visualization

Data persists in IndexedDB locally; optional cloud sync available.
<!-- SB:SECTION:STATUS:END -->

<!-- SB:SECTION:HOW_TO_RUN -->
## How to Run

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests once
npm run test:run

# Type check
npx tsc --noEmit
```
<!-- SB:SECTION:HOW_TO_RUN:END -->

<!-- SB:SECTION:ENV -->
## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AI_PROVIDER` | No | AI provider: `openai`, `anthropic`, or `mock` (default: `mock`) |
| `VITE_OPENAI_API_KEY` | No | OpenAI API key for AI features and embeddings |
| `VITE_OPENAI_MODEL` | No | OpenAI model (default: `gpt-4o-mini`) |
| `VITE_ANTHROPIC_API_KEY` | No | Anthropic API key (alternative to OpenAI) |
| `VITE_ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-3-haiku-20240307`) |
| `VITE_SUPABASE_URL` | No | Supabase project URL for cloud sync |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anonymous key for cloud sync |
| `VITE_ENABLE_AUTO_SUGGESTIONS` | No | Enable auto suggestions (default: `true`) |
| `VITE_IDLE_TIMEOUT_MS` | No | Idle detection timeout in ms (default: `3000`) |

API keys can also be configured at runtime via Settings dialogs.
<!-- SB:SECTION:ENV:END -->

<!-- SB:SECTION:ENTRY_POINTS -->
## Entry Points

| Entry | Path | Description |
|-------|------|-------------|
| Web App | `/` | Main single-page application |
| Main Component | `src/App.tsx` | Root React component with view routing |
| Database | `src/db/index.ts` | Dexie/IndexedDB schema (v7) |
| AI Service | `src/services/ai.ts` | AI provider abstraction |
| Research Partner | `src/services/researchPartner.ts` | Conversational AI with note context |
| Semantic Search | `src/services/semanticSearch.ts` | Embedding-based search |
| Sync Engine | `src/services/syncEngine.ts` | Cloud sync with conflict resolution |
<!-- SB:SECTION:ENTRY_POINTS:END -->

## Features

### Core Note-Taking
- Markdown editor with syntax highlighting (CodeMirror 6)
- Wiki-style `[[note links]]` with autocomplete and preview
- Note tagging, folders, and favorites
- Multi-select and "stitch" notes together
- Highlights with color coding and annotations
- Command palette (`Ctrl+K`) with 50+ commands

### AI-Powered Actions
- Summarize, expand, simplify, rewrite notes
- Extract tasks and action items
- Fix grammar and translate to multiple languages
- Generate outlines and explanations
- Custom AI prompts
- Works with OpenAI or Anthropic

### AI Research Partner
- Conversational AI that knows your notes
- Semantic search using vector embeddings
- Answers cite source notes with `[Note: Title]`
- Research briefs and meeting prep generation
- Proactive follow-up suggestions
- Long-term memory with AI Knowledge Dashboard

### Voice-First Capture
- Quick capture button (tap to record)
- Automatic transcription (OpenAI Whisper)
- AI-powered cleanup of transcriptions
- Voice queries in Ask Notes dialog
- Dictation mode with continuous recording
- Voice commands: search, create note, ask questions
- Audio playback for voice notes

### Canvas Mode
- Spatial sticky note arrangement
- Drag, resize, and group notes
- Connection lines for wiki-linked notes
- Auto-layout (grid and force-directed)
- PNG export for presentations
- Group collapse/expand with custom colors

### Knowledge Graph
- Force-directed visualization of note connections
- Pinnable nodes with position persistence
- Brain Dashboard with insights
- Concept extraction and relationship mapping
- Daily digest summaries

### Sync & Collaboration
- Offline-first with IndexedDB persistence
- Optional Supabase cloud sync
- Email/password and OAuth authentication
- Conflict resolution with diff view
- Real-time sync status indicator
- Works without account (local-only mode)

### Export
- Export notes as ZIP with markdown files
- Wiki links converted to relative paths
- Manifest.json with metadata
- Configurable export options

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | TailwindCSS |
| Editor | CodeMirror 6 |
| Database | Dexie (IndexedDB) |
| Cloud | Supabase |
| AI | OpenAI / Anthropic |
| Testing | Vitest + React Testing Library |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command palette |
| `Ctrl+N` | New note |
| `Ctrl+J` | AI Continue writing |
| `Ctrl+Shift+A` | Ask AI (custom prompt) |
| `Ctrl+Shift+N` | Ask Notes (search all notes) |
| `Ctrl+Shift+P` | Research Partner |
| `Ctrl+Shift+B` | Brain Dashboard |
| `Ctrl+Shift+R` | Voice recording |
| `Ctrl+Shift+D` | Dictation mode |
| `Ctrl+Shift+E` | Export notes |

## Project Structure

```
src/
├── components/          # React components
│   ├── Auth/           # Login, sync settings
│   ├── Canvas/         # Canvas mode components
│   └── ResearchPartner/ # AI chat interface
├── services/           # Business logic
│   ├── ai.ts           # AI provider abstraction
│   ├── brain.ts        # Knowledge extraction
│   ├── embeddings.ts   # Vector embeddings
│   ├── researchPartner.ts # Conversational AI
│   ├── semanticSearch.ts  # Hybrid search
│   ├── sync.ts         # Cloud sync
│   └── audio.ts        # Recording/transcription
├── hooks/              # Custom React hooks
├── db/                 # Database schema
├── types/              # TypeScript interfaces
└── utils/              # Helper functions
```

<!-- SB:SECTION:NEXT_UPGRADES -->
## Next Upgrades

1. **Real-time Collaboration** - Yjs CRDT integration for Google Docs-style co-editing
2. **Knowledge Graph Publishing** - Export interactive graphs as shareable web pages
3. **Template Intelligence** - AI-powered templates that auto-fill from existing knowledge

See `docs/VISION.md` for full roadmap and `docs/TASKS.md` for implementation details.
<!-- SB:SECTION:NEXT_UPGRADES:END -->

## Documentation

| Document | Description |
|----------|-------------|
| `docs/VISION.md` | Product vision and feature roadmap |
| `docs/TASKS.md` | Detailed task breakdown with file paths |
| `docs/stash.md` | Deferred features for future cycles |

## License

MIT
