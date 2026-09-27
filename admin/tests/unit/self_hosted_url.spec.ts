import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { isSelfHostedOllamaUrl } from '../../app/utils/self_hosted_url.js'

test('treats the Docker and Podman host names as this machine', () => {
  assert.equal(isSelfHostedOllamaUrl('http://host.docker.internal:11434'), true)
  assert.equal(isSelfHostedOllamaUrl('http://gateway.docker.internal:11434'), true)
  assert.equal(isSelfHostedOllamaUrl('http://host.containers.internal:11434'), true)
  assert.equal(isSelfHostedOllamaUrl('http://HOST.CONTAINERS.INTERNAL:11434'), true)
})

test('treats loopback as this machine', () => {
  assert.equal(isSelfHostedOllamaUrl('http://localhost:11434'), true)
  assert.equal(isSelfHostedOllamaUrl('http://127.0.0.1:11434'), true)
  assert.equal(isSelfHostedOllamaUrl('http://[::1]:11434'), true)
})

test('does not treat LAN addresses or other names as this machine', () => {
  assert.equal(isSelfHostedOllamaUrl('http://192.168.1.50:11434'), false)
  assert.equal(isSelfHostedOllamaUrl('http://containers.internal:11434'), false)
  assert.equal(isSelfHostedOllamaUrl('http://ollama.example.com:11434'), false)
  assert.equal(isSelfHostedOllamaUrl('not a url'), false)
})
