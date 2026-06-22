import type { KnowledgeEntry } from "../types";

/**
 * A one-shot handoff used when "promoting" a learning into the Knowledge Base:
 * the Learning page stashes a partial entry here, then navigates to the
 * Knowledge Base, which consumes it once to pre-fill the New entry form.
 */
let draft: Partial<KnowledgeEntry> | null = null;

export function setKnowledgeDraft(next: Partial<KnowledgeEntry>): void {
  draft = next;
}

/** Read the pending draft without clearing it (safe to call during render). */
export function peekKnowledgeDraft(): Partial<KnowledgeEntry> | null {
  return draft;
}

/** Discard any pending draft once it's been consumed. */
export function clearKnowledgeDraft(): void {
  draft = null;
}
