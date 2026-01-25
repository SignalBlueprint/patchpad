# Project State - PatchPad

> Source of truth for autonomous development cycles.
> Updated by AI after each work session. Human edits welcome for priorities and blockers.

## What's Next

1. [ ] Wire up Live Collaborative Canvases - Connect CollaborationControls UI and remote cursors to canvas view
2. [ ] Add canvas replay renderer for SessionPlayer - Visualize session playback with note movements and AI interactions
3. [ ] Implement session comparison feature - Compare two thinking sessions with side-by-side event timelines
4. [ ] Add "Run Archivist" button to Second Brain Dashboard - Surface connection suggestions with accept/dismiss tracking

## What's Done

_All Horizon 1 (Quick Wins) features complete:_
- Second Brain Dashboard with Greeting, Brewing Ideas, and Fading Memories sections
- Thinking Timeline with session clustering and configurable gap threshold
- Conversation Insights panel with top questions, topics, knowledge gaps, and activity tracking
- Knowledge Graph Publishing with interactive HTML export
- Template Intelligence with pattern detection and AI placeholder types
- Template Intelligence AI placeholder filling - Real-time preview of AI-generated content in TemplatePicker
- Knowledge Agents framework (Archivist, Researcher, Writer) with AgentDashboard
- Session Recording infrastructure with event capture and localStorage persistence
- Session Playback with speed controls, timeline scrubber, and event markers
- Session Annotations with note, highlight, and voice recording support
- Session Insights with activity analysis, breakthrough detection, and AI-generated summaries

## Blocked

_No blockers._

## Backlog

- Enhance Knowledge Graph Publishing with analytics dashboard and view tracking
- Add session templates (Brainstorming, Problem-solving, Review)
- Implement spaced repetition integration with session insights
- Create browser extension for web clipping (requires separate project)
- Add Ambient Knowledge Capture companion app (requires Electron project)
- Enable real-time collaborative annotation on shared sessions (requires WebSocket backend)

## Project Context

**Tech Stack**: React 18, TypeScript, Vite 6, TailwindCSS, CodeMirror 6, Dexie (IndexedDB), Supabase (optional), Yjs CRDTs

**Key Patterns**: Local-first architecture, reactive queries via Dexie useLiveQuery, service layer abstraction (39 services), command palette (50+ commands), no global state manager

**Test Command**: `npm test`
**Build Command**: `npm run build`
**Dev Command**: `npm run dev`
**Type Check**: `npm run typecheck`

**Deploy**: Manual (no auto-deploy configured)

**Vision**: "A personal knowledge operating system that transforms scattered thoughts into interconnected intelligence through voice-first capture, AI refinement, and spatial/graph-based exploration."

**Current Health**: Green (production ready, 49% feature complete across all horizons)

**Known Tech Debt**:
- 7.7% test coverage (12/156 files)
- No service worker for offline-first PWA
- No error tracking/monitoring
- Yjs collaboration wired but not fully exposed in UI
- No pagination (performance risk at scale)
