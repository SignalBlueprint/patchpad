---
repo: patchpad
scan_date: 2026-01-09
status: in-progress
progress: 49%
---

# PatchPad Vision Document

## Foundation Read

PatchPad is a personal knowledge operating system that transforms scattered thoughts into interconnected intelligence. The core loop: **capture** thoughts via voice or text, **refine** them with AI (summarize, expand, extract tasks), **connect** them through wiki links and spatial canvas arrangement, and **retrieve** them through semantic search or conversational AI. Value delivery happens when a user asks "what do I know about X?" and gets a cited, contextual answer drawn from their own notes—or when they visually arrange ideas on a canvas and replay their thinking session later.

## Architecture Snapshot

**Stack:**
- React 18 + TypeScript + Vite
- TailwindCSS for styling
- CodeMirror 6 for markdown editing
- Dexie (IndexedDB wrapper) for local-first storage
- Yjs CRDTs for real-time collaboration (infrastructure ready)
- Supabase for optional cloud sync + auth
- OpenAI/Anthropic for AI features (embeddings, completions, transcription)

**Data:**
- Notes with wiki links, highlights, tags, canvas positions
- Vector embeddings (1536-dim) cached per note
- Patches (AI-suggested edits with accept/reject)
- Templates with AI-fillable placeholders
- Thinking sessions (event traces of canvas activity)
- Conversations (Research Partner chat history with citations)

**Patterns:**
- Local-first with optional cloud sync
- Reactive queries via Dexie's `useLiveQuery`
- Service layer abstraction (39 services)
- Command palette as primary navigation (50+ commands)
- No global state manager—hooks + IndexedDB as source of truth

**Gaps:**
- 7.7% test coverage (12/156 files)
- No service worker for true offline-first
- No error tracking/monitoring
- Yjs collaboration wired but not exposed in UI
- Knowledge agents built but no management dashboard
- No pagination (performance risk at scale)

---

## Latent Potential

**Real-Time Collaboration (90% built):** Yjs, y-indexeddb, and y-websocket are integrated. CollaborativeEditor, RemoteCursor, RemoteSelection, and PresenceIndicator components exist. The only missing piece is a feature flag toggle and invite system—10-15 hours to ship.

**Knowledge Agents (80% built):** Three agents (Archivist, Researcher, Writer) are fully defined with task pipelines. Archivist can suggest connections, detect duplicates, surface contradictions. Researcher can create briefings and find knowledge gaps. Writer can outline and draft from notes. All that's missing is a dashboard to trigger and view agent outputs.

**Session Intelligence (70% built):** Every canvas movement, note creation, and AI query is recorded with timestamps. Comparison analysis exists. But the data sits unused—no heatmaps, no "you spent 10 minutes stuck here before breakthrough" insights, no spaced repetition integration.

**Embeddings Beyond Search:** 1536-dimensional vectors are generated for every note but only used for semantic search. They could power: similar note recommendations, automatic clustering, concept drift detection, or "notes you might have forgotten."

**Conversation History as Training Data:** Every Research Partner conversation is stored with citations. This could train personalized retrieval, surface recurring knowledge gaps, or generate "here's what you've been researching this month" reports.

---

## Horizon 1: Quick Wins

*Buildable in days, using existing infrastructure*

### 1. Second Brain Dashboard

Replace the blank-slate experience with a personalized knowledge overview. When you open PatchPad, you see: a greeting ("Good morning, you're on a 12-day editing streak"), your most-edited notes from the past week, and two intelligent sections—"Brewing Ideas" shows unconnected notes with AI-suggested links ("Your note on 'React patterns' might connect to 'Component design'—click to link"), while "Fading Memories" surfaces 90+ day old notes that mention concepts you've written about recently. One click connects notes or navigates to forgotten knowledge. The dashboard feels like a knowledgeable assistant who's been organizing your notes overnight.

### 2. Thinking Timeline

Add a chronological view that groups notes into "thinking sessions"—clusters of work within 60-minute windows. Scroll through time and see: "Tuesday 2pm: 45 minutes, 8 notes about project architecture" with expandable previews. Click a session and notes highlight on the canvas showing where ideas spatially clustered. A slider adjusts the session gap threshold (15 min to 3 hours). For the first time, you can answer: "What was I working on last Thursday afternoon?" and get a visual, contextual answer.

### 3. Conversation Insights

The Research Partner has answered hundreds of your questions. Surface that intelligence. A new panel shows: your top 10 most-asked questions (grouped by similarity), a topic frequency chart showing what you research most, and crucially—"Knowledge Gaps" listing topics where the AI said "I couldn't find information about this in your notes." Each gap has a "Create Note" button that scaffolds a blank note for that topic. Turn your chat history into a research agenda.

---

## Horizon 2: System Expansions

*Requires new infrastructure, buildable in weeks*

### 1. Live Collaborative Canvases

Enable Google Docs-style real-time collaboration on canvases. Share a session link—collaborators join and see your cursor moving as you drag notes. Their cursors appear in distinct colors with name labels. A chat sidebar allows commentary without disrupting the spatial workspace. Host a brainstorming session where four people simultaneously add sticky notes, cluster ideas, and draw connections. The canvas becomes a shared thinking space, not just a personal one. Record these sessions to replay how the group's thinking evolved—a new form of meeting notes.

### 2. Knowledge Graph Publishing

Export your knowledge graph as a shareable, interactive web page. Choose which tags to include, select a theme (light/dark), and publish to `username.patchpad.pub`. Visitors see a force-directed graph they can zoom and click—each node reveals the note's excerpt. Track analytics: 47 views, most-clicked nodes, referrer sources. It's a personal wiki meets data visualization, shareable on social media or embedded in portfolios. Premium tier: custom domains, password protection, larger graphs.

### 3. Template Intelligence

The app detects patterns in your notes—you have 23 notes titled "Meeting: [Person]" with similar structure. It suggests: "Create a Meeting template?" with auto-detected placeholders. But the magic is AI-filling: create a "Research Summary" template with `{{topic}}` and `{{ai:related_notes}}`—when applied, it searches your notes semantically and pre-populates context. Start a new research note and it already contains excerpts from your 5 most relevant existing notes. Templates become an intelligence layer, not just structure.

---

## Horizon 3: Blue Sky

*Reframes what PatchPad could become*

### 1. Ambient Knowledge Capture

A system tray companion app that captures knowledge passively. Copy a URL—a toast asks "Save to notes?" with auto-extracted title and summary. Copy a long text passage—"Create note from clipboard?" Before a calendar meeting, a notification appears: "Meeting with Alex in 15 min. I found 7 notes mentioning Alex—here's a prep brief." The browser extension adds "Save to PatchPad" to right-click menus, capturing selected text with source URL. Knowledge capture becomes ambient, frictionless, always-on. Your digital life flows into your second brain without friction.

### 2. Knowledge Agents

Three AI agents work in the background. **The Archivist** runs overnight: "I found 3 notes that should link to each other, 2 near-duplicates to merge, and 1 contradiction between your notes on API design." One-click to accept each suggestion. **The Researcher** monitors topics you configure: "You asked about 'knowledge graphs' 12 times this month—here's a briefing synthesizing everything you know plus 3 questions you haven't answered." **The Writer** transforms notes into documents: select 8 notes, ask for a "blog post outline"—it proposes structure, you approve, it drafts sections you can edit. Your notes become a living knowledge base with automated maintenance and amplification.

---

## Moonshot

**Externalized Cognition: Thinking Sessions as First-Class Artifacts**

Imagine your thinking process is as reviewable as your written output. You sit down to solve a problem—click "Record Session." Every note you create, move, connect, or query the AI about is captured with timestamps. An hour later, you have a "thinking session" artifact.

Now replay it: watch your canvas evolve like a time-lapse, see where you lingered (a heatmap overlay shows you spent 12 minutes in one corner before a breakthrough), see the exact moment you asked the AI a question that unlocked an insight. Add annotations: "This is where I realized X."

But the real magic: share a thinking session. A colleague watches your problem-solving approach, not just your conclusion. Students learn how experts think by observing their process. You review your own sessions to improve your thinking patterns—"I notice I always start scattered then cluster after 20 minutes."

A thinking session becomes a new knowledge artifact—not documentation of what you concluded, but a replayable record of how you got there. PatchPad becomes a tool for **metacognition**: understanding your own mind by watching it work.

---

## Next Move

### Most Promising Idea: **Knowledge Agents Dashboard**

**Why:** The agent framework is 80% built. Three agents with distinct capabilities exist. The infrastructure for suggestions, task queues, and results storage is ready. What's missing is a simple UI to trigger agents and review their output. This is the highest-leverage investment because:

1. **Immediate user value:** "Find notes that should be connected" is universally useful
2. **Differentiator:** No note app has autonomous knowledge maintenance
3. **Compounds over time:** Agents improve the knowledge base, making all other features better
4. **Low risk:** Agents can start manual-only, graduate to scheduled

### First Experiment (< 1 day)

Add a "Run Archivist" button to the Second Brain Dashboard. When clicked:
- Archivist scans all notes for potential wiki link connections (content similarity but no existing link)
- Displays top 5 suggestions as cards: "Link 'React patterns' → 'Component design'? (87% confidence)"
- One-click to insert the wiki link
- Track accept/dismiss rate

Ship this experiment, measure engagement, and learn whether users want automated knowledge maintenance.

### One Question to Sharpen the Vision

**Are we building for solo knowledge workers or collaborative teams?**

The architecture supports both, but the product direction is ambiguous. Solo focus means doubling down on: agents, personal analytics, spaced repetition, ambient capture. Team focus means: presence, permissions, shared canvases, commenting, notification systems. The answer reshapes every feature priority. Right now, PatchPad feels 80% solo-optimized with team infrastructure waiting. The next major investment should commit to one path—or explicitly design for "solo-first, team-ready."

---

## Quick Reference

| Horizon | Idea | Effort | Impact |
|---------|------|--------|--------|
| 1 | Second Brain Dashboard | 8 hrs | High |
| 1 | Thinking Timeline | 10 hrs | Medium |
| 1 | Conversation Insights | 10 hrs | Medium |
| 2 | Live Collaborative Canvases | 40 hrs | Very High |
| 2 | Knowledge Graph Publishing | 24 hrs | High |
| 2 | Template Intelligence | 24 hrs | Medium |
| 3 | Ambient Knowledge Capture | 60+ hrs | Very High |
| 3 | Knowledge Agents | 40 hrs | Very High |
| Moon | Externalized Cognition | 100+ hrs | Transformative |
