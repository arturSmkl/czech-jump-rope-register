/**
 * Return a new array of collective members sorted by name using Czech locale.
 */
export function sortCollectivesByName(collectives) {
  return [...collectives].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));
}

/**
 * True if the collective member's membership has been terminated.
 */
export function isCollectiveTerminated(cm) {
  return cm != null && cm.membership_extinction_date != null;
}
