/** Content script -> background: how many blocks were handled on this page. */
export interface HandledCountMessage {
  type: 'handled-count';
  count: number;
}

/** Popup -> content script: temporarily show (or re-apply) the hidden blocks on this page. */
export interface ShowOnceMessage {
  type: 'show-once';
  /** true: reveal everything now. false: go back to the configured mode. */
  reveal: boolean;
}

/** Popup -> content script: ask for the current page state. */
export interface PageStateRequest {
  type: 'page-state';
}

export interface PageStateResponse {
  handled: number;
  revealed: boolean;
}

export type RuntimeMessage = HandledCountMessage | ShowOnceMessage | PageStateRequest;

export function isRuntimeMessage(v: unknown): v is RuntimeMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  switch (m.type) {
    case 'handled-count':
      return typeof m.count === 'number' && Number.isFinite(m.count);
    case 'show-once':
      return typeof m.reveal === 'boolean';
    case 'page-state':
      return true;
    default:
      return false;
  }
}
