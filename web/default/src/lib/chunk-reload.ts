/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * Self-healing guard for stale lazy-loaded chunks.
 *
 * After a new deploy (e.g. merging an upstream update and rebuilding), a tab
 * that is still running the previous build holds references to content-hashed
 * async chunks that no longer exist on the server. The next route-level
 * `import()` then fails with a "ChunkLoadError" / "Failed to fetch dynamically
 * imported module" and surfaces as a full-page error.
 *
 * This guard listens for those specific failures and reloads the page once so
 * the browser fetches the fresh `index.html` (served with `no-cache`) and the
 * matching chunk URLs. A short cooldown stored in `sessionStorage` prevents an
 * infinite reload loop if the failure is not actually version-skew related.
 */

const COOLDOWN_KEY = 'app:chunk-reload-at'
const COOLDOWN_MS = 10_000

const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /'?text\/html'? is not a valid JavaScript MIME type/i,
]

function isChunkLoadError(message: string): boolean {
  if (!message) return false
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message))
}

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(COOLDOWN_KEY) ?? '0')
    if (Date.now() - last < COOLDOWN_MS) return
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()))
  } catch {
    // sessionStorage may be unavailable (private mode); reload anyway, but
    // without a cooldown we still bound risk by only handling chunk errors.
  }
  window.location.reload()
}

let installed = false

export function installChunkReloadGuard(): void {
  if (installed) return
  if (typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    const message =
      (event.error && (event.error.message as string)) || event.message || ''
    if (isChunkLoadError(message)) reloadOnce()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message =
      typeof reason === 'string'
        ? reason
        : (reason && (reason.message as string)) || ''
    if (isChunkLoadError(message)) reloadOnce()
  })
}
