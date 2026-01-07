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

## Notes for Future Implementation

When returning to these features:

1. **Memory Palace** is best tackled after Sync & Collaboration is stable, as multiplayer presence is a key differentiator
2. **Knowledge Graph as Product** could be a standalone feature but becomes more valuable with user accounts (Sync layer)
3. Both features benefit from the AI Research Partner's semantic understanding of notes
4. Consider building the static Knowledge Graph export first as a simpler proof of concept before the full Memory Palace
