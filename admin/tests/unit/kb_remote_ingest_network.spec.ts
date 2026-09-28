import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'

import {
  downloadGithubRawFile,
  downloadRemoteFile,
  fetchGithubDefaultBranch,
  fetchGithubTree,
} from '../../app/utils/kb_remote_ingest.js'

// These functions are the only place `ingestRemote()` touches the network.
// Mocking `axios.get` here means the assertions below never make a real HTTP
// call -- no live GitHub API, no rate-limit risk, no flake from network
// conditions in CI. Each test restores the mock in `afterEach`.

test('fetchGithubDefaultBranch: returns default_branch from the repo API response', async (t) => {
  const getMock = t.mock.method(axios, 'get', async (url: string) => {
    assert.equal(url, 'https://api.github.com/repos/PacsArcade/project-nomad')
    return { data: { default_branch: 'dev' } }
  })
  const branch = await fetchGithubDefaultBranch('PacsArcade', 'project-nomad')
  assert.equal(branch, 'dev')
  assert.equal(getMock.mock.callCount(), 1)
})

test('fetchGithubDefaultBranch: a 404 becomes a clear "not found or private" error', async (t) => {
  t.mock.method(axios, 'get', async () => {
    const err: any = new Error('Request failed with status code 404')
    err.response = { status: 404 }
    throw err
  })
  await assert.rejects(() => fetchGithubDefaultBranch('o', 'missing'), /not found.*private/)
})

test('fetchGithubDefaultBranch: a 403 becomes a rate-limit error', async (t) => {
  t.mock.method(axios, 'get', async () => {
    const err: any = new Error('Request failed with status code 403')
    err.response = { status: 403 }
    throw err
  })
  await assert.rejects(() => fetchGithubDefaultBranch('o', 'r'), /rate limit/)
})

test('fetchGithubTree: returns the tree array and surfaces truncated', async (t) => {
  t.mock.method(axios, 'get', async (url: string) => {
    assert.match(url, /\/git\/trees\/main\?recursive=1$/)
    return {
      data: {
        truncated: true,
        tree: [
          { path: 'README.md', type: 'blob', size: 12 },
          { path: 'src', type: 'tree' },
        ],
      },
    }
  })
  const result = await fetchGithubTree('o', 'r', 'main')
  assert.equal(result.truncated, true)
  assert.equal(result.tree.length, 2)
  assert.equal(result.tree[0].path, 'README.md')
})

test('fetchGithubTree: a missing tree field returns an empty array rather than throwing', async (t) => {
  t.mock.method(axios, 'get', async () => ({ data: {} }))
  const result = await fetchGithubTree('o', 'r', 'main')
  assert.deepEqual(result.tree, [])
  assert.equal(result.truncated, false)
})

test('downloadRemoteFile: returns the response body as a Buffer', async (t) => {
  const payload = Buffer.from('hello world')
  t.mock.method(axios, 'get', async (url: string, opts: any) => {
    assert.equal(url, 'https://example.com/a.txt')
    assert.equal(opts.responseType, 'arraybuffer')
    return { data: payload }
  })
  const buffer = await downloadRemoteFile('https://example.com/a.txt')
  assert.ok(Buffer.isBuffer(buffer))
  assert.equal(buffer.toString('utf-8'), 'hello world')
})

test('downloadRemoteFile: a 404 becomes a clear "file not found" error', async (t) => {
  t.mock.method(axios, 'get', async () => {
    const err: any = new Error('Request failed with status code 404')
    err.response = { status: 404 }
    throw err
  })
  await assert.rejects(() => downloadRemoteFile('https://example.com/missing.pdf'), /not found/)
})

test('downloadGithubRawFile: builds the raw.githubusercontent.com URL and encodes the path', async (t) => {
  t.mock.method(axios, 'get', async (url: string) => {
    assert.equal(url, 'https://raw.githubusercontent.com/o/r/main/docs/a%20b.md')
    return { data: Buffer.from('content') }
  })
  const buffer = await downloadGithubRawFile('o', 'r', 'main', 'docs/a b.md')
  assert.equal(buffer.toString('utf-8'), 'content')
})

test('downloadGithubRawFile: passes the maxContentLength cap through to axios', async (t) => {
  t.mock.method(axios, 'get', async (_url: string, opts: any) => {
    assert.equal(opts.maxContentLength, 1234)
    return { data: Buffer.from('x') }
  })
  await downloadGithubRawFile('o', 'r', 'main', 'a.md', 1234)
})
