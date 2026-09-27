/**
 * Pure helpers for validating and naming an uploaded assistant-avatar image.
 *
 * Mirrors the shape of `admin/app/utils/chat_images.ts` (the decoded format
 * sharp reports is what is trusted, not the client-supplied extension; an
 * explicit size cap) but for a single persisted avatar file rather than an
 * ephemeral chat attachment. Kept separate from SettingsController so the
 * cap/format/naming rules are unit-testable without touching the filesystem,
 * sharp, or the database.
 */

/**
 * Raster formats sharp may report for a decoded image. A deliberately small,
 * well-known set — SVG is excluded so an uploaded avatar can never carry
 * embedded script or external references. Intentionally close to
 * chat_images.ts's SUPPORTED_IMAGE_FORMATS, plus GIF (a still image here;
 * animation is not preserved).
 */
export const ASSISTANT_AVATAR_ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif'] as const
export type AssistantAvatarFormat = (typeof ASSISTANT_AVATAR_ALLOWED_FORMATS)[number]

/**
 * Extensions accepted at the upload boundary (AdonisJS's `extnames` file
 * option, checked against the client-supplied filename before the file is
 * even read from disk). This is just a cheap early rejection; the decoded
 * sharp format is the real gate, applied afterward.
 */
export const ASSISTANT_AVATAR_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

/**
 * Generous for a small round avatar image; the same order of magnitude as
 * the other single-image upload in this app (chat attachments cap at 8 MB).
 */
export const ASSISTANT_AVATAR_MAX_BYTES = 4 * 1024 * 1024 // 4 MB

/** Directory under the persisted storage volume the avatar file lives in. */
export const ASSISTANT_AVATAR_STORAGE_PATH = 'storage/assistant'

export function isAllowedAssistantAvatarFormat(
  format: string | null | undefined
): format is AssistantAvatarFormat {
  return !!format && (ASSISTANT_AVATAR_ALLOWED_FORMATS as readonly string[]).includes(format)
}

export function exceedsAssistantAvatarSizeLimit(bytes: number): boolean {
  return bytes > ASSISTANT_AVATAR_MAX_BYTES
}

/**
 * Filename to store the avatar under. Fixed per format (not per-upload
 * random) so a later upload in the same format replaces the previous file
 * with no orphans left behind; the caller removes the other formats' files
 * when the format changes between uploads.
 */
export function assistantAvatarFilename(format: AssistantAvatarFormat): string {
  const ext = format === 'jpeg' ? 'jpg' : format
  return `assistant-avatar.${ext}`
}

/**
 * Alt text for the rendered <img>, using the assistant's configured name (or
 * the generic fallback) so it reads naturally either way.
 */
export function assistantAvatarAltText(assistantName: string | null | undefined): string {
  const name = assistantName?.trim() || 'AI Assistant'
  return `${name} avatar`
}
