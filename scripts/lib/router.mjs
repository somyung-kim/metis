// Routing rule per PRD §"Routing rule (deliberately dumb)":
// Use the provider from the nearest tagged-good past delegation.
// Fall back to Codex when no tagged-good match exists.
export function pickProvider(retrievedPastDelegations) {
  const nearestGood = retrievedPastDelegations.find((d) => d.tag === 'good');
  return nearestGood ? nearestGood.provider : 'codex';
}
