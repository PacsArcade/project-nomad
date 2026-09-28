import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertIngestableUrl,
  buildRemoteRepoDir,
  exceedsIngestCap,
  filterTreeEntries,
  isIngestableExtension,
  KB_REMOTE_MAX_TOTAL_BYTES,
  parseGithubUrl,
  sanitizeRelativePath,
} from '../../app/utils/kb_remote_ingest.js'

// ---------- assertIngestableUrl: bad scheme, private IP, cloud metadata ----------

test('assertIngestableUrl: rejects a non-https scheme', () => {
  assert.throws(() => assertIngestableUrl('http://github.com/owner/repo'), /https/)
  assert.throws(() => assertIngestableUrl('ftp://github.com/owner/repo'), /https/)
})

test('assertIngestableUrl: rejects loopback and link-local hosts', () => {
  assert.throws(() => assertIngestableUrl('https://127.0.0.1/repo.zip'), /loopback|link-local/)
  assert.throws(() => assertIngestableUrl('https://localhost/repo.zip'), /loopback|link-local/)
  assert.throws(() => assertIngestableUrl('https://169.254.1.1/repo.zip'), /loopback|link-local/)
})

test('assertIngestableUrl: rejects the cloud instance-metadata endpoint', () => {
  // 169.254.169.254 is itself in the link-local range, so assertNotPrivateUrl
  // (checked first) blocks it before assertNotCloudMetadataUrl's more specific
  // "instance metadata" message would ever fire. Either way it must throw.
  assert.throws(
    () => assertIngestableUrl('https://169.254.169.254/latest/meta-data/'),
    /loopback|link-local|instance metadata/
  )
})

test('assertIngestableUrl: allows a normal public https URL', () => {
  assert.doesNotThrow(() =>
    assertIngestableUrl('https://github.com/Crosstalk-Solutions/project-nomad')
  )
  assert.doesNotThrow(() =>
    assertIngestableUrl('https://raw.githubusercontent.com/o/r/main/README.md')
  )
})

// ---------- oversize ----------

test('exceedsIngestCap: flags a buffer over the 50MB cap', () => {
  assert.equal(exceedsIngestCap(KB_REMOTE_MAX_TOTAL_BYTES + 1), true)
  assert.equal(exceedsIngestCap(KB_REMOTE_MAX_TOTAL_BYTES), false)
  assert.equal(exceedsIngestCap(1024), false)
})

// ---------- isIngestableExtension ----------

test('isIngestableExtension: allows the documented set, case-insensitively', () => {
  for (const name of ['a.md', 'a.MD', 'a.txt', 'a.rtf', 'a.pdf', 'a.docx', 'a.epub']) {
    assert.equal(isIngestableExtension(name), true, name)
  }
})

test('isIngestableExtension: rejects everything else', () => {
  for (const name of ['a.png', 'a.zim', 'a.exe', 'a', 'a.json', 'a.js']) {
    assert.equal(isIngestableExtension(name), false, name)
  }
})

// ---------- parseGithubUrl ----------

test('parseGithubUrl: bare repo URL -> default branch, whole repo', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/PacsArcade/project-nomad'), {
    owner: 'PacsArcade',
    repo: 'project-nomad',
    branch: null,
    subdir: null,
    singleFilePath: null,
  })
})

test('parseGithubUrl: tree URL with a subdirectory', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/o/r/tree/main/docs/guides'), {
    owner: 'o',
    repo: 'r',
    branch: 'main',
    subdir: 'docs/guides',
    singleFilePath: null,
  })
})

test('parseGithubUrl: blob URL is a single file', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/o/r/blob/main/README.md'), {
    owner: 'o',
    repo: 'r',
    branch: 'main',
    subdir: null,
    singleFilePath: 'README.md',
  })
})

test('parseGithubUrl: raw.githubusercontent.com URL is a single file', () => {
  assert.deepEqual(parseGithubUrl('https://raw.githubusercontent.com/o/r/main/docs/a.md'), {
    owner: 'o',
    repo: 'r',
    branch: 'main',
    subdir: null,
    singleFilePath: 'docs/a.md',
  })
})

test('parseGithubUrl: non-repo GitHub paths (issues, wiki) are not a supported target', () => {
  assert.equal(parseGithubUrl('https://github.com/o/r/issues/1'), null)
  assert.equal(parseGithubUrl('https://github.com/o/r/wiki'), null)
})

test('parseGithubUrl: a non-GitHub host returns null', () => {
  assert.equal(parseGithubUrl('https://example.com/some/file.pdf'), null)
})

test('parseGithubUrl: an unparseable URL returns null rather than throwing', () => {
  assert.equal(parseGithubUrl('not a url'), null)
})

// ---------- path builders ----------

test('buildRemoteRepoDir: joins owner and repo under storage/kb_remote', () => {
  assert.equal(
    buildRemoteRepoDir('PacsArcade', 'project-nomad'),
    'storage/kb_remote/PacsArcade__project-nomad'
  )
})

test('buildRemoteRepoDir: sanitizes unsafe characters (slash, space) in owner/repo', () => {
  assert.equal(
    buildRemoteRepoDir('weird/owner', 'weird repo'),
    'storage/kb_remote/weird_owner__weird_repo'
  )
})

test('sanitizeRelativePath: strips ../ traversal and empty segments', () => {
  assert.equal(sanitizeRelativePath('docs/../../etc/passwd'), 'docs/etc/passwd')
  assert.equal(sanitizeRelativePath('a//b/./c'), 'a/b/c')
})

test('sanitizeRelativePath: throws when nothing safe is left', () => {
  assert.throws(() => sanitizeRelativePath('../..'), /Invalid remote file path/)
})

// ---------- tree filter: extensions + size cap ----------

test('filterTreeEntries: keeps only blobs with an ingestable extension', () => {
  const result = filterTreeEntries([
    { path: 'README.md', type: 'blob', size: 100 },
    { path: 'image.png', type: 'blob', size: 100 },
    { path: 'docs', type: 'tree' },
    { path: 'vendor', type: 'commit', size: 0 },
  ])
  assert.deepEqual(result.included, [{ path: 'README.md', size: 100 }])
  assert.equal(result.skippedExtension, 1)
  assert.equal(result.skippedByCap, 0)
  assert.equal(result.totalBytes, 100)
})

test('filterTreeEntries: scopes to a subdirectory when given', () => {
  const result = filterTreeEntries(
    [
      { path: 'docs/a.md', type: 'blob', size: 10 },
      { path: 'other/b.md', type: 'blob', size: 10 },
    ],
    { subdir: 'docs' }
  )
  assert.deepEqual(result.included, [{ path: 'docs/a.md', size: 10 }])
})

test('filterTreeEntries: caps by file count', () => {
  const entries = Array.from({ length: 5 }, (_, i) => ({
    path: `file-${i}.md`,
    type: 'blob',
    size: 1,
  }))
  const result = filterTreeEntries(entries, { maxFiles: 2 })
  assert.equal(result.included.length, 2)
  assert.equal(result.skippedByCap, 3)
})

test('filterTreeEntries: caps by total bytes, keeping files in path order until the cap is hit', () => {
  const entries = [
    { path: 'a.md', type: 'blob', size: 40 },
    { path: 'b.md', type: 'blob', size: 40 },
    { path: 'c.md', type: 'blob', size: 40 },
  ]
  const result = filterTreeEntries(entries, { maxTotalBytes: 90 })
  assert.deepEqual(
    result.included.map((f) => f.path),
    ['a.md', 'b.md']
  )
  assert.equal(result.totalBytes, 80)
  assert.equal(result.skippedByCap, 1)
})

test('filterTreeEntries: an empty tree yields no included files and no errors', () => {
  const result = filterTreeEntries([])
  assert.deepEqual(result.included, [])
  assert.equal(result.skippedExtension, 0)
  assert.equal(result.skippedByCap, 0)
})
