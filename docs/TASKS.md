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

## Horizon 1: Quick Wins - COMPLETE

*Buildable in days, using existing infrastructure*

> **Status:** All Horizon 1 features have been implemented.

---

### 1. Second Brain Dashboard - COMPLETE

**Goal:** Replace the blank-slate experience with a personalized knowledge overview that surfaces insights automatically on app load.

**Implementation Summary:**
- Modular component architecture with `index.tsx`, `GreetingSection.tsx`, `BrewingIdeasSection.tsx`, `FadingMemoriesSection.tsx`
- New `dashboardInsights.ts` service with full analytics capabilities
- 27 unit tests in `dashboardInsights.test.ts`
- Integrated with command palette (Ctrl+Shift+B) and "Show on startup" persistence

**Tasks:** All complete

#### Phase 1: Dashboard Shell
- [x] Create `src/components/SecondBrainDashboard/index.tsx` — Main dashboard component
- [x] Create `src/components/SecondBrainDashboard/GreetingSection.tsx`
- [x] Create `src/components/SecondBrainDashboard/BrewingIdeasSection.tsx`
- [x] Create `src/components/SecondBrainDashboard/FadingMemoriesSection.tsx`

#### Phase 2: Analytics Service
- [x] Create `src/services/dashboardInsights.ts`
- [x] Add tests in `src/services/dashboardInsights.test.ts`

#### Phase 3: Integration
- [x] Add dashboard toggle state to `src/App.tsx`
- [x] Add command palette entry
- [x] Add "Show on startup" toggle in dashboard footer

**Completed:** January 2026

---

### 2. Thinking Timeline - COMPLETE

**Goal:** Add a chronological view that groups notes into "thinking sessions" based on temporal proximity.

**Implementation Summary:**
- `src/services/thinkingSession.ts` provides session clustering (with tests)
- `src/components/Timeline/` directory with `TimelineView.tsx`, `TimelineCluster.tsx`, `TimelineDateMarker.tsx`
- Integrated into App.tsx with tab bar, command palette, and view state
- Configurable gap threshold slider (15-180 min)

**Tasks:** All complete

#### Phase 1: Session Clustering
- [x] `src/services/thinkingSession.ts` with clustering logic
- [x] `src/services/thinkingSession.test.ts` with tests

#### Phase 2: Timeline UI
- [x] `src/components/Timeline/TimelineView.tsx` - Main timeline view
- [x] `src/components/Timeline/TimelineCluster.tsx` - Expandable cluster cards
- [x] `src/components/Timeline/TimelineDateMarker.tsx` - Sticky date headers

#### Phase 3: Integration
- [x] `mainView` state includes 'timeline' option
- [x] Tab bar with Timeline button
- [x] Command palette entry for timeline view
- [x] Canvas highlight mode for selected clusters

**Completed:** Pre-existing implementation

---

### 3. Conversation Insights - COMPLETE

**Goal:** Surface patterns from Research Partner usage—top questions, topics, and knowledge gaps.

**Implementation Summary:**
- `src/services/conversationInsights.ts` provides full analytics (with tests)
- `src/components/ResearchPartner/InsightsPanel.tsx` with 4 tabs: Questions, Topics, Gaps, Activity
- Brief generation from topics with AI
- Activity sparkline visualization for last 30 days
- Integrated into ChatInterface as slide-out panel

**Tasks:** All complete

#### Phase 1: Insights Analysis
- [x] `src/services/conversationInsights.ts` with all analytics functions
- [x] `src/services/conversationInsights.test.ts` with tests

#### Phase 2: Insights Panel UI
- [x] `src/components/ResearchPartner/InsightsPanel.tsx` - Full panel with tabs
- [x] QuestionCard component with frequency badges and conversation links
- [x] TopicCard component with bar chart visualization
- [x] GapCard component with "View conversation" action
- [x] Activity tab with sparkline and daily breakdown

#### Phase 3: Integration
- [x] Insights toggle in Research Partner interface
- [x] "Create Brief" button generates AI-powered topic briefs

**Completed:** Pre-existing implementation

---

## Horizon 2: System Expansions

*Requires new infrastructure, buildable in weeks*

---

### 1. Live Collaborative Canvases

**Goal:** Enable Google Docs-style real-time collaboration on canvases with presence, cursors, and chat.

**Tasks:**

#### Phase 1: Collaboration Mode Toggle - COMPLETE
- [x] Add collaboration state to `src/App.tsx`
  - `const [collaborationMode, setCollaborationMode] = useState(false)`
  - `const [collaborationRoomId, setCollaborationRoomId] = useState<string | null>(null)`
  - `const [collaborationControlsOpen, setCollaborationControlsOpen] = useState(false)`
  - Added command palette entry and Ctrl+Shift+C shortcut

- [x] Create `src/components/CollaborationControls.tsx`
  - "Start Collaboration" button generates room ID
  - "Join Collaboration" input for room ID
  - Display shareable link and room ID
  - "End Collaboration" button
  - Peer list with avatars and colors

- [x] Extend `src/services/collaboration.ts`
  - `createRoom(userId: string): string` — Generate room ID, connect Yjs
  - `joinRoom(roomId: string, userId: string): boolean`
  - `leaveRoom(): void`
  - Added: `getCurrentRoomId()`, `isInRoom()`, `isRoomConnected()`
  - Added: `getRoomPeers()`, `updateRoomCursor()`
  - Added: `onRoomPeersChange()`, `onRoomConnectionChange()`
  - Added: `getRoomDoc()`, `getRoomCanvasPositions()`

#### Phase 2: Presence Awareness - COMPLETE
- [x] Wire `src/components/PresenceIndicator.tsx` to show collaborators
  - Connected to collaboration state in App.tsx
  - Shows avatar circles with initials in canvas toolbar
  - Tooltip shows full name, connection status indicator

- [x] Wire `src/components/RemoteCursor.tsx` to render peer cursors
  - Integrated into Editor.tsx with getPositionFromCoords helper
  - Smooth animation on cursor move via CSS transitions

- [x] Wire `src/components/RemoteSelection.tsx` for text selections
  - Integrated into Editor.tsx with getRangeRects helper
  - Highlights peer selections with their assigned color

- [x] Update `src/hooks/useCollaboration.ts`
  - Already supports cursor/selection broadcasting via setCursor/setSelection
  - Room-level collaboration uses direct functions from collaboration.ts
  - Peer connect/disconnect handled via onRoomPeersChange subscription

#### Phase 3: Collaborative Canvas - COMPLETE
- [x] Extend `src/components/Canvas/CanvasView.tsx`
  - Accept `collaborationMode: boolean` prop (already done in Phase 2)
  - Sync note positions via Yjs Y.Map on drag end and resize
  - Show remote cursors on canvas with `RemoteCanvasCursors` component
  - Track and broadcast mouse position via awareness

- [x] Create `src/components/Canvas/RemoteCanvasCursor.tsx`
  - Render peer cursor on canvas with name label
  - Arrow/pointer icon styled differently from editor cursor
  - Transforms canvas coordinates to screen position using viewport

- [x] Add canvas-level Yjs bindings in `src/services/collaboration.ts`
  - `syncNotePosition(noteId: string, position: CanvasPosition): void`
  - `onRemotePositionChange(callback: (noteId, position) => void): unsubscribe`
  - `getNotePosition(noteId: string): CanvasPosition | null`
  - `getAllPositions(): Map<string, CanvasPosition>`
  - `getRoomPeersWithCanvasPositions(): PeerWithCanvasPosition[]`

#### Phase 4: Collaboration Chat - COMPLETE
- [x] Create `src/components/CollaborationChat.tsx`
  - Sidebar panel with message list
  - Input for new messages
  - Show sender name and timestamp
  - Store in Yjs Y.Array for real-time sync

- [x] Add chat toggle button to canvas toolbar

#### Phase 5: Session Recording for Collaborative Sessions - COMPLETE
- [x] Extend `src/services/sessionRecorder.ts`
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

#### Phase 1: Graph Export Enhancement - COMPLETE
- [x] Extend `src/services/graphExport.ts`
  - `generateInteractiveHTML(notes: Note[], options: GraphOptions): string`
  - Embed D3.js force-directed graph (self-contained, no external deps)
  - Include note excerpts in data attributes
  - Support light/dark themes
  - Add zoom controls and node search

- [x] Create `src/templates/graph-viewer.html` (embedded in graphExport.ts for dynamic generation)
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

## Suggested Next Steps

### Now that Horizon 1 is complete, the recommended next tasks are:

#### 1. Live Collaborative Canvases (40h)
The Yjs infrastructure exists (`collaboration.ts`, `useCollaboration.ts`, presence components). What's needed:
- Wire CollaborationControls UI component
- Connect remote cursors to canvas view
- Add collaboration chat panel
- Test with y-websocket demo server

#### 2. Knowledge Graph Publishing Enhancement (24h)
The publishing service exists (`graphPublishing.ts`). What's needed:
- GraphAnalytics component for view tracking
- Enhanced publishing UI with preview
- Supabase table migration script

#### 3. Template Intelligence (24h)
The template service exists (`templates.ts`). What's needed:
- Pattern detection for template suggestions
- AI placeholder filling (`{{ai:related_notes}}`)
- TemplateSuggestionBanner component

### Quick Win Opportunities

The "Brewing Ideas" section in SecondBrainDashboard is essentially a lightweight Archivist agent. Consider:
- Add "Run Archivist" button to dashboard
- Track accept/dismiss rate for suggestions
- Use data to validate agent investment

---

## Quick Reference

| Feature | File(s) | Effort | Status |
|---------|---------|--------|--------|
| Second Brain Dashboard | `src/components/SecondBrainDashboard/` | 8h | **COMPLETE** |
| Thinking Timeline | `src/components/Timeline/` | 10h | **COMPLETE** |
| Conversation Insights | `src/components/ResearchPartner/InsightsPanel.tsx` | 10h | **COMPLETE** |
| Live Collaborative Canvases | `src/services/collaboration.ts`, multiple components | 40h | Infra exists |
| Knowledge Graph Publishing | `src/services/graphPublishing.ts` | 24h | Partially built |
| Template Intelligence | `src/services/templates.ts` | 24h | Partially built |
| Ambient Knowledge Capture | `packages/patchpad-companion/` | 60h+ | New project |
| Knowledge Agents | `src/agents/`, `src/components/AgentDashboard.tsx` | 40h | Framework exists |
| Moonshot Phase 1 | `src/services/sessionRecorder.ts` | 16h | Partially built |
| Moonshot Phase 2 | `src/services/sessionPlayback.ts` | 24h | Partially built |
| Moonshot Phase 3 | Multiple services and components | 40h | Types defined |

---

## Implementation Progress

**Horizon 1 (Quick Wins):** 3/3 complete - All features implemented and tested
**Horizon 2 (System Expansions):** Infrastructure exists, integration work remaining
**Horizon 3 (Blue Sky):** Architecture defined, new projects required
**Moonshot:** Core infrastructure in place, enhancement opportunities remain
