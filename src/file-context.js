/** Deterministic, workspace-bounded loading for user-selected @file references. */

import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const MAX_REFERENCED_FILES = 3
export const MAX_REFERENCED_FILE_BYTES = 24 * 1024
export const MAX_TOTAL_REFERENCED_BYTES = 48 * 1024

const CONTROL_OR_QUOTE_RE = /[\u0000-\u001f\u007f-\u009f"]/u
const URI_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u
const SENSITIVE_PATH_RULES = [
  /(?:^|\/)\.env(?:[./]|$)/u,
  /(?:^|\/)(?:\.npmrc|\.pypirc|\.netrc)$/u,
  /(?:^|\/)\.(?:ssh|aws|gnupg)(?:\/|$)/u,
  /(?:^|\/)\.git(?:\/|$)/u,
  /(?:^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|service[-_]?account[^/]*|application_default_credentials\.json|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/u,
]
const CREDENTIAL_CONTENT_RULES = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\bAIza[0-9A-Za-z_-]{30,}\b/u,
]
const SECRET_ASSIGNMENT_RE = /(?:^|[\r\n])\s*(?:export\s+)?(?:(?:const|let|var)\s+)?["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*[:=]\s*["']?([^\s"'#,;]{8,})/gu
const SECRET_NAME_RE = /(?:api[_-]?key|token|secret|password|passwd|private[_-]?key|client[_-]?secret|access[_-]?key)/iu
const PLACEHOLDER_VALUE_RE = /^(?:your[_-]|example|sample|placeholder|change(?:me|_me)|replace|dummy|test|demo|none|null|undefined|process\.env\.|os\.environ|env\[|\$\{|<|\*+$|x+$)/iu

export class FileContextError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FileContextError'
  }
}

function checkAborted(signal) {
  signal?.throwIfAborted?.()
}

function inside(root, target) {
  const fromRoot = relative(root, target)
  return fromRoot === '' || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromRoot))
}

export function pathFromFileReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith('@')) {
    throw new FileContextError('invalid file reference')
  }

  let path
  if (reference.startsWith('@"')) {
    if (!reference.endsWith('"') || reference.length < 4) {
      throw new FileContextError(`invalid file reference: ${reference}`)
    }
    path = reference.slice(2, -1)
  } else {
    path = reference.slice(1)
    if (/\s/u.test(path)) throw new FileContextError(`invalid file reference: ${reference}`)
  }

  if (path.length === 0 || CONTROL_OR_QUOTE_RE.test(path) || URI_SCHEME_RE.test(path)) {
    throw new FileContextError(`invalid file reference: ${reference}`)
  }
  return path
}

function normalizedSensitivePath(path) {
  return path.replaceAll('\\', '/').toLowerCase()
}

function assertNonSensitivePath(path, reference) {
  const normalized = normalizedSensitivePath(path)
  if (SENSITIVE_PATH_RULES.some((rule) => rule.test(normalized))) {
    throw new FileContextError(`sensitive file is not allowed: ${reference}`)
  }
}

function appearsToContainCredential(text) {
  if (CREDENTIAL_CONTENT_RULES.some((rule) => rule.test(text))) return true
  for (const match of text.matchAll(SECRET_ASSIGNMENT_RE)) {
    if (SECRET_NAME_RE.test(match[1]) && !PLACEHOLDER_VALUE_RE.test(match[2])) return true
  }
  return false
}

function assertNonSensitiveContent(text, reference) {
  if (appearsToContainCredential(text)) {
    throw new FileContextError(`referenced file appears to contain credentials: ${reference}`)
  }
}

export function assertNonSensitiveDraft(draft) {
  if (appearsToContainCredential(String(draft ?? ''))) {
    throw new FileContextError('draft appears to contain credentials')
  }
}

function validateSelectedFiles(draft, fileSelections) {
  if (!Array.isArray(fileSelections)) throw new FileContextError('invalid file selection')
  for (const selection of fileSelections) {
    if (selection === null || typeof selection !== 'object' || Array.isArray(selection)
      || selection.kind !== 'file' || typeof selection.ref !== 'string'
      || !Number.isSafeInteger(selection.offset) || selection.offset < 0
      || draft.slice(selection.offset, selection.offset + selection.ref.length) !== selection.ref) {
      throw new FileContextError('file context must come from a valid selected file chip')
    }
  }
}

async function workspaceRoot(cwd, signal) {
  checkAborted(signal)
  try {
    const root = await realpath(resolve(cwd ?? process.cwd()))
    checkAborted(signal)
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    return root
  } catch (error) {
    checkAborted(signal)
    throw new FileContextError('current workspace is unavailable')
  }
}

async function resolveReferencedFile(root, reference, signal) {
  const path = pathFromFileReference(reference)
  if (isAbsolute(path)) {
    throw new FileContextError(`file reference must be workspace-relative: ${reference}`)
  }
  assertNonSensitivePath(path, reference)

  const lexicalPath = resolve(root, path)
  if (!inside(root, lexicalPath)) {
    throw new FileContextError(`file reference leaves the workspace: ${reference}`)
  }

  checkAborted(signal)
  let canonicalPath
  try {
    canonicalPath = await realpath(lexicalPath)
  } catch {
    checkAborted(signal)
    throw new FileContextError(`referenced file was not found: ${reference}`)
  }
  checkAborted(signal)

  if (!inside(root, canonicalPath)) {
    throw new FileContextError(`file reference leaves the workspace: ${reference}`)
  }
  assertNonSensitivePath(relative(root, canonicalPath), reference)

  let fileStat
  try {
    fileStat = await stat(canonicalPath)
  } catch {
    checkAborted(signal)
    throw new FileContextError(`referenced file was not found: ${reference}`)
  }
  if (!fileStat.isFile()) {
    throw new FileContextError(`reference is not a regular file: ${reference}`)
  }
  if (fileStat.size > MAX_REFERENCED_FILE_BYTES) {
    throw new FileContextError(`referenced file exceeds 24 KiB: ${reference}`)
  }

  return { path, canonicalPath, size: fileStat.size }
}

function decodeText(buffer, reference) {
  if (buffer.includes(0)) {
    throw new FileContextError(`referenced file is not UTF-8 text: ${reference}`)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new FileContextError(`referenced file is not UTF-8 text: ${reference}`)
  }
}

export async function loadExplicitFileContext({ cwd, draft, fileSelections, signal }) {
  if (!Array.isArray(fileSelections) || fileSelections.length === 0) return []

  validateSelectedFiles(draft, fileSelections)
  const uniqueReferences = [...new Set(fileSelections.map((selection) => selection.ref))]
  if (uniqueReferences.length > MAX_REFERENCED_FILES) {
    throw new FileContextError(`at most ${MAX_REFERENCED_FILES} referenced files can be used`)
  }

  const root = await workspaceRoot(cwd, signal)
  const loaded = []
  const canonicalPaths = new Set()
  let totalBytes = 0

  for (const reference of uniqueReferences) {
    checkAborted(signal)
    const resolvedFile = await resolveReferencedFile(root, reference, signal)
    if (canonicalPaths.has(resolvedFile.canonicalPath)) continue
    if (totalBytes + resolvedFile.size > MAX_TOTAL_REFERENCED_BYTES) {
      throw new FileContextError('referenced files exceed the 48 KiB total limit')
    }

    let buffer
    try {
      buffer = await readFile(resolvedFile.canonicalPath, { signal })
    } catch {
      checkAborted(signal)
      throw new FileContextError(`unable to read referenced file: ${reference}`)
    }
    checkAborted(signal)
    if (buffer.length > MAX_REFERENCED_FILE_BYTES) {
      throw new FileContextError(`referenced file exceeds 24 KiB: ${reference}`)
    }
    if (totalBytes + buffer.length > MAX_TOTAL_REFERENCED_BYTES) {
      throw new FileContextError('referenced files exceed the 48 KiB total limit')
    }

    canonicalPaths.add(resolvedFile.canonicalPath)
    totalBytes += buffer.length
    const content = decodeText(buffer, reference)
    assertNonSensitiveContent(content, reference)
    loaded.push({
      reference,
      path: resolvedFile.path,
      content,
    })
  }

  return loaded
}
