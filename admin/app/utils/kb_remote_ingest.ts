import { extname } from 'node:path'
import axios from 'axios'
import { assertNotCloudMetadataUrl, assertNotPrivateUrl } from '../validators/common.js'

/**
 * Pure helpers for "ingest a public GitHub repository or URL" into the
 * Knowledge Base. Kept free of axios/fs/Qdrant so the URL parsing, path
 * sanitizing, and tree-filtering rules can be unit tested without a network
 * call or a running service -- the same split the codebase already uses for
 * `kb_ingest_decision.ts` / `kb_orphan_decision.ts`. The network calls
 * (GitHub API, raw.githubusercontent.com) and the actual dispatch live on
 * `RagService.ingestRemote()`.
 */

/** Root directory remote-ingested files are written under, mirrored by
 *  `RagService.getStoredFiles()` when it classifies `isUserUpload`. */
export const KB_REMOTE_STORAGE_PATH = 'storage/kb_remote'

/** File types the rest of the pipeline (fs.ts `determineFileType`,
 *  `RagService` text extraction) knows how to embed. Images and .zim are
 *  deliberately excluded -- they aren't "documents" in a GitHub repo/URL. */
export const INGESTABLE_EXTENSIONS = ['.md', '.txt', '.rtf', '.pdf', '.docx', '.epub'] as const

/** Hard cap on a single ingest: at most this many files... */
export const KB_REMOTE_MAX_FILES = 200
/** ...or this many total bytes, whichever is hit first. */
export const KB_REMOTE_MAX_TOTAL_BYTES = 50 * 1024 * 1024 // 50 MB

export function isIngestableExtension(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return (INGESTABLE_EXTENSIONS as readonly string[]).includes(ext)
}

/** True once a downloaded file (or a running total) would exceed the per-ingest byte cap. */
export function exceedsIngestCap(
  sizeBytes: number,
  maxTotalBytes: number = KB_REMOTE_MAX_TOTAL_BYTES
): boolean {
  return sizeBytes > maxTotalBytes
}

/**
 * Validates a user-supplied ingest URL. Deliberately stricter than the
 * existing "remote service" guards: this feature reaches out to the public
 * internet (GitHub), so https-only plus both SSRF guards apply, unlike
 * `assertNotCloudMetadataUrl` alone (used for LAN Ollama-compatible
 * endpoints, which intentionally allows http and RFC1918 hosts).
 * Throws on an invalid URL.
 */
export function assertIngestableUrl(urlString: string): void {
  const parsed = new URL(urlString)
  if (parsed.protocol !== 'https:') {
    throw new Error(`Ingest URL must use https: ${parsed.protocol}`)
  }
  // Blocks loopback / link-local hosts (RFC1918 LAN hosts are still allowed by
  // this guard, same as everywhere else it's used -- a self-hosted git mirror
  // on the LAN is a legitimate target).
  assertNotPrivateUrl(urlString)
  // Blocks the cloud instance-metadata endpoint (169.254.169.254 / fd00:ec2::254).
  assertNotCloudMetadataUrl(urlString)
}

export interface GithubIngestTarget {
  owner: string
  repo: string
  /** Explicit branch from the URL, or null to mean "use the repo's default branch". */
  branch: string | null
  /** Subdirectory to scope a `tree/<branch>/<subdir>` link to, or null for the whole repo. */
  subdir: string | null
  /** Set when the URL points at exactly one file (a `blob/` link or a raw.githubusercontent.com link). */
  singleFilePath: string | null
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const RAW_GITHUB_HOST = 'raw.githubusercontent.com'

/**
 * Recognizes:
 *   - https://github.com/<owner>/<repo>                       (whole repo, default branch)
 *   - https://github.com/<owner>/<repo>/tree/<branch>/<subdir> (subdirectory of a branch)
 *   - https://github.com/<owner>/<repo>/blob/<branch>/<path>   (single file)
 *   - https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path> (single file)
 * Anything else (issues, pulls, releases, wiki, a non-GitHub host, or an
 * unparseable URL) returns null -- the caller falls back to treating the URL
 * as a single arbitrary file to download directly.
 */
export function parseGithubUrl(urlString: string): GithubIngestTarget | null {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  const segments = parsed.pathname.split('/').filter(Boolean)

  if (host === RAW_GITHUB_HOST) {
    if (segments.length < 4) return null
    const [owner, repo, branch, ...pathParts] = segments
    return {
      owner: decodeURIComponent(owner),
      repo: decodeURIComponent(repo),
      branch: decodeURIComponent(branch),
      subdir: null,
      singleFilePath: pathParts.map(decodeURIComponent).join('/'),
    }
  }

  if (!GITHUB_HOSTS.has(host)) return null
  if (segments.length < 2) return null

  const [owner, repo, mode, branch, ...rest] = segments

  if (!mode) {
    return {
      owner: decodeURIComponent(owner),
      repo: decodeURIComponent(repo),
      branch: null,
      subdir: null,
      singleFilePath: null,
    }
  }

  if ((mode === 'tree' || mode === 'blob') && branch) {
    const relPath = rest.map(decodeURIComponent).join('/')
    if (mode === 'blob') {
      if (!relPath) return null
      return {
        owner: decodeURIComponent(owner),
        repo: decodeURIComponent(repo),
        branch: decodeURIComponent(branch),
        subdir: null,
        singleFilePath: relPath,
      }
    }
    return {
      owner: decodeURIComponent(owner),
      repo: decodeURIComponent(repo),
      branch: decodeURIComponent(branch),
      subdir: relPath || null,
      singleFilePath: null,
    }
  }

  return null
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/** Directory name a repo's files are written under: `storage/kb_remote/<owner>__<repo>`. */
export function buildRemoteRepoDir(owner: string, repo: string): string {
  return `${KB_REMOTE_STORAGE_PATH}/${sanitizePathSegment(owner)}__${sanitizePathSegment(repo)}`
}

/**
 * Normalizes a repo-relative file path (as returned by the GitHub Trees API)
 * into a safe on-disk relative path: strips empty/`.`/`..` segments and
 * sanitizes each remaining segment, so a crafted tree entry can't escape
 * `storage/kb_remote/<owner>__<repo>/` via path traversal.
 */
export function sanitizeRelativePath(relPath: string): string {
  const cleaned = relPath
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .map(sanitizePathSegment)
  if (cleaned.length === 0) {
    throw new Error(`Invalid remote file path: ${relPath}`)
  }
  return cleaned.join('/')
}

export interface GithubTreeEntry {
  path: string
  /** `blob` (file), `tree` (directory), or `commit` (submodule) per the Git Trees API. */
  type: string
  size?: number
}

export interface FilteredTreeResult {
  included: Array<{ path: string; size: number }>
  /** Candidate files (blobs, in scope) filtered out for not matching `INGESTABLE_EXTENSIONS`. */
  skippedExtension: number
  /** Files that matched but were cut by the file-count or total-bytes cap. */
  skippedByCap: number
  totalBytes: number
}

/**
 * Filters a GitHub Trees API listing down to what `ingestRemote()` will
 * actually download: files only (no directories/submodules), optionally
 * scoped to a subdirectory, restricted to `INGESTABLE_EXTENSIONS`, and capped
 * at `maxFiles` / `maxTotalBytes`. Sorted by path so results (and which files
 * land on which side of the cap) are deterministic.
 */
export function filterTreeEntries(
  entries: GithubTreeEntry[],
  opts: { subdir?: string | null; maxFiles?: number; maxTotalBytes?: number } = {}
): FilteredTreeResult {
  const maxFiles = opts.maxFiles ?? KB_REMOTE_MAX_FILES
  const maxTotalBytes = opts.maxTotalBytes ?? KB_REMOTE_MAX_TOTAL_BYTES
  const subdirPrefix = opts.subdir ? `${opts.subdir.replace(/\/+$/, '')}/` : null

  const blobsInScope = entries.filter(
    (entry) => entry.type === 'blob' && (!subdirPrefix || entry.path.startsWith(subdirPrefix))
  )
  const candidates = blobsInScope
    .filter((entry) => isIngestableExtension(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path))

  const included: Array<{ path: string; size: number }> = []
  let totalBytes = 0
  let skippedByCap = 0

  for (const entry of candidates) {
    const size = entry.size ?? 0
    if (included.length >= maxFiles || totalBytes + size > maxTotalBytes) {
      skippedByCap++
      continue
    }
    included.push({ path: entry.path, size })
    totalBytes += size
  }

  return {
    included,
    skippedExtension: blobsInScope.length - candidates.length,
    skippedByCap,
    totalBytes,
  }
}

// ---------------------------------------------------------------------------
// Network calls. Kept as standalone functions (rather than RagService
// methods) so they can be unit tested with axios mocked -- no Qdrant/Redis/
// BullMQ needed, unlike a full RagService.ingestRemote() call which ends in
// EmbedFileJob.dispatch() (requires a live queue connection).
// ---------------------------------------------------------------------------

async function githubApiGet<T>(url: string): Promise<T> {
  try {
    const response = await axios.get<T>(url, {
      timeout: 15000,
      headers: { Accept: 'application/vnd.github+json' },
    })
    return response.data
  } catch (error: any) {
    const status = error?.response?.status
    if (status === 404) {
      throw new Error('GitHub repository or branch not found (or it is private).')
    }
    if (status === 403) {
      throw new Error(
        'GitHub API rate limit reached. NOMAD calls the GitHub API unauthenticated (60 requests/hour), try again later.'
      )
    }
    throw new Error(`Could not reach GitHub: ${error?.message || 'unknown error'}`)
  }
}

export async function fetchGithubDefaultBranch(owner: string, repo: string): Promise<string> {
  const data = await githubApiGet<{ default_branch: string }>(
    `https://api.github.com/repos/${owner}/${repo}`
  )
  return data.default_branch
}

export interface GithubTreeResult {
  tree: GithubTreeEntry[]
  truncated: boolean
}

export async function fetchGithubTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GithubTreeResult> {
  const data = await githubApiGet<{ tree: GithubTreeEntry[]; truncated?: boolean }>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )
  return { tree: data.tree ?? [], truncated: Boolean(data.truncated) }
}

export async function downloadRemoteFile(
  url: string,
  maxContentLength: number = KB_REMOTE_MAX_TOTAL_BYTES
): Promise<Buffer> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength,
    })
    return Buffer.from(response.data)
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new Error(`File not found: ${url}`)
    }
    throw new Error(`Could not download ${url}: ${error?.message || 'unknown error'}`)
  }
}

export async function downloadGithubRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  maxContentLength: number = KB_REMOTE_MAX_TOTAL_BYTES
): Promise<Buffer> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`
  return downloadRemoteFile(url, maxContentLength)
}
