import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { bootServicesApp } from './helpers/boot_services_app.js'

// ContainerRegistryService touches the `@adonisjs/core/services/logger`
// singleton, which throws without a booted app under plain `node --test`.
// Boot the minimal app first, then dynamic-import the service (a static
// import would evaluate it before the boot finishes).
await bootServicesApp()
const { ContainerRegistryService } = await import('../../app/services/container_registry_service.js')

// ── Digest-pinned image references (T-585) ─────────────────────────────────
// A "name:tag@sha256:..." pin must keep its real tag so version checks still
// work; before the fix the digest's own colon won the last-colon tag split
// and the digest hex was misread as the tag, which is why the catalog could
// only tag-pin (the File Browser v2.63.23 note in service_seeder.ts).

const registry = new ContainerRegistryService()
const IV_DIGEST = 'sha256:eb81dfa99d38c0778e4e713a6bd697db7557755eff8e5e69ae26d6a225438b41'

test('tag@digest keeps the tag and exposes the digest', () => {
  const p = registry.parseImageReference(`copyparty/iv:1.20.25@${IV_DIGEST}`)
  assert.equal(p.registry, 'registry-1.docker.io')
  assert.equal(p.fullName, 'copyparty/iv')
  assert.equal(p.repo, 'iv')
  assert.equal(p.namespace, 'copyparty')
  assert.equal(p.tag, '1.20.25')
  assert.equal(p.digest, IV_DIGEST)
})

test('registry-qualified digest pin parses the same way', () => {
  const p = registry.parseImageReference('ghcr.io/stirling-tools/s-pdf:3.1.0@sha256:abc123')
  assert.equal(p.registry, 'ghcr.io')
  assert.equal(p.fullName, 'stirling-tools/s-pdf')
  assert.equal(p.tag, '3.1.0')
  assert.equal(p.digest, 'sha256:abc123')
})

test('digest-only reference (no tag) falls back to latest, digest kept', () => {
  const p = registry.parseImageReference(`copyparty/iv@${IV_DIGEST}`)
  assert.equal(p.tag, 'latest')
  assert.equal(p.digest, IV_DIGEST)
})

test('plain tag and bare name are unchanged (no digest)', () => {
  const tagged = registry.parseImageReference('ollama/ollama:0.18.1')
  assert.equal(tagged.tag, '0.18.1')
  assert.equal(tagged.digest, undefined)
  const bare = registry.parseImageReference('nginx')
  assert.equal(bare.tag, 'latest')
  assert.equal(bare.fullName, 'library/nginx')
  assert.equal(bare.digest, undefined)
})

test('registry with port still parses (colon before slash is not a tag)', () => {
  const p = registry.parseImageReference('localhost:5000/my/image:2.0@sha256:def456')
  assert.equal(p.registry, 'localhost:5000')
  assert.equal(p.fullName, 'my/image')
  assert.equal(p.tag, '2.0')
  assert.equal(p.digest, 'sha256:def456')
})
