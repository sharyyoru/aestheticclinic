/**
 * Central Retell AI agent IDs. All call/chat routes should import from here so
 * the English/French agents stay in sync and can be overridden via environment
 * variables without touching every route.
 *
 * To change an agent in the Retell dashboard without redeploying, set the
 * matching RETELL_*_AGENT_ID env var to the new agent_id.
 */

export const RETELL_ENGLISH_VOICE_AGENT =
  process.env.RETELL_ENGLISH_VOICE_AGENT_ID || "agent_c753d21834b3e1f19f8536b3dc";

export const RETELL_FRENCH_VOICE_AGENT =
  process.env.RETELL_FRENCH_VOICE_AGENT_ID || "agent_cede618e4c574cb4e481461be7";

export const RETELL_ENGLISH_OUTBOUND_AGENT =
  process.env.RETELL_ENGLISH_OUTBOUND_AGENT_ID || "agent_eae6c598f3b68c71c9e1ae6aad";

export const RETELL_FRENCH_OUTBOUND_AGENT =
  process.env.RETELL_FRENCH_OUTBOUND_AGENT_ID || "agent_b347fa0d08519c114af295671d";

export const RETELL_ENGLISH_CHAT_AGENT =
  process.env.RETELL_ENGLISH_CHAT_AGENT_ID || "agent_49322ed02ae4ea55665d81536c";

export const RETELL_FRENCH_CHAT_AGENT =
  process.env.RETELL_FRENCH_CHAT_AGENT_ID || "agent_a51872ec8ad4ab730a41c8ad38";

/** All agent IDs that are known to speak French. Used by webhooks to pick French content. */
export const RETELL_FRENCH_AGENT_IDS = new Set([
  RETELL_FRENCH_VOICE_AGENT,
  RETELL_FRENCH_OUTBOUND_AGENT,
  RETELL_FRENCH_CHAT_AGENT,
  // Legacy IDs kept for backward compatibility with calls already in flight.
  "agent_16738cdb79c26e811fc1cffcc6",
]);
