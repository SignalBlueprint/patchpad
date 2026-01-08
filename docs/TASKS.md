---
repo: patchpad
source: VISION.md
generated: 2026-01-08
status: draft
---

# PatchPad Task Breakdown

## Overview

PatchPad is a personal knowledge operating system with AI-powered capture, refinement, and retrieval. This task list transforms the vision document into actionable work across three horizons: quick wins (days), system expansions (weeks), and blue sky features (months). The moonshot—externalized cognition through thinking sessions—is broken into phases. Each task is scoped to a single work session (2-4 hours) with specific file paths, function names, and acceptance criteria.

---

## Horizon 1: Quick Wins

*Buildable in days, using existing infrastructure*

---

### 1. Second Brain Dashboard

**Goal:** Replace the blank-slate experience with a personalized knowledge overview that surfaces insights automatically on app load.

**Tasks:**

#### Phase 1: Dashboard Shell
- [ ] Create `src/components/SecondBrainDashboard/index.tsx` — Main dashboard component
  - Accept props: `notes: Note[]`, `onNavigateToNote: (id: string) => void`, `onClose: () => void`
  - Full-screen modal with glass-morphism styling (reference `DailyDigestModal.tsx`)
  - Three-section grid layout: Greeting (top), Brewing Ideas (left), Fading Memories (right)

- [ ] Create `src/components/SecondBrainDashboard/GreetingSection.tsx`
  - Time-based greeting: "Good morning/afternoon/evening"
  - Display editing streak (consecutive days with note edits)
  - Show "Most active notes this week" with top 3 note titles

- [ ] Create `src/components/SecondBrainDashboard/BrewingIdeasSection.tsx`
  - Query notes with no outgoing wiki links (`!content.includes('[[')`)
  - For each unconnected note, show AI-suggested links
  - Card UI with "Connect to..." button that inserts `[[suggested title]]`

- [ ] Create `src/components/SecondBrainDashboard/FadingMemoriesSection.tsx`
  - Query notes not updated in 90+ days
  - Cross-reference with concepts from recently edited notes
  - Show relevance reason: "Mentions 'React' which you wrote about yesterday"
  - "Revisit" button navigates to note

#### Phase 2: Analytics Service
- [ ] Create `src/services/dashboardInsights.ts`
  - `getEditingStreak(notes: Note[]): number` — Count consecutive days with edits
  - `getMostActiveNotes(notes: Note[], days: number): Note[]` — Top 5 by edit frequency
  - `getUnconnectedNotes(notes: Note[]): Note[]` — Notes with zero outgoing wiki links
  - `getFadingMemories(notes: Note[], concepts: string[]): FadingMemory[]` — 90+ day old notes matching recent concepts
  - `suggestConnections(note: Note, allNotes: Note[]): SuggestedLink[]` — Use `semanticSearch.ts` for similarity

- [ ] Add tests in `src/services/dashboardInsights.test.ts`
  - Test streak calculation with gaps
  - Test unconnected note detection
  - Test fading memory relevance scoring

#### Phase 3: Integration
- [ ] Add dashboard toggle state to `src/App.tsx`
  - `const [dashboardOpen, setDashboardOpen] = useState(false)`
  - Check `localStorage.getItem('patchpad_show_dashboard')` on mount
  - Conditionally render `<SecondBrainDashboard />` when open

- [ ] Add command palette entry in `src/App.tsx` commands array
  - `{ id: 'second-brain', name: 'Second Brain Dashboard', shortcut: 'Ctrl+Shift+B', action: () => setDashboardOpen(true) }`

- [ ] Add "Show on startup" toggle in dashboard footer
  - Persist to `localStorage.setItem('patchpad_show_dashboard', 'true')`

**Acceptance Criteria:**
- Dashboard opens via Ctrl+Shift+B or command palette
- Greeting shows correct time of day and editing streak
- "Brewing Ideas" shows at least one connection suggestion for unconnected notes
- "Fading Memories" surfaces relevant old notes
- Clicking "Connect" inserts wiki link and updates note
- "Show on startup" preference persists across sessions

**Estimated Effort:** 8 hours

**Dependencies:** None — uses existing `semanticSearch.ts` and `brain.ts`

---

### 2. Thinking Timeline

**Goal:** Add a chronological view that groups notes into "thinking sessions" based on temporal proximity.

**Tasks:**

#### Phase 1: Session Clustering
- [ ] Create `src/services/timelineClustering.ts`
  - `interface ThinkingCluster { id: string; startTime: Date; endTime: Date; notes: Note[]; duration: number }`
  - `clusterNotesByTime(notes: Note[], gapMinutes: number): ThinkingCluster[]`
    - Sort notes by `createdAt`
    - Group notes where gap between consecutive notes < `gapMinutes`
    - Calculate cluster duration and summary stats
  - `getClusterTopics(cluster: ThinkingCluster): string[]` — Extract common tags/concepts
  - `formatClusterTitle(cluster: ThinkingCluster): string` — "8 notes about project architecture"

- [ ] Add tests in `src/services/timelineClustering.test.ts`
  - Test clustering with 60-minute default gap
  - Test single-note clusters
  - Test topic extraction

#### Phase 2: Timeline UI
- [ ] Create `src/components/ThinkingTimeline/index.tsx`
  - Accept props: `notes: Note[]`, `onSelectNote: (id) => void`, `onHighlightCluster: (noteIds: string[]) => void`
  - Vertical scrolling timeline with date headers
  - Gap threshold slider (15 min to 180 min)
  - Stats header: total clusters, avg notes per cluster

- [ ] Create `src/components/ThinkingTimeline/ClusterCard.tsx`
  - Expandable card showing cluster summary
  - Time range, note count, common tags
  - Expand to show individual note titles
  - "View on Canvas" button sets `onHighlightCluster`

- [ ] Create `src/components/ThinkingTimeline/DateHeader.tsx`
  - Sticky header: "Today", "Yesterday", or "January 8, 2026"
  - Uses Intersection Observer for sticky behavior

#### Phase 3: Integration
- [ ] Add `mainView: 'notes' | 'canvas' | 'timeline'` state to `src/App.tsx`
  - Currently only notes/canvas; add timeline option

- [ ] Add timeline tab button to view switcher in `src/App.tsx`
  - Icon: clock with list

- [ ] Add canvas highlight mode
  - When cluster selected, pass `highlightedNoteIds` to `CanvasView`
  - Highlighted notes get glow effect and viewport centers on them

- [ ] Add command palette entry: `{ id: 'view-timeline', name: 'Thinking Timeline', action: () => setMainView('timeline') }`

**Acceptance Criteria:**
- Timeline view accessible via tab bar and command palette
- Notes grouped into clusters with configurable gap threshold
- Each cluster shows time range, note count, and topics
- Clicking cluster highlights notes on canvas
- Slider adjusts clustering in real-time
- Smooth scrolling with sticky date headers

**Estimated Effort:** 10 hours

**Dependencies:** None

---

### 3. Conversation Insights

**Goal:** Surface patterns from Research Partner usage—top questions, topics, and knowledge gaps.

**Tasks:**

#### Phase 1: Insights Analysis
- [ ] Extend `src/services/conversationInsights.ts` (already exists)
  - `getQuestionFrequency(conversations: Conversation[]): QuestionCluster[]` — Group similar questions
  - `getTopicTrends(conversations: Conversation[], days: number): TopicTrend[]` — Topic mentions over time
  - `getKnowledgeGaps(conversations: Conversation[]): KnowledgeGap[]` — Find "I couldn't find" responses
  - `interface KnowledgeGap { topic: string; question: string; conversationId: string; timestamp: Date }`

- [ ] Add tests for new functions in `src/services/conversationInsights.test.ts`

#### Phase 2: Insights Panel UI
- [ ] Create `src/components/ConversationInsights/index.tsx`
  - Three tabs: "Top Questions", "Topics", "Knowledge Gaps"
  - Accept props: `conversations: Conversation[]`, `onCreateNote: (title: string) => void`

- [ ] Create `src/components/ConversationInsights/TopQuestionsTab.tsx`
  - List of question clusters with frequency badges
  - Click to navigate to original conversation

- [ ] Create `src/components/ConversationInsights/TopicsTab.tsx`
  - Bar chart or tag cloud of topic frequency
  - Filter conversations by clicking topic

- [ ] Create `src/components/ConversationInsights/KnowledgeGapsTab.tsx`
  - List of topics where AI couldn't find information
  - "Create Note" button scaffolds empty note with topic as title
  - "Research" button opens web search (optional)

#### Phase 3: Integration
- [ ] Add insights toggle to `src/components/ResearchPartner/ChatInterface.tsx`
  - Button in header: "Insights" icon
  - Side panel slides in from right

- [ ] Add command palette entry: `{ id: 'conversation-insights', name: 'Conversation Insights', action: () => openResearchPartnerWithInsights() }`

**Acceptance Criteria:**
- Insights panel accessible from Research Partner interface
- Top 10 questions displayed with frequency counts
- Topic frequency visualized as chart
- Knowledge gaps listed with "Create Note" action
- Creating note from gap pre-fills title

**Estimated Effort:** 10 hours

**Dependencies:** Existing `conversationInsights.ts` service

---

## Horizon 2: System Expansions

*Requires new infrastructure, buildable in weeks*

---

### 1. Live Collaborative Canvases

**Goal:** Enable Google Docs-style real-time collaboration on canvases with presence, cursors, and chat.

**Tasks:**

#### Phase 1: Collaboration Mode Toggle
- [ ] Add collaboration state to `src/App.tsx`
  - `const [collaborationMode, setCollaborationMode] = useState(false)`
  - `const [collaborationRoomId, setCollaborationRoomId] = useState<string | null>(null)`

- [ ] Create `src/components/CollaborationControls.tsx`
  - "Start Collaboration" button generates room ID
  - "Join Collaboration" input for room ID
  - Display shareable link: `patchpad.app/collab/{roomId}`
  - "End Collaboration" button

- [ ] Extend `src/services/collaboration.ts`
  - `createRoom(userId: string): string` — Generate room ID, connect Yjs
  - `joinRoom(roomId: string, userId: string): void`
  - `leaveRoom(): void`

#### Phase 2: Presence Awareness
- [ ] Wire `src/components/PresenceIndicator.tsx` to show collaborators
  - Already exists; connect to `useCollaboration` hook
  - Show avatar circles with initials in canvas header
  - Tooltip shows full name

- [ ] Wire `src/components/RemoteCursor.tsx` to render peer cursors
  - Already exists; position based on awareness state
  - Smooth animation on cursor move

- [ ] Wire `src/components/RemoteSelection.tsx` for text selections
  - Already exists; highlight peer selections in editor

- [ ] Update `src/hooks/useCollaboration.ts`
  - Broadcast local cursor position on canvas
  - Subscribe to peer awareness updates
  - Handle peer connect/disconnect events

#### Phase 3: Collaborative Canvas
- [ ] Extend `src/components/Canvas/CanvasView.tsx`
  - Accept `collaborationMode: boolean` prop
  - Sync note positions via Yjs Y.Map
  - Show remote cursors on canvas (not just in editor)

- [ ] Create `src/components/Canvas/RemoteCanvasCursor.tsx`
  - Render peer cursor on canvas with name label
  - Different style from editor cursor (pointer icon)

- [ ] Add canvas-level Yjs bindings in `src/services/collaboration.ts`
  - `syncNotePosition(noteId: string, position: CanvasPosition): void`
  - `onRemotePositionChange(callback: (noteId, position) => void): unsubscribe`

#### Phase 4: Collaboration Chat
- [ ] Create `src/components/CollaborationChat.tsx`
  - Sidebar panel with message list
  - Input for new messages
  - Show sender name and timestamp
  - Store in Yjs Y.Array for real-time sync

- [ ] Add chat toggle button to canvas toolbar

#### Phase 5: Session Recording for Collaborative Sessions
- [ ] Extend `src/services/sessionRecorder.ts`
  - Record collaboration events: peer-join, peer-leave, chat-message
  - Attribute note changes to specific peer IDs
  - Store peer metadata in session

**Acceptance Criteria:**
- User can start collaboration and share link
- Collaborators join and see each other's cursors in real-time
- Note movements sync instantly across all participants
- Chat messages appear in real-time
- Collaboration sessions can be recorded and replayed

**Estimated Effort:** 40 hours

**New Infrastructure Required:**
- Yjs WebSocket server (can use `y-websocket` demo server initially)
- Consider Supabase Realtime as alternative transport

**Migration Notes:**
- Existing notes remain local-first
- Collaboration is opt-in per session
- No database schema changes needed

---

### 2. Knowledge Graph Publishing

**Goal:** Export knowledge graph as a shareable, interactive web page with analytics.

**Tasks:**

#### Phase 1: Graph Export Enhancement
- [ ] Extend `src/services/graphExport.ts`
  - `generateInteractiveHTML(notes: Note[], options: GraphOptions): string`
  - Embed D3.js force-directed graph (self-contained, no external deps)
  - Include note excerpts in data attributes
  - Support light/dark themes
  - Add zoom controls and node search

- [ ] Create `src/templates/graph-viewer.html`
  - Standalone HTML template with embedded JS/CSS
  - Mobile-responsive layout
  - Click node to show excerpt popup
  - Share button for social media

#### Phase 2: Publishing Service
- [ ] Extend `src/services/graphPublishing.ts` (already exists)
  - Verify Supabase tables exist (create if needed)
  - `publishGraph(userId, graphHTML, metadata): Promise<{ slug: string; url: string }>`
  - `getPublishedGraphs(userId): Promise<PublishedGraph[]>`
  - `unpublishGraph(slug): Promise<void>`
  - `incrementViewCount(slug): Promise<void>`

- [ ] Create Supabase migration for `published_graphs` table
  - Run SQL from `graphPublishing.ts` GRAPH_PUBLISHING_SQL constant

#### Phase 3: Publishing UI
- [ ] Extend `src/components/PublishGraphDialog.tsx` (already exists)
  - Add "Publish to Web" tab alongside "Download HTML"
  - Show preview of published URL
  - Tag selection for filtered publish
  - Theme selection

- [ ] Extend `src/components/PublishedGraphsManager.tsx` (already exists)
  - List published graphs with view counts
  - Copy URL button
  - Unpublish button
  - Link to analytics

#### Phase 4: Analytics Dashboard
- [ ] Create `src/components/GraphAnalytics.tsx`
  - View count over time chart
  - Most-clicked nodes list
  - Referrer breakdown
  - Geographic distribution (if available)

- [ ] Extend `src/services/graphPublishing.ts`
  - `getGraphAnalytics(slug): Promise<GraphAnalytics>`
  - Track node clicks via URL parameters

#### Phase 5: Public Graph Viewer
- [ ] Extend `src/pages/PublishedGraph.tsx` (already exists)
  - Serve published graph by slug
  - Inject analytics tracking
  - Show "Powered by PatchPad" footer with CTA

**Acceptance Criteria:**
- User can publish graph with custom slug
- Published graph is accessible at `/graphs/:userId/:slug`
- Visitors can interact with force-directed graph
- View count and click analytics tracked
- User can unpublish at any time

**Estimated Effort:** 24 hours

**New Infrastructure Required:**
- Supabase `published_graphs` and `graph_analytics` tables
- CDN for serving graph HTML (Supabase Storage or similar)

**Migration Notes:**
- No impact on existing notes
- Published graphs are read-only snapshots

---

### 3. Template Intelligence

**Goal:** Auto-detect note patterns, suggest templates, and enable AI-powered placeholder filling.

**Tasks:**

#### Phase 1: Pattern Detection Enhancement
- [ ] Extend `src/services/templateDetection.ts` (already exists)
  - `detectTitlePatterns(notes: Note[]): TitlePattern[]` — "Meeting:", "Research:", etc.
  - `detectStructurePatterns(notes: Note[]): StructurePattern[]` — Common header sequences
  - `suggestTemplateFromPatterns(patterns: Pattern[]): TemplateSuggestion`

- [ ] Add tests in `src/services/templateDetection.test.ts`

#### Phase 2: AI-Fillable Placeholders
- [ ] Extend `src/types/template.ts`
  - Add `placeholderType: 'text' | 'date' | 'ai-search' | 'ai-generate'`
  - `aiPrompt?: string` for custom generation instructions

- [ ] Extend `src/services/templates.ts` (already exists)
  - `fillAIPlaceholders(template: Template, context: Note[]): Promise<string>`
  - `{{ai:related_notes}}` → Semantic search and excerpt injection
  - `{{ai:summary}}` → Generate summary from context
  - `{{ai:questions}}` → Generate open questions

- [ ] Add tests for AI placeholder filling

#### Phase 3: Template Suggestion UI
- [ ] Create `src/components/TemplateSuggestionBanner.tsx`
  - Appears when pattern detected in notes
  - "We noticed you have 15 notes starting with 'Meeting:'. Create a template?"
  - Preview of detected structure
  - Accept/Dismiss buttons

- [ ] Add suggestion state to `src/App.tsx`
  - Check for patterns on app load (debounced)
  - Show banner if strong pattern detected

#### Phase 4: Enhanced Template Picker
- [ ] Extend `src/components/TemplatePicker.tsx` (already exists)
  - Show AI-fillable placeholders with lightning bolt icon
  - Preview of what AI will generate
  - Loading state during AI generation

- [ ] Create `src/components/TemplatePreviewPane.tsx`
  - Live preview of template with placeholders filled
  - Toggle between raw template and preview

**Acceptance Criteria:**
- App detects notes with similar titles/structures
- Suggestion banner appears when pattern is strong
- Templates can have `{{ai:...}}` placeholders
- AI fills placeholders based on semantic search and generation
- User sees preview before creating note

**Estimated Effort:** 24 hours

**New Infrastructure Required:**
- None (uses existing AI and embedding services)

**Migration Notes:**
- Existing templates remain compatible
- AI placeholders are optional enhancement

---

## Horizon 3: Blue Sky

*Reframes what PatchPad could become*

---

### 1. Ambient Knowledge Capture

**Goal:** Create a companion app that captures knowledge passively from clipboard, browser, and calendar.

**Tasks:**

#### Phase 1: Research & Architecture
- [ ] Evaluate framework options
  - Electron: Full desktop, largest bundle, mature ecosystem
  - Tauri: Rust-based, smaller bundle, newer
  - Document decision in `docs/architecture/ambient-capture.md`

- [ ] Design data sync protocol
  - How companion app communicates with main app
  - Options: Supabase real-time, local HTTP server, shared IndexedDB

- [ ] Define capture types
  - URL with auto-extracted metadata
  - Text selection with source URL
  - Screenshot with OCR (stretch)
  - Calendar event context

#### Phase 2: Companion App Shell (Electron)
- [ ] Initialize Electron project in `packages/patchpad-companion/`
  - `npm create electron-app@latest patchpad-companion`
  - Configure TypeScript and build pipeline

- [ ] Implement system tray icon
  - Tray icon with status indicator
  - Right-click menu: "New Note", "Search Notes", "Settings", "Quit"
  - Left-click: Open quick capture

- [ ] Implement quick capture window
  - Floating window with text input
  - Global keyboard shortcut (configurable)
  - Submit creates note in main app

#### Phase 3: Clipboard Monitoring
- [ ] Implement clipboard watcher
  - Detect URL copy → Toast "Save to notes?"
  - Detect long text copy → Toast "Create note?"
  - User can enable/disable in settings

- [ ] Implement URL metadata extraction
  - Fetch page title and description
  - Extract Open Graph metadata
  - Generate summary using AI (optional)

#### Phase 4: Browser Extension
- [ ] Create WebExtension in `packages/patchpad-extension/`
  - Manifest V3 for Chrome/Firefox compatibility

- [ ] Implement popup quick capture
  - Same UI as companion app
  - Pre-fill with current page URL

- [ ] Implement context menu integration
  - "Save to PatchPad" on right-click
  - Captures selected text + source URL

#### Phase 5: Calendar Integration
- [ ] Add Google Calendar OAuth in companion app
- [ ] Implement meeting prep notification
  - 15 minutes before meeting, search notes for attendee names
  - Generate brief using Research Partner API
  - Show notification with brief preview

**Acceptance Criteria:**
- Companion app runs in system tray
- Clipboard monitoring detects URLs and text
- Browser extension captures page content
- Calendar integration provides meeting prep
- All captures sync to main PatchPad app

**Estimated Effort:** 60+ hours

**Open Questions:**
- Which framework (Electron vs Tauri)?
- How to authenticate companion app with main app?
- Privacy boundaries for clipboard monitoring?
- Distribution: App stores vs direct download?

**Proof of Concept Scope:**
- Electron tray app with quick capture only
- No clipboard monitoring or calendar
- Local HTTP sync to running PatchPad instance

---

### 2. Knowledge Agents

**Goal:** Deploy three AI agents (Archivist, Researcher, Writer) that autonomously maintain and amplify the knowledge base.

**Tasks:**

#### Phase 1: Agent Dashboard
- [ ] Extend `src/components/AgentDashboard.tsx` (already exists)
  - Show all three agents with status indicators
  - "Run Now" button for each agent
  - Last run timestamp and results summary

- [ ] Create `src/components/AgentDashboard/AgentCard.tsx`
  - Agent name, description, icon
  - Status: idle, running, completed, error
  - Suggestion count badge

- [ ] Create `src/components/AgentDashboard/SuggestionList.tsx`
  - List of agent suggestions
  - Accept/Dismiss buttons
  - Batch actions: Accept All, Dismiss All

#### Phase 2: Archivist Agent Enhancement
- [ ] Extend `src/agents/archivist.ts` (path may vary)
  - `suggestConnections(notes: Note[]): ConnectionSuggestion[]` — Find notes that should link
  - `detectDuplicates(notes: Note[]): DuplicatePair[]` — Near-duplicate detection
  - `findContradictions(notes: Note[]): Contradiction[]` — Conflicting information

- [ ] Implement connection suggestion logic
  - Use embeddings for semantic similarity
  - Filter out already-connected notes
  - Confidence scoring based on similarity

#### Phase 3: Researcher Agent Enhancement
- [ ] Extend `src/agents/researcher.ts`
  - `createBriefing(topic: string, notes: Note[]): Briefing` — Synthesize knowledge
  - `findGaps(conversations: Conversation[]): KnowledgeGap[]` — From chat history
  - `monitorTopics(topics: string[]): TopicUpdate[]` — Track topic mentions

- [ ] Implement briefing generation
  - Gather relevant notes via semantic search
  - Generate structured summary with AI
  - Include citations and open questions

#### Phase 4: Writer Agent Enhancement
- [ ] Extend `src/agents/writer.ts`
  - `suggestOutline(notes: Note[], goal: string): Outline` — Document structure
  - `draftSection(outline: Outline, section: number): string` — Generate content
  - `refineText(text: string, instructions: string): string` — Improve writing

- [ ] Implement document generation workflow
  - User selects notes and goal
  - Agent proposes outline
  - User approves/edits outline
  - Agent drafts each section
  - User reviews and edits

#### Phase 5: Scheduling & Background Execution
- [ ] Create `src/services/agentScheduler.ts`
  - Schedule agents to run at specific times
  - Idle detection trigger (run when app idle for 30 min)
  - Store schedule in localStorage

- [ ] Implement background execution
  - Use Web Worker for non-blocking execution
  - Progress indicators in UI
  - Notification when complete

**Acceptance Criteria:**
- Dashboard shows all agents with run status
- Archivist finds connection suggestions with 80%+ accuracy
- Researcher generates useful briefings from notes
- Writer produces coherent outlines and drafts
- Agents can run on schedule or manual trigger
- Suggestions have one-click accept/dismiss

**Estimated Effort:** 40 hours

**Open Questions:**
- How to handle agent errors gracefully?
- Should agents have "budgets" (max API calls per run)?
- How to prevent suggestion overload?
- Should accepted suggestions be logged for learning?

**Proof of Concept Scope:**
- Archivist only with connection suggestions
- Manual trigger only (no scheduling)
- Simple accept/dismiss UI

---

## Moonshot: Externalized Cognition

**Goal:** Make thinking sessions first-class artifacts that can be replayed, analyzed, and shared.

---

### Phase 1: Foundation — Session Recording Infrastructure

**Goal:** Capture every user action on the canvas as a timestamped event stream.

**Tasks:**

- [ ] Extend `src/types/session.ts`
  - `interface ThinkingEvent { type: EventType; timestamp: number; payload: any }`
  - `type EventType = 'note-create' | 'note-move' | 'note-edit' | 'note-delete' | 'note-connect' | 'viewport-change' | 'ai-query' | 'ai-response'`
  - `interface ThinkingSession { id: string; startedAt: Date; endedAt: Date | null; events: ThinkingEvent[]; canvasSnapshot: CanvasSnapshot }`

- [ ] Extend `src/services/sessionRecorder.ts` (already exists)
  - Verify event capture for all event types
  - Add `recordEvent(event: ThinkingEvent): void` if missing
  - Implement event debouncing (100ms for rapid movements)
  - Periodic flush to IndexedDB (every 30 seconds)

- [ ] Add canvas instrumentation
  - Hook `saveNoteCanvasPosition` → record 'note-move'
  - Hook `createNote` → record 'note-create'
  - Hook wiki link insertion → record 'note-connect'
  - Hook viewport pan/zoom → record 'viewport-change'

- [ ] Extend database schema in `src/db/index.ts`
  - Add `sessions` table with `id`, `startedAt`, `endedAt`, `events`, `canvasSnapshot`
  - Version bump and migration

- [ ] Create recording UI
  - "Record Session" button in canvas toolbar
  - Recording indicator (red dot, timer)
  - "Stop Recording" button saves session

**Estimated Effort:** 16 hours

---

### Phase 2: Core Feature — Session Playback

**Goal:** Replay recorded sessions as animated visualizations with speed controls.

**Tasks:**

- [ ] Extend `src/services/sessionPlayback.ts` (already exists)
  - `class SessionPlayer { play(); pause(); seek(ms); setSpeed(multiplier); }`
  - Use `requestAnimationFrame` for smooth playback
  - Emit events for UI updates

- [ ] Extend `src/components/SessionPlayer.tsx` (already exists)
  - Playback controls: play, pause, 0.5x/1x/2x/4x speed
  - Timeline scrubber with event markers
  - Current time display

- [ ] Implement canvas replay renderer
  - Load initial `canvasSnapshot`
  - Apply events sequentially at recorded timestamps
  - Animate note movements (interpolate positions)
  - Visual effects for create/delete events

- [ ] Create AI conversation replay
  - When 'ai-query' event, show query in side panel
  - When 'ai-response' event, animate response appearing
  - Sync with canvas events

- [ ] Extend `src/components/SessionLibrary.tsx` (already exists)
  - Grid of past sessions with thumbnails
  - Session metadata: date, duration, note count
  - Search/filter by date range or keywords

**Estimated Effort:** 24 hours

---

### Phase 3: Full Vision — Analysis, Annotation, and Sharing

**Goal:** Add insights, annotations, and shareable exports to thinking sessions.

**Tasks:**

#### Annotation System
- [ ] Extend `src/types/session.ts`
  - `interface SessionAnnotation { id: string; timestamp: number; type: 'note' | 'highlight' | 'voice'; content: string; position?: { x, y } }`

- [ ] Extend `src/components/SessionAnnotation.tsx` (already exists)
  - Pause playback to add annotation
  - Position annotation at canvas location or timeline marker
  - Edit/delete annotations

- [ ] Create annotation markers on timeline
  - Small icons at annotation timestamps
  - Click to jump and view annotation

#### Insights & Analytics
- [ ] Extend `src/services/sessionInsights.ts` (already exists)
  - `getActivityHeatmap(session): HeatmapData` — Where did user spend time?
  - `findBreakthroughs(session): Breakthrough[]` — Pause followed by activity burst
  - `getRevisitedNotes(session): NoteVisit[]` — Notes opened multiple times
  - `generateSummary(session): string` — AI-powered summary of thinking process

- [ ] Extend `src/components/SessionInsights.tsx` (already exists)
  - Heatmap overlay on canvas replay
  - Breakthrough moments highlighted on timeline
  - Stats panel: duration, notes created, connections made

#### Sharing & Export
- [ ] Extend `src/services/sessionExport.ts` (already exists)
  - `exportSessionHTML(session): string` — Self-contained viewer
  - Include replay controls and annotations
  - Viewer-only mode (no editing)

- [ ] Create shareable session page
  - Route `/session/:id` for shared sessions
  - Embed code for external sites
  - Privacy controls: public, unlisted, private

#### Collaborative Annotation
- [ ] Extend `src/services/collaborativeAnnotations.ts` (already exists)
  - Multiple users can annotate same session
  - Color-coded by author
  - Reply threads on annotations

- [ ] Extend `src/components/CollaborativeAnnotations.tsx` (already exists)
  - Show annotations from all contributors
  - Filter by author
  - Annotation conversation threads

**Estimated Effort:** 40 hours

**Total Moonshot Effort:** 80 hours

---

## Suggested Starting Point

### Recommended First Task: **Second Brain Dashboard**

**Why start here:**

1. **Immediate user value**: Replaces blank slate with personalized insights on every app open
2. **Uses existing infrastructure**: `semanticSearch.ts`, `brain.ts`, `dashboardAnalytics.ts` already exist
3. **Low technical risk**: No new dependencies or database migrations
4. **Foundation for agents**: The "Brewing Ideas" section is a lightweight Archivist agent preview
5. **Validates vision**: If users engage with suggestions, it confirms demand for automated knowledge maintenance

**What it unblocks:**
- Establishes pattern for surfacing AI insights in UI
- Creates reusable analytics service for other features
- Provides engagement metrics to prioritize roadmap
- Natural place to add "Run Archivist" button for agent experiment

**First work session (4 hours):**
1. Create dashboard shell component with three sections
2. Implement `getEditingStreak()` and `getMostActiveNotes()` in analytics service
3. Wire greeting section with real data
4. Add command palette entry

---

## Quick Reference

| Feature | File(s) | Effort | Status |
|---------|---------|--------|--------|
| Second Brain Dashboard | `src/components/SecondBrainDashboard/` | 8h | Ready |
| Thinking Timeline | `src/components/ThinkingTimeline/` | 10h | Ready |
| Conversation Insights | `src/components/ConversationInsights/` | 10h | Ready |
| Live Collaborative Canvases | `src/services/collaboration.ts`, multiple components | 40h | Infra exists |
| Knowledge Graph Publishing | `src/services/graphPublishing.ts` | 24h | Partially built |
| Template Intelligence | `src/services/templates.ts` | 24h | Partially built |
| Ambient Knowledge Capture | `packages/patchpad-companion/` | 60h+ | New project |
| Knowledge Agents | `src/agents/`, `src/components/AgentDashboard.tsx` | 40h | Framework exists |
| Moonshot Phase 1 | `src/services/sessionRecorder.ts` | 16h | Partially built |
| Moonshot Phase 2 | `src/services/sessionPlayback.ts` | 24h | Partially built |
| Moonshot Phase 3 | Multiple services and components | 40h | Types defined |
