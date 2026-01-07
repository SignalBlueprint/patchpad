---
repo: patchpad
scan_date: 2026-01-07
status: draft
---

# PatchPad Vision Document

## Foundation Read

PatchPad is a personal knowledge operating system that turns scattered thoughts into interconnected intelligence. The core loop: capture ideas through voice or keyboard, let AI refine and connect them, then explore relationships through spatial canvases and knowledge graphs. What started as a markdown editor has evolved into a genuine "second brain" - complete with conversational AI that knows your notes, multi-device sync, and semantic search that finds meaning, not just keywords.

## Architecture Snapshot

**Stack**
- Frontend: React 18 + TypeScript + Vite 6
- Editor: CodeMirror 6 with wiki-link autocomplete, syntax highlighting
- Styling: TailwindCSS with glass-morphism aesthetic
- Storage: Dexie (IndexedDB) - offline-first, browser-local
- Cloud: Supabase (optional) - auth, sync, real-time

**Data Models**
- `Note`: id, title, content, tags[], highlights[], favorite, parentId, canvasPosition, audioId
- `Patch`: AI-generated text operations (insert/delete/replace) with status tracking
- `Embedding`: Vector embeddings (1536 dimensions) cached by content hash
- `Conversation`: AI Research Partner chat history with messages and timestamps
- `Folder`: Color-coded organization containers

**Patterns**
- Multi-provider AI abstraction (OpenAI, Anthropic, mock fallback)
- Semantic search via embeddings + hybrid keyword/vector scoring
- Offline-first with sync queue replay on reconnect
- Service layer separation (ai.ts, brain.ts, embeddings.ts, sync.ts, audio.ts)
- Live queries via Dexie hooks for reactive UI

**Gaps**
- Real-time collaboration (Yjs CRDTs) - designed but not implemented
- Published knowledge graphs (static export ready, hosting not)
- Limited test coverage (utilities well-tested, components less so)
- No CI/CD pipeline
- Mobile experience could be improved

## Latent Potential

**80% Built, Not Exposed**
- **Embeddings are cached but underutilized.** Every note has a vector embedding, but semantic search only powers the Research Partner. These could enable: "notes drifting apart" alerts, automatic clustering, similarity-based recommendations everywhere.
- **Canvas positions exist but aren't spatial intelligence.** Notes have x/y coordinates - this data could reveal thinking patterns: which ideas cluster together, which are isolated, how your knowledge landscape evolves over time.
- **Conversation history is stored but not mined.** The AI Research Partner saves every exchange. This is a goldmine for: "what questions do you ask most?", personal FAQ generation, identifying knowledge gaps.
- **Audio recordings can be replayed but aren't searchable.** Original voice notes are stored - transcriptions are indexed, but audio fingerprinting could enable "find when I said X."

**Abstractions Ready for Expansion**
- The `PatchOp` system (insert/delete/replace with positions) is CRDT-ready - Yjs integration would enable Google Docs-style collaboration
- AI provider abstraction makes adding Gemini, Claude 3.5, or local LLMs trivial
- The sync engine's conflict resolution UI could handle any merge scenario

**Data Collected, Not Used**
- Highlight positions and colors track reading patterns but aren't visualized as heatmaps
- Note update frequencies could power "this idea is evolving" or "this is stale" indicators
- Tag co-occurrence is computed but not surfaced as "these topics connect"

---

## Horizon 1: Quick Wins
*Buildable in days, using existing infrastructure*

### 1. "Second Brain Dashboard"

Open PatchPad and instead of a blank slate, you see your knowledge at a glance. Top center: a personalized greeting with your most-touched notes from the last week. Left column: "Brewing Ideas" - notes you've edited but haven't linked anywhere yet, suggestions to connect them. Right column: "Fading Memories" - notes not touched in 90 days that mention concepts you've written about recently. The demo: log in after a week away and immediately see "You were thinking about Project Atlas last month - here's what you wrote, and 3 new notes that might relate." Your second brain becomes self-organizing.

### 2. "Thinking Timeline"

A new view: Notes → Canvas → Graph → **Timeline**. Your notes arranged chronologically, but not just by creation date - by "thinking sessions." The AI clusters notes created within the same hour, on the same topic, and presents them as connected thought chains. Scroll through your intellectual history like a journal. Click any cluster and see the canvas layout from that moment. The insight: you can revisit not just what you wrote, but how you were thinking when you wrote it.

### 3. "Conversation Insights"

Your AI Research Partner has been answering questions for weeks. Now see the patterns. A new panel in the Research Partner shows: "Your top questions this month," "Topics you ask about most," "Questions the AI couldn't fully answer" (knowledge gaps). Each insight links to the original conversation. The demo: realize you've asked about "Q2 planning" 15 times but have no dedicated note about it - one click creates a "Q2 Planning Brief" synthesized from all your questions.

---

## Horizon 2: System Expansions
*Requires new infrastructure, buildable in weeks*

### 1. Real-time Collaboration

You share a note link with a colleague. They click it and see your note - plus your cursor, live. They start typing and you see their words appear character by character, their selection highlighted in their assigned color. A presence indicator shows who's viewing. The `PatchOp` system transforms into a full CRDT layer via Yjs. Comments appear as floating annotations. Version history shows who wrote what. The mental model shift: from "my notes" to "our shared thinking." Start with 1:1 sharing, graduate to team knowledge bases.

### 2. Knowledge Graph Publishing

Your knowledge graph isn't just for navigation anymore - it's a publishable artifact. Click "Publish" in the Brain Dashboard and generate an interactive web page: your concepts as nodes, relationships as edges, click any node to see the note excerpt. Host it on `username.patchpad.pub` or download as a self-contained HTML file. Use case: a researcher publishes their literature review as an explorable graph. A consultant shares their framework. A student publishes study notes. Revenue angle: free tier for 50 nodes, premium for unlimited + custom domains + analytics.

### 3. Template Intelligence

You create meeting notes with the same structure every time. PatchPad notices. It suggests: "Create a Meeting Notes template?" Accept, and next time you type "Meeting with," it offers to scaffold the template. But templates aren't just static text - they're AI-powered. A "Research Summary" template prompts: "What topic?" then auto-fills with relevant excerpts from your notes, open questions extracted from conversations, and related concepts from your graph. Templates become personalized AI workflows.

---

## Horizon 3: Blue Sky
*Reframes what PatchPad could become*

### 1. Ambient Knowledge Capture

PatchPad becomes a background presence. A menu bar app (macOS/Windows) listens - not to conversations (privacy!) but to your clipboard, your browser tabs, your calendar. When you copy a URL, it suggests: "Save to notes?" When you have a meeting with "Acme Corp" in 15 minutes, a notification offers your Research Partner's prep brief. When you paste code, it offers to explain it. The line between "taking notes" and "living with your second brain" dissolves. Your knowledge graph grows organically without explicit capture sessions.

### 2. Knowledge Agents

The AI Research Partner evolves into multiple specialized agents. "Archivist" organizes and connects your notes overnight, suggesting merges and surfacing contradictions. "Researcher" proactively monitors topics you care about and creates briefings. "Writer" helps transform note clusters into blog posts, reports, or presentations. Each agent has its own personality, history, and permissions. You don't ask questions - you delegate knowledge work. PatchPad becomes less of a tool and more of a thinking team.

---

## Moonshot

**"Externalized Cognition"**

What if PatchPad wasn't just where you store thoughts, but where you think? Imagine a split-screen interface: on the left, a "thinking canvas" where ideas exist as moveable, connectable objects in 2D space. On the right, an AI partner that watches you think - when you drag two concepts together, it asks "Are you exploring how these relate? Here's what your notes suggest..." When you've been staring at the same area for 30 seconds, it offers: "Stuck? Here are 3 angles you haven't considered."

The canvas becomes a cognitive workspace. Create a "project zone" and every note, every conversation, every web clip related to that project flows into it. Run "simulations" - ask the AI "If we proceed with Option A, what does my knowledge suggest about risks?" and it synthesizes an answer from your accumulated context.

But the real moonshot: **thinking sessions are recorded**. Not as video, but as spatial-temporal traces. Replay how you moved through ideas. Share your "thinking recording" with a colleague so they can see your reasoning process. Annotate your own past thinking: "This is where I got stuck." Your knowledge graph becomes not just a map of what you know, but a time-lapse of how you came to know it.

The philosophical shift: from "notes as storage" to "notes as extended mind." PatchPad becomes cognitive infrastructure.

---

## Next Move

**Most Promising Idea: Real-time Collaboration (Sync Phase 4)**

With sync phases 1-3 complete (Supabase backend, auth, conflict resolution), you're one step away from the feature that transforms PatchPad from a personal tool into a team platform. The infrastructure is laid: authentication works, real-time subscriptions exist, conflict detection is live. What's missing is Yjs CRDT integration for character-level collaboration and presence awareness.

This unlocks network effects. Solo note apps compete on features; collaborative knowledge bases grow with their user graphs. Every shared note is a potential onboarding moment for a new user. The "Knowledge Graph Publishing" feature becomes more compelling when it can show "co-created by X people." And the price point shifts - personal tools struggle to justify $10/month; team tools command $15/user/month.

**First Experiment (< 1 day)**

Before building full CRDT collaboration, validate demand with a simpler test: **shareable read-only note links**. Add a "Share" button that generates a unique URL (stored in Supabase). Anyone with the link can view the note (rendered markdown, no editing). Track: how many users try to share? How many links are actually clicked? If sharing activity is high, invest in full collaboration. If low, users may prefer PatchPad as a private thinking space.

Implementation:
- Add `shared` boolean and `share_token` UUID to notes table
- Create `/shared/:token` route that fetches and renders note
- Add "Share" button in Editor toolbar
- Analytics: log share events and view events

**One Question That Would Sharpen the Vision**

*Is PatchPad's future as a solo thinking tool that happens to sync, or as a collaborative knowledge platform that started personal?*

The answer determines everything. If solo: optimize for depth (richer AI, better visualizations, ambient capture). If collaborative: optimize for breadth (permissions, team spaces, commenting, activity feeds). The current architecture supports both paths, but resources are finite.

The users who've built substantial knowledge graphs in PatchPad - are they asking for sharing features, or for deeper personal intelligence? Five conversations with power users would answer this.

---

## What's Different Since Last Scan (2026-01-06)

The previous vision document proposed features that are now **implemented**:
- Canvas Mode (Horizon 2.1) - Complete with sticky notes, grouping, PNG export
- Sync & Collaboration Layers 1-3 (Horizon 2.2) - Supabase auth, sync engine, conflict resolution
- Voice-First Capture (Horizon 2.3) - All 5 phases including dictation mode
- AI Research Partner (Horizon 3.2) - Conversational AI with semantic search, citations, knowledge dashboard

This scan focuses on **what's next** now that the foundation is built. The low-hanging fruit has been picked; the remaining horizons require either new infrastructure (real-time collaboration, publishing platform) or represent genuine product evolution (knowledge agents, ambient capture, externalized cognition).

PatchPad has grown from "AI-enhanced notes" to "personal knowledge OS." The question is no longer "can it work?" but "what should it become?"
