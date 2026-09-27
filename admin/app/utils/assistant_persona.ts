/**
 * Pure helpers for turning the `ai.assistantPersona` KV setting into the
 * system-prompt block RagPipelineService sends to the model.
 *
 * These live here rather than in RagPipelineService so the assembly rule —
 * trim, empty means nothing added, persona goes first, a length cap applies
 * even if a stored value somehow predates validation — can be exercised under
 * bare `node --test` with no MySQL, Redis, Qdrant, or Ollama, the same reason
 * `rag_prompt.ts` is shaped this way.
 */
import type { OllamaChatMessage } from '../../types/ollama.js'

/**
 * Character cap on a saved persona. Generous enough for several paragraphs of
 * voice/tone/instructions, small enough that a pasted document doesn't blow
 * out every request's token budget. Enforced at write time by
 * `validateSettingValue` (`#validators/settings.ts`); repeated here as a
 * defensive cap so a value that somehow predates that check (or is edited
 * directly in the database) can never grow the prompt past this size.
 */
export const ASSISTANT_PERSONA_MAX_LENGTH = 4000

/**
 * Normalize a raw `ai.assistantPersona` value into prompt-ready text.
 * Returns null for empty/whitespace-only input, so callers can tell "no
 * persona set" apart from "persona is an empty string" and skip adding a
 * system block entirely — today's behavior, unchanged, when no persona is
 * configured.
 */
export function normalizeAssistantPersona(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.length > ASSISTANT_PERSONA_MAX_LENGTH
    ? trimmed.slice(0, ASSISTANT_PERSONA_MAX_LENGTH)
    : trimmed
}

/**
 * Build the persona system message, or null when there is none to add.
 */
export function buildPersonaSystemBlock(raw: string | null | undefined): OllamaChatMessage | null {
  const persona = normalizeAssistantPersona(raw)
  return persona ? { role: 'system', content: persona } : null
}

/**
 * The persona + formatting portion of `buildPrompt`'s default system blocks
 * (the branch RagPipelineService takes when the caller supplied no system
 * message of its own). Persona is listed first so it reads as the
 * assistant's voice rather than an addendum to the formatting rules that
 * follow it; the formatting prompt itself is untouched, and is still added
 * when there is no persona, matching prior behavior exactly.
 */
export function buildDefaultSystemBlocks(
  personaRaw: string | null | undefined,
  formattingPrompt: string
): OllamaChatMessage[] {
  const blocks: OllamaChatMessage[] = []
  const personaBlock = buildPersonaSystemBlock(personaRaw)
  if (personaBlock) {
    blocks.push(personaBlock)
  }
  blocks.push({ role: 'system', content: formattingPrompt })
  return blocks
}
