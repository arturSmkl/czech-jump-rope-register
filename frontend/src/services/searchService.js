/**
 * Client-side search across collective and registered members.
 * Matches partial names, case-insensitive.
 *
 * @param {string} query - The search query.
 * @param {Array} collectiveMembers - All collective members with { id, name, ... }.
 * @param {Array} registeredMembers - All registered members with { id, first_name, last_name, ... }.
 * @returns {{ matchingCollectiveIds: Set<string>, matchingRegisteredIds: Set<string> }}
 */
export function searchMembers(query, collectiveMembers, registeredMembers) {
  const q = query.trim().toLowerCase();

  const matchingCollectiveIds = new Set();
  const matchingRegisteredIds = new Set();

  if (!q) {
    return { matchingCollectiveIds: null, matchingRegisteredIds: null };
  }

  for (const cm of collectiveMembers) {
    const name = (cm.name || '').toLowerCase();
    if (name.includes(q)) {
      matchingCollectiveIds.add(cm.id);
    }
  }

  for (const rm of registeredMembers) {
    const firstName = (rm.first_name || '').toLowerCase();
    const lastName = (rm.last_name || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`;
    if (firstName.includes(q) || lastName.includes(q) || fullName.includes(q)) {
      matchingRegisteredIds.add(rm.id);
      // Also include the parent collective so it shows up in the list
      if (rm.collective_member_ref) {
        matchingCollectiveIds.add(rm.collective_member_ref);
      }
    }
  }

  return { matchingCollectiveIds, matchingRegisteredIds };
}
