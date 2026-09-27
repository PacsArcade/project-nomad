import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ASSISTANT_PERSONA_MAX_LENGTH,
  buildDefaultSystemBlocks,
  buildPersonaSystemBlock,
  normalizeAssistantPersona,
} from '../../app/utils/assistant_persona.js'

test('empty persona produces the exact same default system blocks as before the feature existed', () => {
  const FORMATTING_PROMPT = 'Format all responses using markdown.'
  assert.deepEqual(buildDefaultSystemBlocks(null, FORMATTING_PROMPT), [
    { role: 'system', content: FORMATTING_PROMPT },
  ])
  assert.deepEqual(buildDefaultSystemBlocks(undefined, FORMATTING_PROMPT), [
    { role: 'system', content: FORMATTING_PROMPT },
  ])
  assert.deepEqual(buildDefaultSystemBlocks('   ', FORMATTING_PROMPT), [
    { role: 'system', content: FORMATTING_PROMPT },
  ])
  assert.deepEqual(buildDefaultSystemBlocks('', FORMATTING_PROMPT), [
    { role: 'system', content: FORMATTING_PROMPT },
  ])
})

test('a persona is included once, first, and trimmed', () => {
  const FORMATTING_PROMPT = 'Format all responses using markdown.'
  const blocks = buildDefaultSystemBlocks(
    '  Answer like a patient outdoor-skills instructor.  ',
    FORMATTING_PROMPT
  )
  assert.equal(blocks.length, 2)
  assert.deepEqual(blocks[0], {
    role: 'system',
    content: 'Answer like a patient outdoor-skills instructor.',
  })
  assert.deepEqual(blocks[1], { role: 'system', content: FORMATTING_PROMPT })
  // Included once: the persona text does not also leak into the formatting block.
  assert.equal(blocks[1].content.includes('outdoor-skills'), false)
})

test('normalizeAssistantPersona caps length defensively', () => {
  const tooLong = 'a'.repeat(ASSISTANT_PERSONA_MAX_LENGTH + 500)
  const normalized = normalizeAssistantPersona(tooLong)
  assert.equal(normalized?.length, ASSISTANT_PERSONA_MAX_LENGTH)
})

test('normalizeAssistantPersona accepts a value exactly at the cap unchanged', () => {
  const atCap = 'b'.repeat(ASSISTANT_PERSONA_MAX_LENGTH)
  assert.equal(normalizeAssistantPersona(atCap), atCap)
})

test('buildPersonaSystemBlock returns null for nothing to say', () => {
  assert.equal(buildPersonaSystemBlock(null), null)
  assert.equal(buildPersonaSystemBlock(undefined), null)
  assert.equal(buildPersonaSystemBlock(''), null)
  assert.equal(buildPersonaSystemBlock('   \n\t  '), null)
})

test('buildPersonaSystemBlock returns a single system message with the trimmed text', () => {
  const block = buildPersonaSystemBlock('\n  Be concise.  \n')
  assert.deepEqual(block, { role: 'system', content: 'Be concise.' })
})
