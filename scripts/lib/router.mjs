export const KNOWN_PROVIDERS = new Set(['codex', 'copilot', 'claude']);

// Routing rule per PRD §"Routing rule (deliberately dumb)":
// Use the provider from the nearest tagged-good past delegation.
// Fall back to Codex when no tagged-good match exists or provider is unrecognised.
export function pickProvider(retrievedPastDelegations) {
  if (!Array.isArray(retrievedPastDelegations)) return 'codex';
  const nearestGood = retrievedPastDelegations.find((d) => d.tag === 'good');
  const provider = nearestGood?.provider;
  return KNOWN_PROVIDERS.has(provider) ? provider : 'codex';
}
