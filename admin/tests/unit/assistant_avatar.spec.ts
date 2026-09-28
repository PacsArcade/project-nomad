import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ASSISTANT_AVATAR_ALLOWED_FORMATS,
  ASSISTANT_AVATAR_MAX_BYTES,
  assistantAvatarAltText,
  assistantAvatarFilename,
  exceedsAssistantAvatarSizeLimit,
  isAllowedAssistantAvatarFormat,
} from '../../app/utils/assistant_avatar.js'

test('isAllowedAssistantAvatarFormat accepts every allowed format', () => {
  for (const format of ASSISTANT_AVATAR_ALLOWED_FORMATS) {
    assert.equal(isAllowedAssistantAvatarFormat(format), true, format)
  }
})

test('isAllowedAssistantAvatarFormat rejects everything else, including svg', () => {
  for (const format of ['svg', 'bmp', 'tiff', 'avif', 'heic', '', null, undefined]) {
    assert.equal(isAllowedAssistantAvatarFormat(format), false, String(format))
  }
})

test('exceedsAssistantAvatarSizeLimit is false at and under the cap, true over it', () => {
  assert.equal(exceedsAssistantAvatarSizeLimit(0), false)
  assert.equal(exceedsAssistantAvatarSizeLimit(ASSISTANT_AVATAR_MAX_BYTES), false)
  assert.equal(exceedsAssistantAvatarSizeLimit(ASSISTANT_AVATAR_MAX_BYTES + 1), true)
})

test('assistantAvatarFilename is fixed per format, with jpeg mapped to .jpg', () => {
  assert.equal(assistantAvatarFilename('jpeg'), 'assistant-avatar.jpg')
  assert.equal(assistantAvatarFilename('png'), 'assistant-avatar.png')
  assert.equal(assistantAvatarFilename('webp'), 'assistant-avatar.webp')
  assert.equal(assistantAvatarFilename('gif'), 'assistant-avatar.gif')
})

test('assistantAvatarFilename produces one distinct filename per allowed format', () => {
  const filenames = ASSISTANT_AVATAR_ALLOWED_FORMATS.map((f) => assistantAvatarFilename(f))
  assert.equal(new Set(filenames).size, filenames.length)
})

test('assistantAvatarAltText uses the configured assistant name, trimmed', () => {
  assert.equal(assistantAvatarAltText('  Lumen  '), 'Lumen avatar')
})

test('assistantAvatarAltText falls back to "AI Assistant" when unset or blank', () => {
  for (const name of [null, undefined, '', '   ']) {
    assert.equal(assistantAvatarAltText(name), 'AI Assistant avatar')
  }
})
