/**
 * Does `ai.remoteOllamaUrl` point back at the machine NOMAD itself runs on?
 *
 * The submission gate exists because a remote AI host makes the AI channel
 * describe someone else's hardware. That reasoning does not apply when the
 * "remote" host is this same box — the commonest case being Ollama installed
 * natively on the host while NOMAD runs in Docker, which is how the AI
 * assistant is expected to work on macOS.
 *
 * `host.docker.internal` is the meaningful entry: from inside the admin
 * container it resolves to the host, and it is the form the setup flow accepts
 * for a native host install. `host.containers.internal` is Podman's built-in
 * name for the same host, so a Podman install reaching Ollama on its own host
 * counts as this machine too. Loopback is included for completeness (it only
 * reaches the container itself, so it is unlikely to have been saved, but it
 * unambiguously is not another machine).
 *
 * A LAN address is DELIBERATELY NOT exempt. `192.168.1.50` is indistinguishable
 * from another box on the same network, and wrongly exempting one would let a
 * genuinely remote GPU's throughput be attributed to this hardware. False
 * blocks are recoverable by clearing the setting; a false pass silently
 * corrupts the leaderboard.
 */
export function isSelfHostedOllamaUrl(rawUrl: string): boolean {
  let host: string
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase()
  } catch {
    return false
  }
  if (
    host === 'host.docker.internal' ||
    host === 'gateway.docker.internal' ||
    host === 'host.containers.internal'
  )
    return true
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true
  // 127.0.0.0/8 — the whole loopback range, not just 127.0.0.1.
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}
