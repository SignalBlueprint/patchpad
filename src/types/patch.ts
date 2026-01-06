export type PatchOpType = 'insert' | 'delete' | 'replace';

export interface PatchOp {
  type: PatchOpType;
  start: number;    // character index
  end?: number;     // for delete/replace
  text?: string;    // for insert/replace
}

export type PatchAction =
  | 'summarize'
  | 'extract-tasks'
  | 'rewrite'
  | 'title-tags'
  | 'continue'
  | 'expand'
  | 'simplify'
  | 'fix-grammar'
  | 'translate'
  | 'ask-ai'
  | 'explain'
  | 'outline';

export interface Patch {
  id: string;
  noteId: string;
  action: PatchAction;
  rationale: string;
  ops: PatchOp[];
  status: 'pending' | 'applied' | 'rejected';
  createdAt: Date;
}

export interface PatchRequest {
  noteId: string;
  content: string;
  action: PatchAction;
  selection?: { from: number; to: number; text: string };
  customPrompt?: string;
  targetLanguage?: string;
}

export interface PatchResponse {
  rationale: string;
  ops: PatchOp[];
}

// Auto-suggestions from idle analysis
export interface Suggestion {
  id: string;
  action: PatchAction;
  rationale: string;
  ops: PatchOp[];
  priority: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  suggestions: Suggestion[];
  analyzedAt: Date;
  contentHash: string; // To avoid re-analyzing same content
}
