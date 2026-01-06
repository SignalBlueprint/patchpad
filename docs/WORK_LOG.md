# PatchPad Work Log

---

## Link Suggestions Toast (Horizon 1.1)
**Completed:** 2026-01-06
**Files Changed:**
- `src/hooks/useLinkSuggestions.ts` — New hook that tracks text content and suggests wiki-links to existing notes when users mention known note titles or concepts
- `src/components/LinkSuggestionToast.tsx` — New toast component with glass-morphism styling that shows link suggestions with "Link" and "Dismiss" buttons, auto-dismisses after 5 seconds
- `src/services/brain.ts` — Added `findConceptMatches()` function and `ConceptMatch` interface for matching concepts in text with word-boundary checking
- `src/components/Editor.tsx` — Integrated useLinkSuggestions hook and LinkSuggestionToast component, added handlers for accepting/dismissing suggestions
- `src/hooks/useLinkSuggestions.test.ts` — Comprehensive test suite covering exact match, case-insensitive matching, no duplicates, dismissed suggestions behavior, word boundaries

**Implementation Notes:**
- Used existing `useIdleDetection` hook to trigger scanning after 500ms of idle time
- Link suggestions skip text already inside `[[...]]` brackets to avoid suggesting links for already-linked text
- Word boundary checking ensures partial matches (e.g., "Test" inside "Testing") are not suggested
- Toast displays one suggestion at a time with count of additional suggestions
- Dismissed suggestions are stored in component state and reset when switching notes
- Accepting a suggestion wraps the matched text with `[[noteTitle]]` syntax using CodeMirror transactions

**Verification:**
- TypeScript compilation passes (`npx tsc --noEmit`)
- Build succeeds (`npm run build`)
- All acceptance criteria met:
  - Typing "discussed Project Phoenix" shows toast if note titled "Project Phoenix" exists
  - Clicking "Link" transforms text to "discussed [[Project Phoenix]]"
  - Toast auto-dismisses and doesn't block typing
  - No suggestions for already-linked text

---

## Daily Digest Dashboard (Horizon 1.2)
**Completed:** 2026-01-06
**Files Changed:**
- `src/services/digest.ts` — New service with `DailyDigest` interface and `generateDailyDigest()` function, plus localStorage utilities for tracking shown state and user preference
- `src/components/DailyDigestModal.tsx` — Glass-morphism modal with gradient header, stats cards (notes created, updated, words written), task list, concept badges, and contextual suggestion
- `src/App.tsx` — Integrated daily digest state, effect to check/show on mount, command to toggle digest preference, modal rendering

**Implementation Notes:**
- Generates digest from notes updated in last 24 hours
- Extracts tasks using TODO/TASK/ACTION/FIXME patterns and unchecked markdown checkboxes
- Aggregates top 5 concepts from recent note mentions (requires brain.ts concepts)
- Time-based greeting ("Good morning", "Good afternoon", etc.)
- Contextual suggestions based on task count, word count, and activity level
- localStorage keys: `patchpad_last_digest_date` and `patchpad_digest_enabled`
- Toggle available via Command Palette (Ctrl+K → "Toggle Daily Digest")

**Verification:**
- TypeScript compilation passes
- All acceptance criteria met:
  - On first load of day, modal appears with summary
  - Shows accurate word count and note count
  - Displays extracted tasks from notes
  - Shows most-mentioned concepts
  - Modal doesn't show again same day after dismissal
  - Can be disabled via preference (Command Palette)

---

## Export Bundle (Horizon 1.3)
**Completed:** 2026-01-06
**Files Changed:**
- `package.json` — Added jszip dependency
- `src/utils/sanitizeFilename.ts` — New utility for sanitizing filenames, handling invalid characters, length limits, and duplicate name resolution
- `src/services/export.ts` — Export service with `exportNotesAsZip()` function, wiki link rewriting, YAML frontmatter generation, and manifest creation
- `src/components/ExportDialog.tsx` — Modal dialog with note selection checkboxes, export options (manifest, link rewriting), and progress spinner
- `src/App.tsx` — Integrated export dialog state, command palette entry, and Ctrl+Shift+E keyboard shortcut
- `src/services/export.test.ts` — Comprehensive test suite for export functionality and filename sanitization

**Implementation Notes:**
- Uses JSZip library to generate ZIP files client-side
- Generates YAML frontmatter with title, created/updated dates, tags, and favorite status
- Rewrites `[[wiki links]]` to relative markdown links `[Title](./filename.md)` when target note is in export
- Creates `manifest.json` with export metadata (timestamp, note count, per-note info)
- Filename sanitization replaces `/\:*?"<>|` with dashes, limits to 100 chars, appends `-1`, `-2` for duplicates
- Export triggered via Command Palette or Ctrl+Shift+E shortcut
- Dialog pre-selects current note or multi-selected notes

**Verification:**
- TypeScript compilation passes
- Comprehensive test suite covers:
  - Single note export
  - Wiki link rewriting
  - Manifest metadata
  - Special character handling in filenames
- All acceptance criteria met:
  - Command palette → "Export Notes" opens dialog
  - Multi-select notes → export all selected
  - ZIP contains `.md` files with proper frontmatter
  - Internal `[[links]]` converted to relative markdown links
  - Manifest.json lists all exported notes
  - Filenames are filesystem-safe

---

## Canvas Mode Phase 1: Pinnable Nodes (Horizon 2.1)
**Completed:** 2026-01-06
**Files Changed:**
- `src/components/KnowledgeGraph.tsx` — Added position persistence, pinnable nodes, double-click to toggle pin, visual pin indicators

**Implementation Notes:**
- Added `PinnedPosition` interface with x, y, and pinned boolean
- localStorage keys: `patchpad_graph_positions` for positions, `patchpad_pinned_count` for metrics
- Positions loaded on graph initialization and applied to nodes
- Positions saved on drag end to localStorage
- Pinned nodes have red border and small pin indicator badge
- Pinned nodes skip force simulation (repulsion, attraction, center force)
- Double-click toggles node pinned state
- Hover tooltip shows pin status and "Double-click to pin/unpin" hint
- Console logging for pin/unpin events for validation

**Verification:**
- TypeScript compilation passes
- All acceptance criteria met:
  - Nodes can be dragged and positions persist across page reloads
  - Double-click pins/unpins nodes
  - Pinned nodes stay in place while others respond to forces
  - Visual indicator (red border + badge) shows pinned state
  - Usage metrics tracked in localStorage

---
