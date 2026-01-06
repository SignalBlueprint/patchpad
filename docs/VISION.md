---
repo: patchpad
scan_date: 2026-01-06
status: draft
---

# PatchPad Vision Document

## Foundation Read

PatchPad is an AI-augmented markdown note editor that transforms raw thoughts into structured knowledge. The core loop: write or speak notes, let AI refine them (summarize, extract tasks, expand, translate), and connect them through wiki-style `[[links]]` that build an emergent knowledge graph. Today it's a local-first personal knowledge base; the architecture screams "second brain waiting to happen."

## Architecture Snapshot

**Stack**
- Frontend: React 18 + TypeScript + Vite
- Editor: CodeMirror 6 with custom markdown extensions
- Styling: TailwindCSS with glass-morphism effects
- Storage: Dexie (IndexedDB wrapper) - browser-local only

**Data Models**
- `Note`: id, title, content, tags[], highlights[], favorite, parentId (for merged notes), collapsed
- `Patch`: id, noteId, action, ops[], status (pending/applied/rejected)
- `Concept`: extracted entities with type (person/project/topic), mentions[], relationships[]
- `Folder`: basic organization, color-coded

**Patterns**
- Modular service architecture (ai.ts, brain.ts, audio.ts)
- Multi-provider AI abstraction (OpenAI, Anthropic, mock fallback)
- Operational transforms for patches (insert/delete/replace ops)
- Force-directed graph visualization (canvas-based)
- Live queries via Dexie hooks

**Gaps**
- No backend persistence (data loss on browser clear)
- No authentication or multi-device sync
- No CI/CD pipeline visible
- Limited test coverage (4 test files for utilities)
- No export/import functionality
- No real-time collaboration

## Latent Potential

**80% Built, Not Exposed**
- The `brain.ts` service extracts concepts and relationships, but insights are only surfaced in a dashboard. This could power automatic wiki-linking, concept auto-tagging, and cross-note recommendations.
- `RelatedNotes` component and `findRelatedNotes()` exist but aren't prominently featured. This is the foundation for a "connections sidebar."
- Highlight annotations (`Highlight` type with `note` field) are stored but the annotation UI is minimal. This could become a proper annotation layer.
- Parent-child note relationships (`parentId`, `collapsed`) enable hierarchies, but only used post-stitch. Could power outliner mode.

**Abstractions Ready for Expansion**
- The `PatchOp` system (insert/delete/replace with positions) could support real-time collaboration via CRDTs
- AI provider abstraction makes adding new providers (Gemini, local LLMs) trivial
- The `analyzeContent()` suggestion system could power proactive AI coaching

**Data Collected, Not Used**
- Highlight positions and colors are tracked but not visualized in aggregate (reading patterns)
- Concept co-occurrence in notes (relationship strength) is computed but not surfaced as "how your ideas connect"
- Note update timestamps enable activity heatmaps but aren't visualized

---

## Horizon 1: Quick Wins
*Buildable in days, using existing infrastructure*

### 1. "Link Suggestions" Toast
When you finish typing a sentence, a subtle toast appears: "Mention of 'Project Phoenix'—link to existing note?" One click inserts the wiki link. Under the hood, this is just the existing `findRelatedNotes()` running on idle, filtered to exact title/concept matches. The demo: type "discussed Project Phoenix with Sarah" and watch the app offer to connect both terms to their respective notes. Knowledge graph builds itself.

### 2. Daily Digest Dashboard
Every morning, open PatchPad to see: "Yesterday you wrote 3 notes (847 words). Tasks extracted: 5. Concepts mentioned: Project Phoenix (4x), Q1 Planning (2x). Suggested: Review your open tasks." The `generateDailyDigest()` function exists but isn't wired to anything. Add a welcome modal that runs it on first load of the day. The insight: your notes become a self-updating work journal.

### 3. Export Bundle
Right-click on a note (or multi-select several) → "Export as Markdown ZIP." Downloads a folder with .md files, internal links rewritten as relative paths, and a manifest.json. Uses existing `content` fields, adds a simple download handler. For users terrified of IndexedDB ephemerality, this is peace of mind. For power users, it's "I can version-control my second brain."

---

## Horizon 2: System Expansions
*Requires new infrastructure, buildable in weeks*

### 1. Canvas Mode
Click "Canvas" and your notes become sticky notes on an infinite 2D board. Drag them, group them, draw arrows between them (which become `[[links]]`). The knowledge graph visualization already renders force-directed layouts—extend it to support manual positioning and persistence. Demo: map out a book outline by dragging chapter notes into sequence, connecting themes with lines. Export as PNG or PDF for presentations. This transforms PatchPad from "note app" to "thinking canvas."

### 2. Sync & Collaboration Layer
Add a lightweight backend: Supabase or Firebase. Notes sync across devices. Real-time collaboration: see cursors, watch edits appear. The `PatchOp` system is already position-based—layer Yjs or Automerge for conflict-free merging. Share a note with a colleague via link; they see the same knowledge graph context. The mental model shift: from "my notes" to "our shared knowledge base." Start with personal sync, graduate to team spaces.

### 3. Voice-First Capture
Make the microphone a first-class citizen. Float a persistent "Quick Capture" button. Tap, speak for 30 seconds, release. Transcription → AI summarization → new note appears in inbox. Later: voice queries ("What did I write about Q1 planning?") answered via `askNotes()`. The use case: capture thoughts while walking, driving, cooking. Come back to structured notes without typing a word.

---

## Horizon 3: Blue Sky
*Reframes what PatchPad could become*

### 1. Knowledge Graph as Product
Your knowledge graph isn't just for navigation—it's a publishable artifact. One click exports an interactive web page: nodes are your concepts, edges show relationships, clicking a node reveals the note excerpt. Use case: a researcher publishes their literature review as an explorable graph. A consultant shares their framework as linked concepts. PatchPad becomes "the tool that turns notes into public knowledge." Revenue angle: hosted graph pages, custom domains, analytics on what visitors explore.

### 2. AI Research Partner
Move beyond one-shot AI actions. Enable a conversational mode: "I'm preparing for a meeting with Acme Corp. What do I know about them?" The AI searches your notes, synthesizes an answer, and offers to create a prep brief. Follow-up: "Add the Q1 deal terms as a reminder." The AI creates a task linked to the Acme note. Long-running AI context: it remembers your projects across sessions. PatchPad evolves from "AI-enhanced notes" to "AI colleague who's read everything you've written."

---

## Moonshot

**"Memory Palace as a Service"**

Imagine a spatial VR/AR environment where you literally walk through your knowledge. Each room is a project. Notes float as holographic cards you can grab, annotate, connect with light beams (wiki links). The knowledge graph becomes 3D architecture. Voice commands create notes mid-air. When you need to prepare for a presentation, you "walk" through the relevant rooms, and your spatial memory reinforces the content.

Start with a web-based 3D renderer (Three.js). A "Virtual Library" view where bookshelves represent folders, books represent notes, and opening a book shows the content. Navigation history becomes a visible path you can retrace. The insight: humans remember spaces better than lists. PatchPad could be the first note app designed for spatial cognition—a digital memory palace that makes your knowledge unforgettable.

---

## Next Move

**Most Promising Idea: Canvas Mode**

Canvas Mode has the highest leverage. It transforms the product from "note-taking tool" to "thinking tool"—a category with higher willingness to pay and stickier usage. The infrastructure is 60% there: force-directed graph rendering exists, note relationships exist, drag-and-drop exists in the sidebar. The missing piece is persistent 2D positioning and manual edge creation. It opens the door to: outlining, mind mapping, project planning, presentation prep. And it's visually impressive—demos sell themselves.

**First Experiment (< 1 day)**

Modify `KnowledgeGraph.tsx` to allow nodes to be "pinned" after dragging (disable force simulation for pinned nodes). Add a localStorage key storing `{noteId: {x, y, pinned}}`. Persist positions across reloads. If users start arranging their graph manually, Canvas Mode is validated. Metric: do people pin more than 3 nodes?

**One Question That Would Sharpen the Vision**

*Are users primarily struggling with capture (getting ideas down quickly), organization (finding/connecting notes), or synthesis (turning notes into outputs)?*

The answer redirects everything. If capture: double down on voice, quick capture, inbox. If organization: focus on graph, backlinks, folders, search. If synthesis: prioritize stitch, export, publishing, AI writing assistance. Right now PatchPad serves all three—which is both its strength (integrated workflow) and its risk (diluted identity). Talking to five active users would clarify the wedge.
