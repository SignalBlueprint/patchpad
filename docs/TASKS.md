---
repo: patchpad
source: VISION.md
generated: 2026-01-06
status: draft
---

# PatchPad Task Breakdown

## Overview

PatchPad is an AI-augmented markdown note editor designed to transform raw thoughts into structured knowledge through wiki-style linking, concept extraction, and AI-powered refinement. This task list breaks down the vision document into actionable development tasks across four horizons: Quick Wins (days), System Expansions (weeks), Blue Sky (transformational), and Moonshot (long-term vision). The goal is to evolve PatchPad from a local-first personal knowledge base into a full-featured "second brain" with collaboration, spatial thinking, and AI research partner capabilities.

---

## Horizon 1: Quick Wins

*Buildable in days, using existing infrastructure*

---

### 1. Link Suggestions Toast

**Goal:** Automatically suggest wiki-links to existing notes when users mention known concepts or note titles while typing.

**Tasks:**

- [x] Create new hook `src/hooks/useLinkSuggestions.ts`
  - [x] Import `useIdleDetection` from `src/hooks/useIdleDetection.ts`
  - [x] Import `findRelatedNotes` from `src/services/ai.ts`
  - [x] Track cursor position and extract current sentence/paragraph
  - [x] On idle (500ms), scan text for exact matches against note titles
  - [x] Return array of `{ term: string, noteId: string, noteTitle: string, position: number }`

- [x] Create `src/components/LinkSuggestionToast.tsx`
  - [x] Accept props: `suggestions: LinkSuggestion[]`, `onAccept: (suggestion) => void`, `onDismiss: () => void`
  - [x] Render subtle toast in bottom-right corner using glass-morphism style from existing components
  - [x] Show suggestion: "Link 'Project Phoenix' to existing note?"
  - [x] Add "Link" and "Dismiss" buttons
  - [x] Auto-dismiss after 5 seconds if no action

- [x] Add concept matching logic to `src/services/brain.ts`
  - [x] Export new function `findConceptMatches(text: string, concepts: Concept[]): ConceptMatch[]`
  - [x] Match against concept names (case-insensitive)
  - [x] Return matches with position in text

- [x] Integrate into `src/components/Editor.tsx`
  - [x] Import and use `useLinkSuggestions` hook
  - [x] Render `LinkSuggestionToast` when suggestions available
  - [x] On accept, use CodeMirror transaction to wrap matched text with `[[...]]`
  - [x] Store dismissed suggestions in session to avoid re-suggesting

- [x] Add tests in `src/hooks/useLinkSuggestions.test.ts`
  - [x] Test: exact title match triggers suggestion
  - [x] Test: case-insensitive matching works
  - [x] Test: no duplicate suggestions for same term
  - [x] Test: dismissed suggestions not re-shown

**Acceptance Criteria:**
- Typing "discussed Project Phoenix" shows toast if note titled "Project Phoenix" exists
- Clicking "Link" transforms text to "discussed [[Project Phoenix]]"
- Toast auto-dismisses and doesn't block typing
- No suggestions for already-linked text

**Estimated Effort:** 4 hours

**Dependencies:** None

---

### 2. Daily Digest Dashboard

**Goal:** Greet users with a personalized summary of their recent note-taking activity, extracted tasks, and key concepts.

**Tasks:**

- [x] Create `src/services/digest.ts`
  - [x] Export interface `DailyDigest { date: Date, notesCreated: number, wordsWritten: number, tasksExtracted: string[], topConcepts: { name: string, count: number }[], suggestion: string }`
  - [x] Export function `generateDailyDigest(notes: Note[], concepts: Concept[]): DailyDigest`
  - [x] Filter notes by `updatedAt` in last 24 hours
  - [x] Count words using `content.split(/\s+/).length`
  - [x] Extract tasks using regex from `brain.ts` fallback pattern: `/(?:TODO|TASK|ACTION):\s*(.+?)(?:\n|$)/gi`
  - [x] Aggregate concept mentions from recent notes
  - [x] Generate suggestion based on open tasks count

- [x] Create `src/components/DailyDigestModal.tsx`
  - [x] Accept props: `digest: DailyDigest`, `onClose: () => void`, `onNavigateToNote: (id: string) => void`
  - [x] Render modal overlay with glass-morphism styling
  - [x] Show greeting based on time of day ("Good morning", etc.)
  - [x] Display stats: notes created, words written
  - [x] List extracted tasks with checkboxes (visual only)
  - [x] Show top 5 concepts as pills/badges
  - [x] Show actionable suggestion at bottom
  - [x] "Start Writing" button to close

- [x] Add localStorage key for last digest shown
  - [x] Key: `patchpad_last_digest_date`
  - [x] Store ISO date string

- [x] Integrate into `src/App.tsx`
  - [x] On mount, check if digest was shown today
  - [x] If not, generate digest and show modal
  - [x] Update localStorage after showing

- [x] Add user preference to disable digest
  - [x] Add to localStorage: `patchpad_digest_enabled`
  - [x] Add toggle in settings/preferences (if exists) or command palette

**Acceptance Criteria:**
- On first load of day, modal appears with yesterday's summary
- Shows accurate word count and note count
- Displays extracted tasks from notes
- Shows most-mentioned concepts
- Modal doesn't show again same day after dismissal
- Can be disabled via preference

**Estimated Effort:** 4 hours

**Dependencies:** None

---

### 3. Export Bundle

**Goal:** Allow users to export selected notes as a downloadable ZIP file with proper markdown formatting and relative links.

**Tasks:**

- [x] Install JSZip package
  ```bash
  npm install jszip
  npm install -D @types/jszip
  ```

- [x] Create `src/services/export.ts`
  - [x] Export interface `ExportOptions { notes: Note[], includeManifest: boolean, rewriteLinks: boolean }`
  - [x] Export async function `exportNotesAsZip(options: ExportOptions): Promise<Blob>`
  - [x] Import JSZip
  - [x] For each note, create `{sanitized-title}.md` file
  - [x] Build filename map: `{ noteId: filename }`
  - [x] Rewrite `[[Title]]` links to relative paths `[Title](./filename.md)`
  - [x] Generate `manifest.json` with metadata: `{ exported: Date, notes: [{ id, title, filename, tags }] }`
  - [x] Return ZIP blob

- [x] Create `src/utils/sanitizeFilename.ts`
  - [x] Export function `sanitizeFilename(title: string): string`
  - [x] Replace invalid chars: `/\:*?"<>|` with `-`
  - [x] Trim whitespace, limit to 100 chars
  - [x] Handle duplicates by appending `-1`, `-2`, etc.

- [x] Create `src/components/ExportDialog.tsx`
  - [x] Accept props: `notes: Note[]`, `selectedIds: string[]`, `onClose: () => void`
  - [x] Show list of notes to export with checkboxes
  - [x] Options: "Include manifest.json", "Rewrite wiki links"
  - [x] "Export" button triggers download
  - [x] Show progress spinner during ZIP generation

- [x] Add export to Command Palette and App.tsx
  - [x] Add "Export Notes" command to command palette
  - [x] Integrated via keyboard shortcut and App.tsx state

- [x] Add keyboard shortcut
  - [x] Register `Cmd/Ctrl+Shift+E` in App.tsx keyboard handler
  - [x] Action: open ExportDialog with current note selected

- [x] Add tests in `src/services/export.test.ts`
  - [x] Test: single note exports correctly
  - [x] Test: wiki links rewritten to relative paths
  - [x] Test: manifest.json contains correct metadata
  - [x] Test: filename sanitization handles special chars

**Acceptance Criteria:**
- Right-click note → "Export" downloads ZIP
- Multi-select notes → export all selected
- ZIP contains `.md` files with proper frontmatter
- Internal `[[links]]` converted to relative markdown links
- Manifest.json lists all exported notes
- Filenames are filesystem-safe

**Estimated Effort:** 4 hours

**Dependencies:** None

---

## Horizon 2: System Expansions

*Requires new infrastructure, buildable in weeks*

---

### 1. Canvas Mode

**Goal:** Transform notes into draggable sticky notes on an infinite 2D canvas where spatial arrangement persists and connections can be drawn manually.

**Tasks:**

#### Phase 1: Pinnable Nodes (Validation Experiment)

- [x] Add position persistence to `KnowledgeGraph.tsx`
  - [x] Create interface `PinnedPosition { x: number, y: number, pinned: boolean }`
  - [x] Add localStorage key: `patchpad_graph_positions`
  - [x] Load positions on mount, apply to initial node positions
  - [x] Save positions on drag end

- [x] Add "pin" toggle to nodes in `src/components/KnowledgeGraph.tsx`
  - [x] Double-click node to toggle pinned state
  - [x] Pinned nodes skip force simulation (already partially implemented at line 99)
  - [x] Visual indicator: pin icon or different border

- [x] Track usage metrics
  - [x] Count pinned nodes in localStorage: `patchpad_pinned_count`
  - [x] Log to console for validation

#### Phase 2: Canvas View Component

- [x] Create `src/components/Canvas/CanvasView.tsx`
  - [x] Accept props: `notes: Note[]`, `onNoteClick: (id) => void`, `onCreateConnection: (from, to) => void`
  - [x] Render HTML5 Canvas with pan/zoom (adapt from KnowledgeGraph.tsx)
  - [x] Implement infinite canvas with mouse drag panning
  - [x] Add minimap in corner showing viewport position

- [x] Create `src/components/Canvas/StickyNote.tsx`
  - [x] Render note as draggable card on canvas
  - [x] Show title, first 100 chars of content, tags
  - [x] Color based on folder or tag
  - [x] Resize handles for adjusting card size

- [x] Create `src/components/Canvas/ConnectionLine.tsx`
  - [x] Render bezier curve between two notes
  - [x] Arrowhead on target end
  - [x] Click to select, delete key to remove

- [x] Implement connection drawing mode
  - [x] Hold Shift + drag from note to create connection
  - [x] Show rubber-band line while dragging
  - [x] On release over another note, create wiki link between them

#### Phase 3: Canvas Data Model

- [x] Extend `src/types/note.ts`
  - [x] Add interface `CanvasPosition { x: number, y: number, width: number, height: number }`
  - [x] Add optional `canvasPosition?: CanvasPosition` to Note type

- [x] Update database schema in `src/db/index.ts`
  - [x] Version 5: add `canvasX, canvasY, canvasWidth, canvasHeight` indexes
  - [x] Migration: existing notes get null canvas positions

- [x] Create `src/services/canvas.ts`
  - [x] Export function `saveCanvasLayout(positions: Map<string, CanvasPosition>): Promise<void>`
  - [x] Export function `loadCanvasLayout(): Promise<Map<string, CanvasPosition>>`
  - [x] Export function `autoLayout(notes: Note[]): Map<string, CanvasPosition>` (grid or force-directed)

#### Phase 4: Canvas Features

- [x] Add toolbar to Canvas view
  - [x] "Add Note" button - creates new note at center of viewport
  - [x] "Auto Layout" button - applies force-directed layout
  - [x] "Zoom to Fit" button - fits all notes in viewport
  - [x] "Export as PNG" button

- [x] Implement canvas export
  - [x] Use `canvas.toDataURL('image/png')`
  - [x] Create high-resolution export (2x scale)
  - [x] Download as `patchpad-canvas-{date}.png`

- [x] Add grouping feature
  - [x] Draw rectangle to select multiple notes
  - [x] "Group" action creates visual container
  - [x] Groups can be collapsed/expanded
  - [x] Groups persist in localStorage

#### Phase 5: Integration

- [x] Add Canvas tab to main view in `src/App.tsx`
  - [x] Tab bar: "Notes" | "Canvas" | "Graph"
  - [x] Canvas view shows all notes with positions
  - [x] Clicking note in canvas opens it in editor

- [x] Sync canvas with note changes
  - [x] New note appears at default position
  - [x] Deleted note removed from canvas
  - [x] Title changes reflected on sticky note

**New Infrastructure Required:**
- Canvas rendering engine (built on existing KnowledgeGraph canvas code)
- Canvas position storage (Dexie schema update)
- PNG export capability (native canvas API)

**Migration Notes:**
- Database version bump from 4 to 5
- Existing notes will have null canvas positions until manually placed
- No breaking changes to existing functionality

**Acceptance Criteria:**
- Toggle between Notes list and Canvas view
- Drag notes to arrange spatially
- Positions persist across sessions
- Draw connections between notes by dragging
- Export canvas as PNG image
- Zoom and pan work smoothly
- Performance acceptable with 100+ notes

**Estimated Effort:** 24 hours

**Dependencies:** None (builds on existing KnowledgeGraph.tsx)

---

### 2. Sync & Collaboration Layer

**Goal:** Enable cross-device sync and real-time collaboration through a backend service with conflict-free merging.

**Tasks:**

#### Phase 1: Backend Setup

- [x] Choose and set up backend
  - [x] Option A: Supabase (recommended for speed)
    ```bash
    npm install @supabase/supabase-js
    ```
  - [ ] Option B: Firebase
    ```bash
    npm install firebase
    ```

- [x] Create `src/config/supabase.ts`
  - [x] Initialize Supabase client with env variables
  - [x] Export typed client

- [x] Design database schema (Supabase SQL)
  ```sql
  -- Users table (handled by Supabase Auth)

  -- Notes table
  CREATE TABLE notes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
    title TEXT,
    content TEXT,
    tags TEXT[],
    folder_id UUID,
    parent_id UUID,
    canvas_position JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
  );

  -- Patches table for sync
  CREATE TABLE patches (
    id UUID PRIMARY KEY,
    note_id UUID REFERENCES notes,
    user_id UUID REFERENCES auth.users,
    ops JSONB,
    status TEXT,
    created_at TIMESTAMPTZ
  );

  -- Enable RLS
  ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
  ```

- [x] Create `src/services/sync.ts`
  - [x] Export function `syncToCloud(notes: Note[]): Promise<SyncResult>`
  - [x] Export function `pullFromCloud(): Promise<Note[]>`
  - [x] Export function `resolveConflicts(local: Note, remote: Note): Note`
  - [x] Implement optimistic locking with version numbers

#### Phase 2: Authentication

- [x] Create `src/components/Auth/LoginModal.tsx`
  - [x] Email/password login form
  - [x] "Sign up" / "Log in" toggle
  - [x] OAuth buttons (Google, GitHub) if configured
  - [x] "Continue offline" option

- [x] Create `src/hooks/useAuth.ts`
  - [x] Wrap Supabase auth methods
  - [x] Track auth state: `{ user, loading, error }`
  - [x] Expose: `signIn`, `signUp`, `signOut`, `resetPassword`

- [x] Create `src/context/AuthContext.tsx`
  - [x] Provide auth state to entire app
  - [x] Redirect to login if required

#### Phase 3: Sync Engine

- [x] Create `src/services/syncEngine.ts`
  - [x] Implement background sync loop (every 30 seconds)
  - [x] Queue local changes when offline
  - [x] Replay queue when connection restored
  - [x] Handle conflict resolution UI

- [x] Add online/offline detection
  - [x] Use `navigator.onLine` and `online`/`offline` events
  - [x] Show status indicator in header
  - [x] Queue writes when offline

- [x] Implement conflict resolution UI
  - [x] Create `src/components/ConflictResolutionModal.tsx`
  - [x] Show diff between local and remote versions
  - [x] Options: "Keep Mine", "Keep Theirs", "Merge"

#### Phase 4: Real-time Collaboration (Advanced)

- [ ] Install Yjs for CRDTs
  ```bash
  npm install yjs y-websocket y-indexeddb
  ```

- [ ] Create `src/services/collaboration.ts`
  - [ ] Initialize Y.Doc per note
  - [ ] Sync with WebSocket provider
  - [ ] Map Y.Text to CodeMirror content

- [ ] Add awareness (presence) features
  - [ ] Show other users' cursors in editor
  - [ ] Display "X is editing" indicator
  - [ ] Use different colors per user

- [ ] Create share functionality
  - [ ] Generate shareable link with note ID
  - [ ] Permission levels: view, comment, edit
  - [ ] Expiring links option

**New Infrastructure Required:**
- Supabase project (or Firebase project)
- PostgreSQL database (provided by Supabase)
- WebSocket server for real-time (Supabase Realtime or y-websocket)
- Authentication system

**Migration Notes:**
- Existing IndexedDB data needs migration path to cloud
- First sync should offer "Upload existing notes" option
- Users can continue using local-only mode
- No data loss - local remains source of truth until first sync

**Acceptance Criteria:**
- User can sign up / log in
- Notes sync across devices within 30 seconds
- Offline changes sync when reconnected
- Conflicts are detected and user can resolve
- Optional: real-time cursor presence
- Optional: shareable note links

**Estimated Effort:** 40 hours

**Dependencies:** Backend service account (Supabase or Firebase)

---

### 3. Voice-First Capture

**Goal:** Make voice recording a primary input method with quick capture, transcription, and AI summarization.

**Tasks:**

#### Phase 1: Quick Capture Button

- [x] Create `src/components/QuickCaptureButton.tsx`
  - [x] Floating action button (FAB) in bottom-right corner
  - [x] Microphone icon, pulsing animation when recording
  - [x] Tap to start, tap again to stop
  - [x] Long-press to cancel

- [x] Enhance `src/components/AudioRecorder.tsx`
  - [x] Add `onQuickCapture` mode prop
  - [x] Simplified UI for quick capture: just waveform and timer
  - [x] Auto-start recording on mount
  - [x] Return transcription result on stop

- [x] Integrate quick capture flow
  - [x] Recording → Transcription → AI Summary → New Note
  - [x] Show progress: "Recording..." → "Transcribing..." → "Creating note..."
  - [x] New note appears in inbox/unfiled

#### Phase 2: Transcription Improvements

- [x] Add alternative transcription providers in `src/services/audio.ts`
  - [x] Support Anthropic (when available) or fallback
  - [x] Add browser's Web Speech API as free fallback
    ```typescript
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    ```

- [x] Create `src/services/transcription.ts`
  - [x] Abstract transcription provider interface
  - [x] `transcribe(audio: Blob): Promise<TranscriptionResult>`
  - [x] Provider selection based on config

- [x] Add transcription settings
  - [x] Language selection dropdown
  - [x] "Use local transcription" toggle for privacy
  - [x] Quality vs speed preference

#### Phase 3: Voice Notes Processing

- [x] Create `src/services/voiceNoteProcessor.ts`
  - [x] Export function `processVoiceNote(transcription: string): Promise<ProcessedNote>`
  - [x] Use AI to: clean up filler words, add punctuation, extract title
  - [x] Optionally summarize if > 500 words
  - [x] Extract action items and tags

- [x] Add "Voice Note" type indicator
  - [x] Badge or icon on notes created from voice
  - [x] Store original audio blob option
  - [x] Playback original recording from note

#### Phase 4: Voice Queries

- [x] Enhance `src/components/AskNotesDialog.tsx`
  - [x] Add microphone button next to text input
  - [x] "Ask with voice" records question
  - [x] Transcription feeds into `askNotes()` function
  - [x] Optional: read answer aloud using Web Speech Synthesis

- [x] Create voice command system
  - [x] "Create note about..." → new note
  - [x] "Find notes about..." → search
  - [x] "What did I write about..." → askNotes query

#### Phase 5: Background Voice Capture

- [x] Implement "Dictation Mode"
  - [x] Continuous recording with silence detection
  - [x] Auto-split into paragraphs on long pauses (2+ seconds)
  - [x] Real-time transcription display
  - [x] Edit while dictating

**New Infrastructure Required:**
- OpenAI Whisper API (already integrated)
- Optional: Web Speech API (browser built-in)
- Optional: audio blob storage for playback
- PWA updates for background recording permission

**Migration Notes:**
- No database changes required
- New notes created from voice use existing Note type
- Audio blobs stored in IndexedDB if playback feature enabled

**Acceptance Criteria:**
- Floating capture button always visible
- Tap once to record, tap again to create note
- Transcription completes within 10 seconds for 30-second clip
- AI summarization optional but works
- Voice queries return relevant results
- Works on mobile browsers

**Estimated Effort:** 20 hours

**Dependencies:** OpenAI API key for Whisper (already supported)

---

## Horizon 3: Blue Sky

*Reframes what PatchPad could become*

---

### 1. Knowledge Graph as Product

**Goal:** Enable users to publish their knowledge graph as an interactive, shareable web page.

**Tasks:**

#### Research Phase

- [ ] Evaluate static site generators for graph export
  - [ ] Option A: Generate standalone HTML + JS bundle
  - [ ] Option B: Generate Astro/Next.js static site
  - [ ] Option C: Embed in iframe with hosted renderer

- [ ] Research graph visualization libraries for publishing
  - [ ] D3.js force layout (most flexible)
  - [ ] vis.js (good defaults)
  - [ ] Cytoscape.js (academic features)

#### Phase 1: Export Static Graph

- [ ] Create `src/services/graphExport.ts`
  - [ ] Export function `generateInteractiveGraph(graph: KnowledgeGraph, notes: Note[]): string`
  - [ ] Generate self-contained HTML file
  - [ ] Embed minified visualization JS
  - [ ] Include note excerpts as node tooltips

- [ ] Create export options
  - [ ] Theme: light/dark
  - [ ] Privacy: include full content vs titles only
  - [ ] Interactivity level: static image vs interactive

- [ ] Add "Publish Graph" button to BrainDashboard
  - [ ] Opens PublishGraphDialog
  - [ ] Preview rendered graph
  - [ ] Download HTML file

#### Phase 2: Hosted Publishing (Future)

- [ ] Design hosting infrastructure
  - [ ] Subdomain: `{username}.patchpad.pub`
  - [ ] Static file hosting (S3/CloudFront or Vercel)
  - [ ] Custom domain support

- [ ] Create publish API
  - [ ] `POST /api/publish` - upload graph
  - [ ] `GET /{username}/{graph-id}` - view published graph
  - [ ] Version history and rollback

- [ ] Add analytics
  - [ ] View count
  - [ ] Most-clicked nodes
  - [ ] Referrer tracking

**Open Questions:**
- Should published graphs be editable or read-only?
- How to handle note privacy (some notes public, some private)?
- Monetization: free tier limits? Premium custom domains?
- How to prevent abuse (hosting harmful content)?

**Proof of Concept Scope:**
- Export knowledge graph as standalone HTML file
- Interactive: click nodes to see note excerpt
- Download and host anywhere (GitHub Pages, Netlify)
- No backend required for MVP

**Acceptance Criteria:**
- One-click export to interactive HTML
- Graph renders correctly in modern browsers
- Clicking node shows note title and excerpt
- File size < 2MB for 100-node graph
- Works offline once loaded

**Estimated Effort:** 16 hours (POC), 60+ hours (hosted platform)

**Dependencies:** None for POC; backend infrastructure for hosted version

---

### 2. AI Research Partner

**Goal:** Transform AI from one-shot actions to a conversational research assistant that knows your notes.

**Tasks:**

#### Research Phase

- [x] Evaluate conversation memory approaches
  - [x] Option A: Include all notes in context (limited by token count)
  - [x] Option B: RAG with vector embeddings
  - [x] Option C: Hierarchical summarization

- [x] Research vector database options
  - [x] In-browser: vectra, hnswlib-wasm
  - [x] Cloud: Pinecone, Supabase pgvector

#### Phase 1: Conversational AI Interface

- [x] Create `src/components/ResearchPartner/ChatInterface.tsx`
  - [x] Full-screen or sidebar chat view
  - [x] Message history with user/AI turns
  - [x] Typing indicator
  - [x] "New conversation" button

- [x] Create `src/services/researchPartner.ts`
  - [x] Maintain conversation history in memory
  - [x] Build context from relevant notes
  - [x] Format system prompt with note knowledge

- [x] Implement basic conversation flow
  - [x] User asks question
  - [x] AI searches notes for relevant context
  - [x] AI responds with citations `[Note: Title]`
  - [x] User can follow up

#### Phase 2: Note-Aware Context

- [x] Implement semantic search
  - [x] Generate embeddings for all notes (on-demand or background)
  - [x] Store embeddings in IndexedDB
  - [x] Search by cosine similarity

- [x] Create `src/services/embeddings.ts`
  - [x] Export function `generateEmbedding(text: string): Promise<number[]>`
  - [x] Use OpenAI text-embedding-ada-002 or similar
  - [x] Cache embeddings per note (invalidate on update)

- [x] Create `src/services/semanticSearch.ts`
  - [x] Export function `searchNotes(query: string, k: number): Promise<Note[]>`
  - [x] Return top-k most similar notes
  - [x] Include relevance score

#### Phase 3: Proactive Assistance

- [ ] Implement "Research Brief" generation
  - [ ] "Prepare me for meeting with [Company]"
  - [ ] AI searches notes for company mentions
  - [ ] Generates structured brief with talking points
  - [ ] Creates new note with brief

- [ ] Add task creation from conversation
  - [ ] AI can suggest creating tasks
  - [ ] "Add as task" button on suggestions
  - [ ] Tasks linked to relevant notes

- [ ] Implement follow-up suggestions
  - [ ] After AI response, suggest related questions
  - [ ] "You might also want to know..."
  - [ ] Based on note connections

#### Phase 4: Long-term Memory (Advanced)

- [ ] Implement conversation persistence
  - [ ] Save conversation history to IndexedDB
  - [ ] Resume previous conversations
  - [ ] Reference past conversations in new ones

- [ ] Add "AI knows" summary
  - [ ] Dashboard showing what AI has learned
  - [ ] Key facts extracted from notes
  - [ ] User can correct or remove facts

**Open Questions:**
- How much note content to include in AI context? (cost vs quality)
- Should AI have write access to notes or only suggest edits?
- Privacy: should conversations be synced to cloud?
- How to handle AI hallucinations about note content?

**Proof of Concept Scope:**
- Chat interface with conversation history (session only)
- AI searches notes before responding
- Responses cite source notes
- Basic follow-up conversation works

**Acceptance Criteria:**
- Ask "What do I know about X?" and get answer from notes
- AI cites specific notes in responses
- Can have multi-turn conversations
- Response time < 5 seconds
- Clear when AI doesn't find relevant notes

**Estimated Effort:** 24 hours (POC), 80+ hours (full feature)

**Dependencies:** OpenAI API (for embeddings and chat), or Anthropic API

---

## Moonshot

**"Memory Palace as a Service"**

*A spatial VR/AR environment where you literally walk through your knowledge*

---

### Phase 1: Foundation - Virtual Library (Web 3D)

**Goal:** Create a 3D navigable space representing your notes as a virtual library.

**Tasks:**

- [ ] Set up Three.js environment
  ```bash
  npm install three @types/three
  npm install @react-three/fiber @react-three/drei
  ```

- [ ] Create `src/components/MemoryPalace/Scene.tsx`
  - [ ] Initialize Three.js scene with React Three Fiber
  - [ ] Add ambient lighting and shadows
  - [ ] Implement first-person camera controls
  - [ ] WASD movement, mouse look

- [ ] Create `src/components/MemoryPalace/Library.tsx`
  - [ ] Generate 3D room geometry
  - [ ] Bookshelves along walls
  - [ ] Central reading table
  - [ ] Skybox/environment

- [ ] Create `src/components/MemoryPalace/Bookshelf.tsx`
  - [ ] Render shelf unit with slots for books
  - [ ] Each folder = one bookshelf section
  - [ ] Unfiled notes on central table

- [ ] Create `src/components/MemoryPalace/Book.tsx`
  - [ ] 3D book model with spine label (note title)
  - [ ] Color based on tags or folder
  - [ ] Hover to see preview
  - [ ] Click to "open" (shows note content)

- [ ] Implement book interactions
  - [ ] Raycasting for hover/click detection
  - [ ] "Pull out book" animation
  - [ ] Book opens to show content as 3D pages or overlay

**Estimated Effort:** 40 hours

---

### Phase 2: Core Feature - Spatial Navigation

**Goal:** Enable meaningful spatial navigation with rooms representing projects and paths showing history.

**Tasks:**

- [ ] Create room generation system
  - [ ] Each top-level folder = one room
  - [ ] Doorways connect related folders
  - [ ] Room size based on note count

- [ ] Implement navigation map
  - [ ] Mini-map showing room layout
  - [ ] Current position indicator
  - [ ] Click to teleport

- [ ] Create `src/components/MemoryPalace/ConnectionBeam.tsx`
  - [ ] Visualize wiki links as light beams between books
  - [ ] Different colors for different relationship types
  - [ ] Can "follow" beams to navigate

- [ ] Implement breadcrumb trail
  - [ ] Show path of recently visited notes
  - [ ] Visual trail in 3D space
  - [ ] Can retrace steps

- [ ] Add spatial search
  - [ ] Voice or text search
  - [ ] Matching books glow/highlight
  - [ ] Path illuminates to nearest match

**Estimated Effort:** 60 hours

---

### Phase 3: Full Vision - Immersive Knowledge

**Goal:** Full VR/AR support with voice interaction and collaborative spaces.

**Tasks:**

- [ ] Add WebXR support
  ```bash
  npm install @react-three/xr
  ```
  - [ ] VR headset compatibility (Quest, etc.)
  - [ ] AR mode for mobile
  - [ ] Hand tracking for interactions

- [ ] Implement voice commands
  - [ ] "Show me notes about X" - highlights relevant books
  - [ ] "Create new note" - spawns floating note card
  - [ ] "Connect these" - draws link between held items

- [ ] Create collaborative mode
  - [ ] Multiple users in same space
  - [ ] Avatar representations
  - [ ] Voice chat
  - [ ] Shared whiteboard

- [ ] Add spatial audio
  - [ ] Notes can have audio annotations
  - [ ] Spatialized playback based on position
  - [ ] Ambient library sounds

- [ ] Implement memory techniques
  - [ ] "Method of loci" mode
  - [ ] Place notes at specific spatial positions
  - [ ] Guided tours for memorization
  - [ ] Spaced repetition integration

**Open Questions:**
- What hardware to target? (Quest 2/3, Vision Pro, phone AR)
- How to make 3D navigation faster than 2D for most tasks?
- Performance with 1000+ notes?
- Motion sickness considerations?

**Proof of Concept Scope:**
- Single 3D room with bookshelves
- Notes as clickable books
- Basic WASD + mouse navigation
- No VR required - desktop browser only

**Estimated Effort:** 200+ hours (full vision)

**Dependencies:**
- Three.js / React Three Fiber
- WebXR API (for VR)
- Real-time multiplayer infrastructure (for collaboration)

---

## Suggested Starting Point

### Recommended First Task: **Link Suggestions Toast** (Horizon 1.1)

**Why start here:**

1. **Highest signal-to-effort ratio**: This feature directly validates the core value proposition of PatchPad (building a connected knowledge graph) with minimal development time (~4 hours).

2. **Uses existing infrastructure**: The `findRelatedNotes()` function and concept extraction in `brain.ts` are already implemented. You're essentially wiring existing capabilities to the UI.

3. **Immediately visible value**: Users will experience the "magic moment" of PatchPad automatically recognizing connections. This is the feature that converts casual users to power users.

4. **Low risk**: No database changes, no new dependencies, no breaking changes. If it doesn't resonate, easy to remove.

5. **Validates before Canvas Mode**: Before investing 24+ hours in Canvas Mode, you want to confirm users care about note connections. Link Suggestions tests this assumption cheaply.

**What it unblocks:**

- Validates demand for automatic linking → informs priority of Canvas Mode
- Creates more `[[wiki links]]` in notes → richer knowledge graph
- Teaches users about existing RelatedNotes feature → increases feature discovery
- Sets up hook patterns (`useLinkSuggestions`) reusable for other idle-time features

**How to start:**

```bash
# Create the hook file
touch src/hooks/useLinkSuggestions.ts

# Create the toast component
touch src/components/LinkSuggestionToast.tsx

# Run dev server
npm run dev
```

Then implement the hook following the task checklist above, starting with simple exact title matching before adding concept matching.
