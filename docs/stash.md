# PatchPad Feature Stash

This document preserves concepts for future implementation that require significant infrastructure investment.

---

## Memory Palace (Moonshot)

**Vision:** A spatial VR/AR environment where users literally walk through their knowledge - a 3D virtual library where notes become books on shelves, organized by folders and connected by visible light beams representing wiki links.

### Core Concept
Transform the abstract knowledge graph into a navigable 3D space using the "method of loci" memory technique. Users can:
- Walk through rooms (folders) containing bookshelves
- Pick up and read books (notes)
- Follow glowing connection beams between related notes
- Use spatial memory to enhance recall

### Technical Requirements
- **3D Engine:** Three.js with React Three Fiber (@react-three/fiber, @react-three/drei)
- **VR/AR:** WebXR API for Quest headsets, mobile AR
- **Multiplayer:** Real-time presence for collaborative spaces

### Phase 1: Virtual Library (Web 3D)
- Initialize Three.js scene with first-person controls (WASD + mouse look)
- Generate library room geometry with bookshelves along walls
- Render notes as 3D books with spine labels (note title)
- Book colors based on tags/folders
- Hover preview, click to open content
- Raycasting for interaction, "pull out book" animations

### Phase 2: Spatial Navigation
- Each top-level folder = one room
- Doorways connect related folders
- Room size scales with note count
- Mini-map with teleport functionality
- Wiki links visualized as light beams between books
- Breadcrumb trail for navigation history
- Spatial search: matching books glow, path illuminates

### Phase 3: Full Immersive (VR/AR)
- WebXR support for Quest headsets
- Hand tracking for natural interactions
- Voice commands: "Show me notes about X", "Create new note"
- Collaborative mode with avatars and voice chat
- Spatial audio for audio annotations
- Spaced repetition integration for memorization

### Open Questions
- Which VR hardware to prioritize? (Quest 2/3 most accessible)
- How to make 3D navigation faster than 2D for common tasks?
- Performance optimization for 1000+ notes?
- Motion sickness mitigation strategies?

### Estimated Effort
- Phase 1 (Web 3D): 40 hours
- Phase 2 (Navigation): 60 hours
- Phase 3 (VR/AR): 100+ hours

---

## Knowledge Graph as Product (Horizon 3)

**Vision:** Enable users to publish their knowledge graph as an interactive, shareable web page - turning personal notes into public knowledge resources.

### Core Concept
Export the knowledge graph visualization as a standalone, embeddable artifact that others can explore. Think "personal Wikipedia" or "digital garden" with visual navigation.

### Technical Options

**Static Export (POC):**
- Generate self-contained HTML file with embedded JS
- D3.js force layout for visualization
- Note excerpts as node tooltips
- Works offline once loaded
- Host anywhere (GitHub Pages, Netlify, personal site)

**Hosted Platform (Future):**
- Subdomain publishing: `{username}.patchpad.pub`
- Custom domain support
- Version history and rollback
- Analytics (views, popular nodes, referrers)

### Export Options
- Theme: light/dark mode
- Privacy: full content vs titles only
- Interactivity level: static image vs interactive graph
- Node filtering by tags/folders

### Implementation Path

**Phase 1: Static Export**
- Create `graphExport.ts` service
- `generateInteractiveGraph(graph, notes)` returns HTML string
- Embed minified D3.js visualization
- Include note excerpts as tooltips
- "Publish Graph" button in BrainDashboard
- Preview before download

**Phase 2: Hosted Publishing**
- Backend API for upload/hosting
- User authentication for publishing
- Permission levels (public, unlisted, private)
- Expiring share links
- Embed codes for other sites

### Open Questions
- Should published graphs be editable or read-only?
- How to handle mixed privacy (some notes public, some private)?
- Monetization: free tier limits, premium features?
- Content moderation for hosted version?

### Acceptance Criteria (POC)
- One-click export to interactive HTML
- Graph renders correctly in modern browsers
- Clicking node shows note title and excerpt
- File size < 2MB for 100-node graph
- Works offline once loaded

### Estimated Effort
- POC (static export): 16 hours
- Hosted platform: 60+ hours

---

## Real-time Collaboration (Sync Phase 4)

**Vision:** Enable multiple users to edit the same note simultaneously with Google Docs-style real-time cursors and conflict-free merging.

### Core Concept
Use Conflict-free Replicated Data Types (CRDTs) to enable true real-time collaboration. Each user sees other users' cursors and changes appear instantly without merge conflicts.

### Technical Requirements
- **CRDT Library:** Yjs (most mature, ProseMirror/CodeMirror bindings available)
- **Transport:** WebSocket server or WebRTC for peer-to-peer
- **Presence:** User cursors, selections, avatars in real-time
- **Awareness:** See who's viewing/editing which note

### Implementation Path

**Phase 4a: Yjs Integration**
- Add `yjs` and `y-indexeddb` dependencies
- Create `Y.Doc` per note with shared text type
- Persist Yjs updates to IndexedDB
- Sync Yjs state to Supabase (binary blob column)
- Bidirectional sync: local changes → Supabase, remote changes → local

**Phase 4b: Real-time Presence**
- WebSocket server for awareness protocol
- Or: Supabase Realtime Presence (simpler, managed)
- Render remote cursors in editor with user colors
- Show typing indicators and selection highlights
- "Who's here" indicator showing active collaborators

**Phase 4c: Collaborative Editing UI**
- Cursor labels with user names
- Selection highlighting in user colors
- Presence sidebar showing active users
- "Follow" mode to track another user's view
- Edit history with user attribution

### Dependencies
- Requires Sync Phases 1-3 complete (Supabase, Auth, Sync Engine)
- Need WebSocket infrastructure or Supabase Realtime upgrade
- Editor integration (may require switching to ProseMirror/TipTap)

### Open Questions
- WebSocket server (self-hosted) vs Supabase Realtime (managed)?
- How to handle offline edits that need CRDT merge on reconnect?
- Rate limiting for real-time updates?
- Maximum collaborators per note?

### Estimated Effort
- Phase 4a (Yjs Integration): 24 hours
- Phase 4b (Real-time Presence): 16 hours
- Phase 4c (Collaborative UI): 20 hours

---

## Notes for Future Implementation

When returning to these features:

1. **Real-time Collaboration** (Sync Phase 4) is the logical next step after Sync Phases 1-3, enabling Google Docs-style co-editing
2. **Knowledge Graph as Product** could be a standalone feature - the static export is a good quick win
3. **Memory Palace** is best tackled after Real-time Collaboration is stable, as multiplayer presence is a key differentiator
4. All features benefit from the AI Research Partner's semantic understanding of notes
5. Consider building the static Knowledge Graph export first as a simpler proof of concept before the full Memory Palace

### Current State (as of Horizon 3.2 completion)

**Completed:**
- Voice-First Capture (all phases)
- Canvas Mode (all phases)
- Sync & Collaboration Phases 1-3 (Supabase backend, Auth, Sync Engine)
- AI Research Partner (all 4 phases)

**Stashed for Future:**
- Real-time Collaboration (Sync Phase 4) - Yjs CRDTs
- Knowledge Graph as Product (Horizon 3.1) - Static export & hosted publishing
- Memory Palace (Moonshot) - 3D/VR knowledge navigation
