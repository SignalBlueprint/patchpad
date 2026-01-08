---
repo: patchpad
source: VISION.md
generated: 2026-01-07
status: draft
---

# PatchPad Task Breakdown

## Overview

PatchPad has evolved from an AI-enhanced markdown editor into a personal knowledge operating system with voice capture, canvas visualization, semantic search, and conversational AI. This task list breaks down the next phase of development: surfacing intelligence from existing data (Horizon 1), building collaborative infrastructure (Horizon 2), and exploring transformational directions (Horizon 3). The foundation is solid - now we build the features that make PatchPad indispensable.

---

## Horizon 1: Quick Wins

*Buildable in days, using existing infrastructure*

---

### 1. Second Brain Dashboard

**Goal:** Replace the blank slate with a personalized knowledge overview that surfaces insights from user data automatically.

**Tasks:**

#### Phase 1: Core Dashboard Component

- [x] Create `src/components/SecondBrainDashboard.tsx`
  - [x] Accept props: `notes: Note[]`, `concepts: Concept[]`, `onNavigateToNote: (id: string) => void`, `onConnectNotes: (noteId, targetTitle) => void`, `onClose: () => void`
  - [x] Use glass-morphism styling consistent with existing modals (reference `DailyDigestModal.tsx` for patterns)
  - [x] Layout: 2-column responsive grid (md:grid-cols-2)

- [x] Create greeting section (top center)
  - [x] Time-based greeting: "Good morning/afternoon/evening"
  - [x] Show most-edited note titles from last 7 days (query by `updatedAt`)
  - [x] Calculate editing streak: consecutive days with note updates

- [x] Create "Brewing Ideas" section (left column)
  - [x] Query notes with no outgoing wiki links: `notes.filter(n => !n.content.includes('[['))`
  - [x] Filter to notes updated in last 14 days
  - [x] For each, call `findRelatedNotes()` from `src/services/ai.ts` to suggest connections
  - [x] Display as cards with "Connect to..." suggestion button
  - [x] On click, insert `[[suggested title]]` at end of note content

- [x] Create "Fading Memories" section (right column)
  - [x] Query notes not updated in 90+ days: `notes.filter(n => daysSince(n.updatedAt) > 90)`
  - [x] Cross-reference with recent concepts using `extractConcepts()` from `src/services/brain.ts`
  - [x] Show notes that mention concepts you've written about recently
  - [x] Display as cards with "Revisit" button that navigates to note

#### Phase 2: Data Analysis Services

- [x] Create `src/services/dashboardAnalytics.ts`
  - [x] Export function `getMostEditedNotes(notes: Note[], days: number): Note[]`
    - Sort by edit frequency (count updates within date range)
    - Return top 5
  - [x] Export function `getUnconnectedNotes(notes: Note[]): Note[]`
    - Parse content for `[[...]]` patterns
    - Return notes with zero outgoing links
  - [x] Export function `getFadingNotes(notes: Note[], concepts: Concept[]): FadingNote[]`
    - Filter notes older than 90 days
    - Match against recent concept mentions
    - Return with relevance score
  - [x] Export function `getEditingStreak(notes: Note[]): number`
    - Count consecutive days with at least one note update
    - Start from today, work backwards

- [x] Add tests in `src/services/dashboardAnalytics.test.ts`
  - [x] Test: getMostEditedNotes returns correct order
  - [x] Test: getUnconnectedNotes ignores notes with links
  - [x] Test: getFadingNotes cross-references concepts correctly
  - [x] Test: getEditingStreak handles gaps

#### Phase 3: Integration

- [x] Add dashboard state to `src/App.tsx`
  ```typescript
  const [secondBrainOpen, setSecondBrainOpen] = useState(false);
  ```

- [x] Add command palette entry in `App.tsx` commands array
  ```typescript
  {
    id: 'second-brain',
    name: 'Second Brain Dashboard',
    description: 'View knowledge insights',
    category: 'view',
    shortcut: 'Ctrl+Shift+B',
    action: () => setSecondBrainOpen(true),
  }
  ```

- [x] Register keyboard shortcut in `useEffect` keyboard handler
  - [x] `Ctrl+Shift+B` → `setSecondBrainOpen(true)`
  - [x] Note: This replaces existing brain dashboard shortcut - update `knowledge-brain` command

- [x] Add localStorage preference for auto-show on login
  - [x] Key: `patchpad_show_dashboard_on_load`
  - [x] Toggle in dashboard footer: "Show on startup"

**Acceptance Criteria:**
- Dashboard opens via Ctrl+Shift+B or command palette
- Shows personalized greeting with recent activity summary
- "Brewing Ideas" suggests at least one connection for unlinked notes
- "Fading Memories" surfaces relevant old notes
- Clicking "Connect" adds wiki link to note
- Dashboard preference persists across sessions

**Estimated Effort:** 8 hours

**Dependencies:** None - uses existing `brain.ts` and `ai.ts` services

---

### 2. Thinking Timeline

**Goal:** Add a chronological view that groups notes by "thinking sessions" - clusters of related work within short time windows.

**Tasks:**

#### Phase 1: Timeline View Component

- [x] Create `src/components/Timeline/TimelineView.tsx`
  - [x] Accept props: `notes: Note[]`, `onSelectNote: (id: string) => void`, `onSelectCluster: (ids: string[]) => void`
  - [x] Vertical scrolling timeline with date markers
  - [x] Use glass-morphism card styling for clusters
  - [x] Session gap threshold slider (15-180 min)
  - [x] Stats header (total sessions, avg notes/session, largest session)

- [x] Create `src/components/Timeline/TimelineCluster.tsx`
  - [x] Render group of notes created within same "session"
  - [x] Show: date/time range, note count, common tags, topic summary
  - [x] Expandable to show individual note titles
  - [x] Click cluster → highlight all notes on canvas (if canvas data exists)
  - [x] AI-generated or fallback summary

- [x] Create `src/components/Timeline/TimelineDateMarker.tsx`
  - [x] Sticky date header as user scrolls
  - [x] Format: "Today", "Yesterday", or "Monday, January 6, 2026"

#### Phase 2: Session Clustering Service

- [x] Create `src/services/thinkingSession.ts`
  - [x] Export interface `ThinkingSession { id, startTime, endTime, noteIds, topics, summary }`
  - [x] Export function `clusterIntoSessions(notes: Note[], maxGapMinutes: number = 60): ThinkingSession[]`
    - Sort notes by createdAt
    - Group notes created within `maxGapMinutes` of each other
    - Minimum cluster size: 1 note (solo notes are their own session)
  - [x] Export function `extractSessionTopics(session: ThinkingSession, notes: Note[]): string[]`
    - Use `extractConcepts()` from brain.ts on session notes
    - Return top 3 shared concepts
  - [x] Export async function `generateSessionSummary(session: ThinkingSession, notes: Note[]): Promise<string>`
    - Concatenate note titles and first 100 chars
    - If AI available, generate one-sentence summary
    - Fallback: "X notes about [top concept]"
  - [x] Export helper functions: formatSessionDuration, formatSessionTimeRange, groupSessionsByDate, formatDateHeader

- [x] Add tests in `src/services/thinkingSession.test.ts`
  - [x] Test: notes 30 min apart cluster together
  - [x] Test: notes 2 hours apart form separate clusters
  - [x] Test: solo notes form single-note sessions
  - [x] Test: tag extraction finds common tags
  - [x] Test: formatSessionDuration handles various durations
  - [x] Test: groupSessionsByDate groups correctly

#### Phase 3: Integration with Main App

- [x] Update `mainView` type in `src/App.tsx`
  ```typescript
  const [mainView, setMainView] = useState<'notes' | 'canvas' | 'graph' | 'timeline'>('notes');
  ```

- [x] Add Timeline tab button to tab bar (after Graph tab)

- [x] Add conditional render in main content area

- [x] Add command palette entry `view-timeline`

#### Phase 4: Canvas Integration

- [x] Add "View on Canvas" button to TimelineCluster
  - [x] On click, switch to canvas view
  - [x] Store session data for canvas overlay via localStorage `patchpad_timeline_highlight`

**Acceptance Criteria:**
- Timeline view accessible via tab bar and command palette
- Notes grouped into thinking sessions by time proximity
- Each session shows time range, note count, and topic summary
- Clicking session highlights notes on canvas
- Solo notes appear as single-note sessions
- Smooth scrolling with sticky date headers

**Estimated Effort:** 10 hours

**Dependencies:** None - builds on existing canvas infrastructure

---

### 3. Conversation Insights

**Goal:** Surface patterns from AI Research Partner usage - what questions users ask most, knowledge gaps, and conversation trends.

**Tasks:**

#### Phase 1: Insights Analysis Service

- [x] Create `src/services/conversationInsights.ts`
  - [x] Export interface `ConversationInsights { topQuestions, topTopics, knowledgeGaps, questionCount, avgResponseTime }`
  - [x] Export async function `analyzeConversations(conversations: Conversation[]): ConversationInsights`
  - [x] Export function `getTopQuestions(conversations: Conversation[], limit: number = 10): QuestionSummary[]`
    - Extract user messages (role === 'user')
    - Group similar questions using simple keyword matching
    - Return with frequency count
  - [x] Export function `getTopTopics(conversations: Conversation[]): TopicCount[]`
    - Extract topics from user messages using `extractConcepts()`
    - Aggregate across all conversations
    - Return sorted by frequency
  - [x] Export function `getKnowledgeGaps(conversations: Conversation[]): KnowledgeGap[]`
    - Find AI responses containing phrases like "I don't have information", "your notes don't mention", "I couldn't find"
    - Extract the topic/question that caused the gap
    - Return unique gaps with conversation references

- [x] Add tests in `src/services/conversationInsights.test.ts`
  - [x] Test: topQuestions aggregates similar questions
  - [x] Test: topTopics extracts concepts correctly
  - [x] Test: knowledgeGaps detects "no information" responses

#### Phase 2: Insights Panel Component

- [x] Create `src/components/ResearchPartner/InsightsPanel.tsx`
  - [x] Accept props: `conversations: Conversation[]`, `onCreateNote: (content: string, title: string) => void`
  - [x] Collapsible panel in ChatInterface (right sidebar or bottom drawer)
  - [x] Tab navigation: "Top Questions" | "Topics" | "Gaps"

- [x] Implement "Top Questions" tab
  - [x] List questions with frequency badges
  - [x] Click question → scroll to original conversation
  - [x] "Create Brief" button → synthesize answer into new note

- [x] Implement "Topics" tab
  - [x] Tag cloud or bar chart of most-discussed topics
  - [x] Click topic → filter conversations to those mentioning it
  - [x] Show trend: "You've asked about X 15 times this month"

- [x] Implement "Knowledge Gaps" tab
  - [x] List topics where AI couldn't find information
  - [x] "Create Note" button → creates empty note with topic as title
  - [x] "Research" button → opens web search (if available)

#### Phase 3: Quick Brief Generation

- [x] Add `generateInsightBrief()` to `src/services/researchPartner.ts`
  ```typescript
  async function generateInsightBrief(topic: string, conversations: Conversation[]): Promise<string>
  ```
  - Filter conversations mentioning topic
  - Extract all AI responses about topic
  - Synthesize into cohesive brief
  - Include citations to original conversations

- [x] Add "Create Brief from Questions" action
  - [x] In InsightsPanel, button on frequently-asked topics
  - [x] Calls `generateInsightBrief()` then `createNote()`
  - [x] Auto-tags note with "insight-brief"

#### Phase 4: Integration

- [x] Add insights toggle to ChatInterface
  - [x] Button in header: "Insights" with icon
  - [x] Toggle `insightsPanelOpen` state
  - [x] Panel slides in from right

- [x] Load conversations on mount
  - [x] Use `getAllConversations()` from researchPartner.ts
  - [x] Cache analysis results (recompute on new conversation)

- [x] Add command palette entry
  ```typescript
  { id: 'conversation-insights', name: 'Conversation Insights', category: 'ai', action: () => { setResearchPartnerOpen(true); /* trigger insights panel */ } }
  ```

**Acceptance Criteria:**
- Insights panel accessible from Research Partner interface
- Shows top 10 most-asked questions with frequency
- Shows topic frequency as visual chart
- Lists knowledge gaps with actionable "Create Note" buttons
- "Create Brief" generates note summarizing topic across conversations
- Brief includes citations to source conversations

**Estimated Effort:** 10 hours

**Dependencies:** Research Partner must have conversation history (already implemented)

---

## Horizon 2: System Expansions

*Requires new infrastructure, buildable in weeks*

---

### 1. Real-time Collaboration

**Goal:** Enable Google Docs-style real-time editing with cursor presence and live sync using Yjs CRDTs.

**Tasks:**

#### Phase 1: Shareable Links (Validation Experiment)

- [x] Update Supabase schema - add columns to notes table
  ```sql
  ALTER TABLE notes ADD COLUMN shared BOOLEAN DEFAULT FALSE;
  ALTER TABLE notes ADD COLUMN share_token UUID;
  ALTER TABLE notes ADD COLUMN share_view_count INTEGER DEFAULT 0;
  CREATE INDEX idx_notes_share_token ON notes(share_token);
  ```

- [x] Update `src/config/supabase.ts` - extend Note type
  ```typescript
  interface SupabaseNote {
    // ... existing fields
    shared: boolean;
    share_token: string | null;
    share_view_count: number;
  }
  ```

- [x] Create `src/services/sharing.ts`
  - [x] Export async function `generateShareLink(noteId: string): Promise<string>`
    - Generate UUID for share_token
    - Update note in Supabase with `shared: true, share_token: token`
    - Return URL: `${window.location.origin}/shared/${token}`
  - [x] Export async function `getSharedNote(token: string): Promise<Note | null>`
    - Query Supabase by share_token
    - Return null if not found or `shared: false`
  - [x] Export async function `revokeShareLink(noteId: string): Promise<void>`
    - Set `shared: false, share_token: null`

- [x] Create `src/components/ShareNoteDialog.tsx`
  - [x] Accept props: `noteId: string`, `isOpen: boolean`, `onClose: () => void`
  - [x] Show toggle: "Enable sharing"
  - [x] Display generated link with copy button
  - [x] "Revoke" button to disable sharing
  - [x] Analytics display: view count

- [x] Create `src/pages/SharedNote.tsx` (or route handler)
  - [x] Parse `share_token` from URL
  - [x] Fetch note via `getSharedNote()`
  - [x] Render read-only markdown view using `MarkdownPreview.tsx`
  - [x] Show "Open in PatchPad" prompt for non-users
  - [x] 404 page for invalid/revoked tokens

- [x] Add routing for `/shared/:token`
  - [x] Update `src/main.tsx` with BrowserRouter
  - [x] SharedNoteRoute wrapper component

- [x] Add "Share" button to Editor toolbar
  - [x] Icon: share/link icon
  - [x] Opens ShareNoteDialog
  - [x] Only visible when sync is enabled

- [x] Track sharing analytics
  - [x] Log share creation events to localStorage
  - [x] Log share view events (increment counter in Supabase)
  - [x] Key: `patchpad_share_analytics`

**Acceptance Criteria:**
- "Share" button generates unique URL
- Anyone with URL can view note (read-only)
- Note owner can revoke link
- Invalid tokens show 404
- Share events logged for validation metrics

**Estimated Effort:** 8 hours

**New Infrastructure Required:**
- Supabase schema update (2 columns)
- Client-side routing for `/shared/:token`

**Migration Notes:**
- Existing notes get `shared: false, share_token: null` by default
- No breaking changes

---

#### Phase 2: Yjs CRDT Integration

- [x] Install Yjs dependencies
  ```bash
  npm install yjs y-indexeddb y-websocket y-codemirror.next
  ```

- [x] Create `src/services/collaboration.ts`
  - [x] Export function `createYDoc(noteId: string): Y.Doc`
    - Initialize Y.Doc with shared text type
    - Enable IndexedDB persistence via `y-indexeddb`
  - [x] Export function `connectToRoom(doc: Y.Doc, noteId: string): WebsocketProvider`
    - Connect to Supabase Realtime or y-websocket server
    - Room name: `note-${noteId}`
  - [x] Export function `syncDocToNote(doc: Y.Doc, noteId: string): void`
    - Watch Y.Doc changes
    - Debounced write to local DB + Supabase
  - [x] Export function `disconnectFromRoom(provider: WebsocketProvider): void`

- [x] Create `src/hooks/useCollaboration.ts`
  ```typescript
  function useCollaboration(noteId: string | null, isShared: boolean) {
    const [doc, setDoc] = useState<Y.Doc | null>(null);
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [peers, setPeers] = useState<Peer[]>([]);
    // ... setup and cleanup logic
    return { doc, peers, isConnected };
  }
  ```

- [x] Integrate Yjs with CodeMirror via `src/components/CollaborativeEditor.tsx`
  - [x] Import `y-codemirror.next` extension
  - [x] Bind Y.Text to CodeMirror state
  - [x] Handle remote updates
  - [x] Reference: https://codemirror.net/examples/collab/

- [x] Set up WebSocket infrastructure
  - [x] Option A: Supabase Realtime Channels (simpler, managed)
  - [x] Option B: Self-hosted y-websocket server (more control)
  - [x] Default to yjs.dev demo server for development
  - [x] Document choice via `VITE_YJS_WEBSOCKET_URL` environment variable

**Estimated Effort:** 16 hours

---

#### Phase 3: Presence & Awareness

- [x] Extend `useCollaboration.ts` with awareness
  ```typescript
  interface Peer {
    id: string;
    name: string;
    color: string;
    cursor?: { line: number; ch: number };
    selection?: { from: number; to: number };
  }
  ```

- [x] Create `src/components/RemoteCursor.tsx`
  - [x] Render colored cursor at peer's position
  - [x] Show peer name label above cursor
  - [x] Animate cursor movement (name label fades after 2s)

- [x] Create `src/components/RemoteSelection.tsx`
  - [x] Highlight peer's text selection in their color
  - [x] Semi-transparent overlay on selected range

- [x] Create `src/components/PresenceIndicator.tsx`
  - [x] Show avatars/initials of users viewing note
  - [x] Display in Editor header
  - [x] Tooltip with full names
  - [x] "+N" badge for overflow peers

- [x] Add color assignment logic
  - [x] Palette: `['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9']`
  - [x] Assign by deterministic hash of user ID
  - [x] Persist user color in awareness state

- [x] Broadcast local state
  - [x] On cursor move, broadcast position via awareness protocol
  - [x] On selection change, broadcast selection range
  - [x] Integrated with CollaborativeEditor component

**Estimated Effort:** 12 hours

---

#### Phase 4: Collaborative Features

- [x] Create `src/components/CommentThread.tsx`
  - [x] Inline comments anchored to text positions
  - [x] Thread UI: original text, comments, reply input
  - [x] Store in Supabase `comments` table

- [x] Create comments table in Supabase
  ```sql
  CREATE TABLE comments (
    id UUID PRIMARY KEY,
    note_id UUID REFERENCES notes(id),
    user_id UUID REFERENCES auth.users(id),
    from_pos INTEGER,
    to_pos INTEGER,
    content TEXT,
    parent_id UUID REFERENCES comments(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] Add version history
  - [x] Store snapshots on significant changes (every 100 chars or 5 minutes)
  - [x] Create `note_versions` table
  - [x] UI to browse and restore versions

- [x] Add "Follow" mode
  - [x] Button: "Follow [peer name]"
  - [x] Auto-scroll to peer's cursor position
  - [x] Disable on manual scroll

**Estimated Effort:** 20 hours

**New Infrastructure Required:**
- WebSocket server (Supabase Realtime or y-websocket)
- Supabase tables: `comments`, `note_versions`
- Y.js persistence layer

**Migration Notes:**
- Existing notes continue working offline
- Collaboration is opt-in (only for shared notes)
- Local-first: changes sync when online

**Acceptance Criteria:**
- Two users can edit same note simultaneously
- Cursor positions visible in real-time
- Text selections highlighted with user colors
- Changes merge without conflicts
- Offline edits sync on reconnect

**Total Estimated Effort:** 56 hours (across all phases)

**Dependencies:** Supabase project, WebSocket infrastructure

---

### 2. Knowledge Graph Publishing

**Goal:** Export interactive knowledge graphs as shareable web pages or self-contained HTML files.

**Tasks:**

#### Phase 1: Static Export

- [x] Create `src/services/graphExport.ts`
  - [x] Export interface `GraphExportOptions { theme, includeContent, nodeLimit, selectedTags }`
  - [x] Export function `generateGraphHTML(notes: Note[], options: GraphExportOptions): string`
    - Build D3.js force-directed graph
    - Embed minified visualization code
    - Include note excerpts in data
    - Self-contained HTML (no external dependencies)
  - [x] Export function `generateGraphData(notes: Note[]): GraphData`
    - Parse wiki links for edges
    - Build nodes with { id, title, tags, excerpt }
    - Build edges with { source, target }

- [x] Create D3 visualization template
  - [x] Reference existing `KnowledgeGraph.tsx` for layout logic
  - [x] Implement in vanilla JS for portability
  - [x] Features: zoom, pan, node click → show excerpt
  - [x] Minify and inline in export

- [x] Add export options
  - [x] Theme: 'light' | 'dark'
  - [x] Content: 'full' | 'excerpts' | 'titles-only'
  - [x] Node limit: number (for large graphs)
  - [x] Tag filter: string[] (only include notes with tags)

- [x] Create `src/components/PublishGraphDialog.tsx`
  - [x] Accept props: `notes: Note[]`, `isOpen: boolean`, `onClose: () => void`
  - [x] Preview pane showing graph render
  - [x] Options form: theme, content level, tag filter
  - [x] "Download HTML" button
  - [x] "Copy embed code" button (iframe snippet)

- [x] Add to BrainDashboard
  - [x] "Publish Graph" button in header
  - [x] Opens PublishGraphDialog

**Acceptance Criteria:**
- One-click export to standalone HTML file
- Graph renders in modern browsers without internet
- Click node shows note title and excerpt
- File size < 2MB for 100-node graph
- Light and dark themes work

**Estimated Effort:** 16 hours

---

#### Phase 2: Hosted Publishing (Future)

- [ ] Design hosting infrastructure
  - [ ] Subdomain: `{username}.patchpad.pub`
  - [ ] Static hosting: S3 + CloudFront or Vercel
  - [ ] API: `POST /api/publish`, `GET /api/graphs/:id`

- [ ] Create publish API endpoints
  - [ ] `POST /api/publish` - upload graph HTML + metadata
  - [ ] `GET /api/graphs/:username/:slug` - serve published graph
  - [ ] `DELETE /api/graphs/:id` - unpublish

- [ ] Add authentication for publishing
  - [ ] Require logged-in user
  - [ ] Rate limit: 10 publishes per day
  - [ ] Storage limit: 10MB per user (free tier)

- [ ] Add custom domain support
  - [ ] CNAME record verification
  - [ ] SSL provisioning via Let's Encrypt
  - [ ] Premium feature gate

- [ ] Add analytics
  - [ ] Track views per graph
  - [ ] Most-clicked nodes
  - [ ] Referrer tracking
  - [ ] Display in dashboard

**Open Questions:**
- Should graphs be editable after publishing or read-only snapshots?
- How to handle private notes referenced in public graph?
- Content moderation for hosted version?
- Pricing tiers: free (50 nodes, patchpad.pub subdomain) vs premium (unlimited, custom domain)?

**Estimated Effort:** 40+ hours

**New Infrastructure Required:**
- CDN/static hosting service
- Domain management
- Usage analytics database

**Migration Notes:**
- POC requires no backend
- Hosted version is additive feature

---

### 3. Template Intelligence

**Goal:** Detect note structure patterns and offer AI-powered templates that auto-fill from existing knowledge.

**Tasks:**

#### Phase 1: Pattern Detection

- [x] Create `src/services/templateDetection.ts`
  - [x] Export interface `NotePattern { name, frequency, structure, exampleNoteIds }`
  - [x] Export function `detectPatterns(notes: Note[]): NotePattern[]`
    - Analyze note titles for common prefixes ("Meeting:", "Research:", etc.)
    - Analyze content for structural patterns (headers, bullet lists, checkboxes)
    - Group notes with similar structures
    - Return patterns with 3+ occurrences
  - [x] Export function `extractStructure(content: string): NoteStructure`
    - Parse markdown headers
    - Identify bullet point sections
    - Detect code blocks, quotes, etc.

- [x] Implement pattern matching heuristics
  - [x] Title prefix matching: "Meeting with X" → "Meeting" pattern
  - [x] Header structure: notes with same H2 headers
  - [x] Content length clustering: short (< 200 chars) vs long (> 1000 chars)

#### Phase 2: Template System

- [x] Create `src/types/template.ts`
  ```typescript
  interface Template {
    id: string;
    name: string;
    description: string;
    structure: string; // Markdown with {{placeholders}}
    placeholders: Placeholder[];
    aiEnhanced: boolean;
    createdAt: Date;
  }

  interface Placeholder {
    key: string;
    label: string;
    type: 'text' | 'date' | 'note-reference' | 'ai-fill';
    aiPrompt?: string; // For ai-fill type
  }
  ```

- [x] Create `src/services/templates.ts`
  - [x] Export function `getTemplates(): Template[]` - load from localStorage
  - [x] Export function `saveTemplate(template: Template): void`
  - [x] Export function `deleteTemplate(id: string): void`
  - [x] Export function `applyTemplate(template: Template, values: Record<string, string>): string`
  - [x] Export async function `aiEnhanceTemplate(template: Template, values: Record<string, string>, notes: Note[]): string`
    - Fill {{ai:topic}} placeholders using semantic search
    - Inject relevant note excerpts

- [x] Update database schema
  ```typescript
  // Add to src/db/index.ts
  templates: EntityTable<Template, 'id'>
  // Version 8
  ```

#### Phase 3: Template UI

- [x] Create `src/components/TemplateDialog.tsx`
  - [x] Show detected patterns as suggested templates
  - [x] Form to customize template structure
  - [x] Preview pane showing rendered template
  - [x] "Save Template" button

- [x] Create `src/components/TemplatePicker.tsx`
  - [x] Grid of saved templates
  - [x] Quick-fill form for placeholders
  - [x] "Create from template" button

- [x] Add command palette and keyboard shortcuts
  - [x] "New Note from Template" (Ctrl+Shift+N)
  - [x] "Create Template" command
  - [x] Integration with App.tsx

- [x] Add template trigger detection
  - [x] Create `src/services/templateMatcher.ts` with `matchTitleToTemplate()` and `getBestTemplateMatch()`
  - [x] Create `src/hooks/useTemplateSuggestion.ts` hook for reactive template detection
  - [x] Create `src/components/TemplateSuggestionToast.tsx` for UI suggestion
  - [x] Integrate into App.tsx - detects when title matches pattern ("Meeting:", "Research:")
  - [x] Show toast: "Use template?" with accept/dismiss options
  - [x] On accept, scaffold template structure into note content
  - [x] Add tests in `src/services/templateMatcher.test.ts`

#### Phase 4: AI-Powered Templates

- [x] Create "Research Summary" template
  - [x] Placeholders: `{{topic}}`, `{{ai:related_notes}}`, `{{ai:open_questions}}`
  - [x] On apply, search notes for topic via semantic search
  - [x] Extract open questions from related notes using regex patterns

- [x] Create "Meeting Prep" template
  - [x] Placeholders: `{{title}}`, `{{date}}`, `{{company}}`, `{{participants}}`, `{{ai:context}}`
  - [x] On apply, search for company/participant mentions
  - [x] Context includes matching notes with what term matched

- [x] Add command palette entry (already implemented in Phase 3)
  ```typescript
  { id: 'new-from-template', name: 'New Note from Template', action: () => setTemplatePickerOpen(true) }
  ```

- [x] Implement AI content generators in `src/services/templates.ts`
  - [x] `generateRelatedNotesContent()` - semantic search for topic
  - [x] `generateOpenQuestionsContent()` - extract questions from related notes
  - [x] `generateContextContent()` - search for company/participant mentions

**Open Questions:**
- Should templates sync to cloud?
- How to share templates between users?
- Template marketplace/library?

**Acceptance Criteria:**
- App detects patterns in note creation
- Users can save and reuse templates
- AI-enhanced templates auto-fill with relevant context
- Template triggers appear when typing matching titles

**Estimated Effort:** 24 hours

**New Infrastructure Required:**
- Templates table in database (v8 migration)

**Migration Notes:**
- Templates stored locally by default
- Sync to cloud as part of user data (future)

---

## Horizon 3: Blue Sky

*Reframes what PatchPad could become*

---

### 1. Ambient Knowledge Capture

**Goal:** Create a system tray / menu bar companion app that captures knowledge passively from user activity.

**Tasks:**

#### Research Phase

- [ ] Evaluate cross-platform frameworks
  - [ ] Electron: Full desktop app, largest bundle, most mature
  - [ ] Tauri: Rust-based, smaller bundle, newer
  - [ ] Native: Separate apps per platform

- [ ] Research system integration APIs
  - [ ] Clipboard monitoring: macOS Pasteboard, Windows Clipboard API
  - [ ] Browser integration: WebExtension API
  - [ ] Calendar access: Google Calendar API, Outlook API

- [ ] Determine privacy boundaries
  - [ ] What data is captured automatically?
  - [ ] What requires explicit user action?
  - [ ] Local-only vs cloud storage

#### Phase 1: Menu Bar App (Electron)

- [ ] Initialize Electron project
  ```bash
  npm create electron-app@latest patchpad-companion
  ```

- [ ] Implement system tray icon
  - [ ] Tray icon with status indicator
  - [ ] Right-click menu: "New Note", "Search Notes", "Settings", "Quit"
  - [ ] Left-click: open quick capture

- [ ] Create quick capture window
  - [ ] Floating window, always-on-top option
  - [ ] Text input that creates note
  - [ ] Global keyboard shortcut (configurable)

- [ ] Implement clipboard monitoring
  - [ ] Watch clipboard for changes
  - [ ] On URL copy, suggest "Save to notes?"
  - [ ] On text copy (> 50 chars), suggest "Create note?"
  - [ ] User can enable/disable monitoring

#### Phase 2: Calendar Integration

- [ ] Add Google Calendar OAuth
  - [ ] Connect Google account
  - [ ] Fetch upcoming events
  - [ ] Trigger 15-min-before notification

- [ ] Create meeting prep notification
  - [ ] Before meeting, search notes for attendee names
  - [ ] Generate brief via `generateMeetingBrief()`
  - [ ] Notification: "Meeting with X in 15 min - prep brief ready"

#### Phase 3: Browser Extension

- [ ] Create WebExtension (Chrome + Firefox)
  - [ ] Popup with quick note entry
  - [ ] Right-click context menu: "Save to PatchPad"
  - [ ] Sync with main app via API or localStorage

- [ ] Implement page capture
  - [ ] Save URL + title + selected text
  - [ ] Optional: full page content as markdown
  - [ ] Tag with "web-clip"

**Open Questions:**
- Should companion app store data locally or require sync?
- How to authenticate companion app with main app?
- Privacy: Should clipboard monitoring be opt-in per-content-type?
- Distribution: App stores vs direct download?

**Proof of Concept Scope:**
- Electron tray app with quick capture
- Clipboard URL detection with "Save" toast
- No calendar integration (manual for POC)

**Acceptance Criteria:**
- Tray app runs in background
- Global hotkey captures thoughts
- URLs auto-detected and offered for save
- Notes sync with main PatchPad app

**Estimated Effort:** 40 hours (POC), 100+ hours (full feature)

**Dependencies:**
- Electron or Tauri framework
- OAuth setup for calendar providers
- Browser extension review process (if published)

---

### 2. Knowledge Agents

**Goal:** Evolve the AI Research Partner into multiple specialized agents that proactively assist with knowledge work.

**Tasks:**

#### Research Phase

- [x] Design agent architecture
  - [x] How do agents communicate with each other?
  - [x] How are tasks delegated and monitored?
  - [x] How do users configure agent permissions?

- [x] Evaluate background processing
  - [x] Service Worker for background execution
  - [x] Scheduled tasks via cloud functions
  - [x] Local daemon process

#### Phase 1: Agent Framework

- [x] Create `src/services/agentFramework.ts`
  - [x] Export interface `Agent { id, name, description, capabilities, schedule, permissions }`
  - [x] Export interface `AgentTask { id, agentId, type, status, result, createdAt }`
  - [x] Export function `runAgent(agentId: string): Promise<AgentResult>`
  - [x] Export function `scheduleAgent(agentId: string, cron: string): void`

- [x] Create agent registry
  - [x] `archivist`: Organizes and connects notes
  - [x] `researcher`: Monitors topics and creates briefings
  - [x] `writer`: Transforms notes into documents

- [x] Implement task queue
  - [x] Store pending tasks in IndexedDB
  - [x] Process during idle time (requestIdleCallback)
  - [x] Notify user on completion

#### Phase 2: Archivist Agent

- [x] Create `src/agents/archivist.ts`
  - [x] Capability: `suggestConnections` - find notes that should be linked
  - [x] Capability: `detectDuplicates` - find near-duplicate notes
  - [x] Capability: `surfaceContradictions` - find conflicting information
  - [x] Capability: `suggestMerges` - identify notes to combine

- [x] Implement overnight processing
  - [x] Run when app idle for 30+ minutes
  - [x] Or: run at scheduled time (2am local)
  - [x] Store suggestions in `agentSuggestions` table

- [x] Create suggestions UI
  - [x] Panel in Second Brain Dashboard
  - [x] List suggestions by type
  - [x] One-click apply or dismiss

#### Phase 3: Researcher Agent

- [x] Create `src/agents/researcher.ts`
  - [x] Capability: `monitorTopic` - track external sources for topic
  - [x] Capability: `createBriefing` - generate daily/weekly briefings
  - [x] Capability: `findGaps` - identify knowledge gaps

- [x] Add topic monitoring
  - [x] User configures topics of interest
  - [x] Agent periodically searches web (if enabled)
  - [x] Creates "Research Update" notes

- [x] Implement briefing generation
  - [x] Daily: summarize changes to notes
  - [x] Weekly: synthesize week's learning
  - [x] Store as notes with "agent-briefing" tag

#### Phase 4: Writer Agent

- [x] Create `src/agents/writer.ts`
  - [x] Capability: `draftDocument` - compile notes into document
  - [x] Capability: `suggestOutline` - propose structure for topic
  - [x] Capability: `refineText` - improve writing quality

- [x] Implement document generation
  - [x] User selects notes to include
  - [x] Agent proposes outline
  - [x] Agent drafts sections from note content
  - [x] User reviews and edits

- [x] Add export formats
  - [x] Markdown document (with YAML frontmatter, ToC generation)
  - [x] HTML document (with light/dark themes, styled output)
  - [x] PDF export (via browser print dialog)
  - [ ] Google Docs (via API) - requires OAuth setup

**Open Questions:**
- How much autonomous action should agents have?
- How to prevent agents from overwhelming users with suggestions?
- Should agents have "budgets" (max API calls per day)?
- How to handle agent errors gracefully?

**Proof of Concept Scope:**
- Archivist agent with connection suggestions
- Manual trigger only (no scheduling)
- Suggestions displayed in dashboard

**Acceptance Criteria:**
- At least one agent runs and produces useful suggestions
- Suggestions are actionable (one-click apply)
- Users can enable/disable agents
- Agents respect rate limits and budgets

**Estimated Effort:** 60 hours (POC with one agent), 150+ hours (full agent ecosystem)

**Dependencies:**
- Background processing solution
- Additional API budget for agent operations
- User permission system

---

## Moonshot

**"Externalized Cognition" - Thinking Sessions as Recorded Artifacts**

*A system that captures not just what you know, but how you came to know it*

---

### Phase 1: Foundation - Session Recording

**Goal:** Record user activity on the canvas as a temporal trace that can be replayed.

**Tasks:**

- [x] Design session event model
  ```typescript
  interface ThinkingEvent {
    type: 'note-move' | 'note-create' | 'note-edit' | 'note-connect' | 'viewport-change' | 'ai-query' | 'ai-response';
    timestamp: number; // ms since session start
    payload: any; // type-specific data
  }

  interface ThinkingSession {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    events: ThinkingEvent[];
    canvasSnapshot: CanvasState; // Initial state
    annotations: SessionAnnotation[];
  }
  ```

- [x] Create `src/services/sessionRecorder.ts`
  - [x] Export function `startRecording(): string` - returns sessionId
  - [x] Export function `stopRecording(sessionId: string): ThinkingSession`
  - [x] Export function `recordEvent(sessionId: string, event: ThinkingEvent): void`
  - [x] Buffer events in memory, flush to IndexedDB periodically

- [x] Instrument canvas for recording
  - [x] Hook into `saveNoteCanvasPosition()` - record 'note-move'
  - [x] Hook into `createNote()` - record 'note-create'
  - [x] Hook into wiki link creation - record 'note-connect'
  - [x] Debounce rapid events (< 100ms)

- [x] Add session storage
  ```typescript
  // Add to src/db/index.ts - version 9
  sessions: EntityTable<ThinkingSession, 'id'>
  ```

- [x] Create recording UI
  - [x] "Start Recording" button in canvas toolbar
  - [x] Recording indicator (red dot, duration counter)
  - [x] "Stop Recording" saves session

**Estimated Effort:** 16 hours

---

### Phase 2: Core Feature - Session Playback

**Goal:** Replay thinking sessions as animated visualizations.

**Tasks:**

- [x] Create `src/components/SessionPlayer.tsx`
  - [x] Accept props: `session: ThinkingSession`, `onClose: () => void`
  - [x] Playback controls: play, pause, speed (0.5x, 1x, 2x, 4x), seek
  - [x] Timeline scrubber showing event density
  - [x] Display current time and total duration

- [x] Implement canvas replay
  - [x] Load initial canvasSnapshot
  - [x] Apply events in sequence at recorded timestamps
  - [x] Animate note movements (interpolate positions)
  - [x] Highlight newly created notes
  - [x] Show connection lines being drawn

- [x] Create `src/services/sessionPlayback.ts`
  - [x] Export class `SessionPlayer`
  - [x] Method `play()` - start playback loop
  - [x] Method `pause()` - stop at current position
  - [x] Method `seek(timestamp: number)` - jump to point
  - [x] Method `setSpeed(multiplier: number)`
  - [x] Use `requestAnimationFrame` for smooth playback

- [x] Add AI query visualization
  - [x] When 'ai-query' event, show query text
  - [x] When 'ai-response' event, animate response appearing
  - [x] Sidebar panel for AI conversation during playback

- [x] Create session library view
  - [x] List past sessions with date, duration, note count
  - [x] Preview thumbnail (canvas at midpoint)
  - [x] Search/filter sessions

**Estimated Effort:** 24 hours

---

### Phase 3: Session Intelligence

**Goal:** Add annotations, sharing, and insights to thinking sessions.

**Tasks:**

- [x] Create `src/components/SessionAnnotation.tsx`
  - [x] User can pause and add annotation at any point
  - [x] Annotations: text note, highlight, voice memo
  - [x] Display annotations as markers on timeline
  - [x] AnnotationList component for viewing/seeking

- [x] Implement annotation system
  ```typescript
  interface SessionAnnotation {
    id: string;
    timestamp: number;
    type: 'note' | 'highlight' | 'voice';
    content: string;
    canvasPosition?: { x: number; y: number }; // If attached to location
  }
  ```

- [x] Add session sharing
  - [x] Export session as self-contained HTML (like graph export)
  - [x] Viewer: play-only, no editing
  - [x] Built-in player with keyboard shortcuts
  - [x] `src/services/sessionExport.ts` with downloadSessionAsHTML

- [x] Create session insights (`src/services/sessionInsights.ts`)
  - [x] "You spent 10 minutes on this area before breakthrough"
  - [x] "You revisited this note 5 times"
  - [x] "Ideas clustered in 3 regions"
  - [x] Heatmap overlay showing activity density
  - [x] Breakthrough detection (pause followed by burst)

- [x] AI session analysis
  - [x] "What was I trying to figure out?" (generateSessionSummary)
  - [x] Generate summary of thinking process
  - [x] Suggest: "You might want to explore X more" (generateSuggestions)

- [x] Session Insights UI (`src/components/SessionInsights.tsx`)
  - [x] Patterns & Insights tab with key patterns
  - [x] Activity Heatmap tab with visualization
  - [x] AI Summary tab with timeline and thoughts

**Estimated Effort:** 32 hours

---

### Phase 4: Full Vision - Collaborative Thinking

**Goal:** Share thinking sessions with others for collaborative sense-making.

**Tasks:**

- [ ] Enable live session broadcasting
  - [ ] "Broadcast" mode: others watch your thinking live
  - [ ] Viewer list with presence indicators
  - [ ] Chat sidebar for questions/comments

- [ ] Add collaborative annotation
  - [ ] Multiple people can annotate same session
  - [ ] Color-coded by contributor
  - [ ] "Annotation conversation" threads

- [ ] Create thinking session templates
  - [ ] "Brainstorming" - optimized for rapid idea capture
  - [ ] "Problem-solving" - structured with problem statement
  - [ ] "Review" - for going through existing notes
  - [ ] Templates set canvas layout and suggested flow

- [ ] Implement session comparison
  - [ ] Compare two sessions on same topic
  - [ ] Visualize how thinking evolved
  - [ ] "What did you learn between sessions?"

**Open Questions:**
- How much session data can be stored before performance issues?
- Should sessions be synced to cloud?
- Privacy: How to handle sessions containing sensitive notes?
- How to make playback performant for long (30+ min) sessions?

**Proof of Concept Scope:**
- Record canvas movements during a session
- Basic playback with play/pause
- Simple timeline scrubber
- Export as JSON for analysis

**Acceptance Criteria:**
- Can start/stop recording on canvas
- Recorded sessions replay accurately
- Playback speed is adjustable
- Sessions persist across app restarts

**Total Estimated Effort:** 80 hours (basic recording + playback), 160+ hours (full vision)

**Dependencies:**
- IndexedDB space for session storage
- WebSocket for live broadcasting
- Additional UI work for player controls

---

## Suggested Starting Point

### Recommended First Task: **Second Brain Dashboard** (Horizon 1.1)

**Why start here:**

1. **Immediate user value**: Users currently open PatchPad to a blank slate or last note. The dashboard makes every app launch feel intelligent and personalized.

2. **Leverages existing infrastructure**: All data is already collected (notes, timestamps, concepts, conversations). You're just surfacing it.

3. **Low technical risk**: No new dependencies, no database migrations, no external services. Pure React component work.

4. **Sets up for other features**: The analytics service created here (`dashboardAnalytics.ts`) will power the Thinking Timeline and other features.

5. **Validates vision**: If users engage with "Brewing Ideas" and "Fading Memories", it validates that PatchPad's future is about intelligence, not just storage.

**What it unblocks:**
- Pattern for surfacing insights from existing data
- Analytics service reusable across features
- User engagement metrics for prioritizing roadmap
- Foundation for Template Intelligence (pattern detection)

**Estimated time to first demo:** 4 hours (core dashboard with static data), 8 hours (full feature with live data)

**How to start:**

```bash
# Create the dashboard component
touch src/components/SecondBrainDashboard.tsx

# Create the analytics service
touch src/services/dashboardAnalytics.ts
touch src/services/dashboardAnalytics.test.ts

# Run dev server
npm run dev
```

Then implement in order:
1. Basic dashboard layout with mock data
2. `getMostEditedNotes()` with real data
3. `getUnconnectedNotes()` with connection suggestions
4. `getFadingNotes()` with concept cross-reference
5. Integration with App.tsx and command palette

**Success metric:** Users spend >30 seconds on dashboard instead of immediately closing it.

---

## Quick Reference: File Paths

| Feature | Key Files |
|---------|-----------|
| Main App | `src/App.tsx` |
| Note Types | `src/types/note.ts` |
| Database | `src/db/index.ts` |
| AI Service | `src/services/ai.ts` |
| Brain/Concepts | `src/services/brain.ts` |
| Embeddings | `src/services/embeddings.ts` |
| Semantic Search | `src/services/semanticSearch.ts` |
| Research Partner | `src/services/researchPartner.ts` |
| Canvas | `src/services/canvas.ts`, `src/components/Canvas/` |
| Sync | `src/services/sync.ts`, `src/services/syncEngine.ts` |
| Notes Hook | `src/hooks/useNotes.ts` |
| Supabase Config | `src/config/supabase.ts` |
