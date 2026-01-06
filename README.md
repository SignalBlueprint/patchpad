# PatchPad

<!-- SB:APP
name: PatchPad
slug: patchpad
type: web
health: yellow
owner: Grif
last_verified: 2026-01-06
-->

AI-powered note-taking application with markdown editing, voice transcription, knowledge graph visualization, and smart note compilation.

<!-- SB:SECTION:STATUS -->
## Status

**Active Development** - Core features functional including note management, AI integrations (OpenAI/Anthropic), wiki-style linking, and voice recording. Main risk: no backend persistence (IndexedDB only, browser-local).
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

# Run tests with coverage
npm run test:coverage
```
<!-- SB:SECTION:HOW_TO_RUN:END -->

<!-- SB:SECTION:ENV -->
## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AI_PROVIDER` | No | AI provider: `openai`, `anthropic`, or `mock` (default: `mock`) |
| `VITE_OPENAI_API_KEY` | No | OpenAI API key (required if provider is `openai`) |
| `VITE_OPENAI_MODEL` | No | OpenAI model (default: `gpt-4o-mini`) |
| `VITE_ANTHROPIC_API_KEY` | No | Anthropic API key (required if provider is `anthropic`) |
| `VITE_ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-3-haiku-20240307`) |
| `VITE_ENABLE_AUTO_SUGGESTIONS` | No | Enable auto suggestions (default: `true`) |
| `VITE_IDLE_TIMEOUT_MS` | No | Idle detection timeout in ms (default: `3000`) |
<!-- SB:SECTION:ENV:END -->

<!-- SB:SECTION:ENTRY_POINTS -->
## Entry Points

| Entry | Path | Description |
|-------|------|-------------|
| Web App | `/` | Main single-page application |
| Main Component | `src/App.tsx` | Root React component |
| Database | `src/db/index.ts` | Dexie/IndexedDB setup |
| AI Service | `src/services/ai.ts` | AI provider abstraction |
<!-- SB:SECTION:ENTRY_POINTS:END -->

<!-- SB:SECTION:NEXT_UPGRADES -->
## Next Upgrades

1. Add cloud sync/backend persistence to prevent data loss on browser clear
2. Add `.env.example` file documenting required/optional environment variables
3. Add user authentication to enable multi-device note access
<!-- SB:SECTION:NEXT_UPGRADES:END -->

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- CodeMirror 6 (editor)
- Dexie (IndexedDB wrapper)
- Vitest (testing)

## Features

- Markdown note editor with syntax highlighting
- AI actions: summarize, expand, simplify, translate, extract tasks
- Wiki-style `[[note links]]` with autocomplete
- Voice recording with transcription
- Knowledge graph visualization
- Note tagging and favorites
- Multi-select and "stitch" notes together
- Command palette (Ctrl+K)
