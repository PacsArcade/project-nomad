import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateSettingValue } from '../../app/validators/settings.js'
import { ASSISTANT_PERSONA_MAX_LENGTH } from '../../app/utils/assistant_persona.js'

test('ai.assistantPersona accepts empty (clears the setting)', () => {
  for (const value of ['', null, undefined]) {
    assert.equal(validateSettingValue('ai.assistantPersona', value), null, String(value))
  }
})

test('ai.assistantPersona accepts text up to the max length', () => {
  assert.equal(validateSettingValue('ai.assistantPersona', 'Be warm and encouraging.'), null)
  assert.equal(
    validateSettingValue('ai.assistantPersona', 'a'.repeat(ASSISTANT_PERSONA_MAX_LENGTH)),
    null
  )
})

test('ai.assistantPersona rejects text over the max length', () => {
  const error = validateSettingValue(
    'ai.assistantPersona',
    'a'.repeat(ASSISTANT_PERSONA_MAX_LENGTH + 1)
  )
  assert.notEqual(error, null)
})

test('ai.assistantPersona rejects a non-string value', () => {
  assert.notEqual(validateSettingValue('ai.assistantPersona', 12345), null)
})
