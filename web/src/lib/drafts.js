const DRAFTS_KEY = 'fitcoach-admin-offline-drafts';

export function queueDraft(draft) {
  const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
  drafts.push({ ...draft, queuedAt: new Date().toISOString() });
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}
