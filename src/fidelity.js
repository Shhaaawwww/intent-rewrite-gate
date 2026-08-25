/** Deterministic fail-closed checks for model rewrites. */

const CODE_FENCE_RE = /(`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*?\r?\n\1[\t ]*/gu
const INLINE_CODE_RE = /(`{1,2})(?!`)([^\r\n]*?)\1/gu
const URL_RE = /\bhttps?:\/\/[^\s<>"'`，。；：！？、,;]+/giu
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gu
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu
const WINDOWS_PATH_RE = /\b[A-Za-z]:\\(?:[^\\\s:*?"<>|\r\n]+\\)*[^\\\s:*?"<>|\r\n]*/gu
const POSIX_PATH_RE = /(?:^|[\s("'（])((?:\.{1,2}\/|\/)[A-Za-z0-9_@%+.,~=\/-]+|[A-Za-z0-9_@%+~-]+(?:\/[A-Za-z0-9_@%+.,~=-]+)+)/gmu
const FILE_NAME_RE = /\b[A-Za-z0-9_@-]+(?:\.[A-Za-z0-9_@-]+)+\b/gu
const SNAKE_IDENTIFIER_RE = /\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/gu
const CAMEL_IDENTIFIER_RE = /\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/gu
const CONSTANT_IDENTIFIER_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/gu
const SCHEMA_KEY_RE = /["']([A-Za-z_][A-Za-z0-9_.-]*)["'](?=\s*:)/gu
const COMMAND_LINE_RE = /^(?:[$>]\s*)?(?:sudo\s+)?(?:rm|cp|mv|mkdir|rmdir|git|npm|pnpm|yarn|bun|npx|pip|python|python3|node|docker|docker-compose|kubectl|helm|cargo|go|make|cmake|curl|wget|chmod|chown|ssh|scp|rsync)\b/iu
const EMBEDDED_RM_RE = /(?:^|[\s:：])((?:sudo\s+)?rm(?:\s+--?[A-Za-z0-9-]+)*\s+(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,，。；;！？!?]+)(?:\s+(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,，。；;！？!?]+)){0,7})/gmu
const AT_REFERENCE_RE = /(?<![A-Za-z0-9._%+-])@(?:"[^"\r\n]+"|[^\s"'`<>()\[\]{}，。；！？、,;!?]+)/gu
const TRAILING_PUNCTUATION_RE = /[.,;:!?，。；：！？、]+$/u
const FILE_REFERENCE_PREFIX_RE = /^@[^\s"'`<>()\[\]{}，。；：！？、,;!?]+?\.(?:c|cc|cpp|css|csv|go|h|hpp|html|java|js|json|jsx|md|mjs|py|rb|rs|sh|sql|ts|tsx|txt|vue|xml|ya?ml)\b/iu

export class FidelityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FidelityError'
  }
}

function exactReferences(references) {
  if (!Array.isArray(references)) return []
  return [...new Set(references
    .map((reference) => typeof reference === 'string' ? reference : reference?.ref)
    .filter((reference) => typeof reference === 'string' && reference.startsWith('@')))]
}

function trimTerminalPunctuation(value) {
  return value.replace(TRAILING_PUNCTUATION_RE, '')
}

function addMatches(target, text, regex, group = 0, trim = false) {
  for (const match of text.matchAll(regex)) {
    const raw = match[group]
    if (typeof raw !== 'string') continue
    const value = trim ? trimTerminalPunctuation(raw) : raw
    if (value.length >= 3) target.add(value)
  }
}

export function collectProtectedLiterals(draft, references = []) {
  const text = String(draft ?? '')
  const protectedLiterals = new Set(exactReferences(references))

  addMatches(protectedLiterals, text, CODE_FENCE_RE)
  addMatches(protectedLiterals, text, INLINE_CODE_RE)
  addMatches(protectedLiterals, text, URL_RE, 0, true)
  addMatches(protectedLiterals, text, EMAIL_RE)
  addMatches(protectedLiterals, text, UUID_RE)
  addMatches(protectedLiterals, text, WINDOWS_PATH_RE, 0, true)
  addMatches(protectedLiterals, text, POSIX_PATH_RE, 1, true)
  addMatches(protectedLiterals, text, FILE_NAME_RE)
  addMatches(protectedLiterals, text, SNAKE_IDENTIFIER_RE)
  addMatches(protectedLiterals, text, CAMEL_IDENTIFIER_RE)
  addMatches(protectedLiterals, text, CONSTANT_IDENTIFIER_RE)
  addMatches(protectedLiterals, text, SCHEMA_KEY_RE, 1)
  addMatches(protectedLiterals, text, EMBEDDED_RM_RE, 1, true)

  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (trimmed.length >= 3 && COMMAND_LINE_RE.test(trimmed)) protectedLiterals.add(trimmed)
  }

  return [...protectedLiterals].sort((left, right) => right.length - left.length)
}

export function extractAtReferences(text, references = []) {
  const known = exactReferences(references).sort((left, right) => right.length - left.length)
  const found = new Set()
  for (const match of String(text ?? '').matchAll(AT_REFERENCE_RE)) {
    const raw = trimTerminalPunctuation(match[0])
    const selected = known.find((reference) => raw.startsWith(reference))
    const filePrefix = selected === undefined ? raw.match(FILE_REFERENCE_PREFIX_RE)?.[0] : undefined
    found.add(selected ?? filePrefix ?? raw)
  }
  return [...found]
}

function copiedFileFragment(compiled, referencedFiles) {
  for (const file of referencedFiles ?? []) {
    if (typeof file?.content !== 'string') continue
    for (const line of file.content.split(/\r?\n/u)) {
      const fragment = line.trim()
      if (fragment.length >= 24 && /[A-Za-z0-9_\u3400-\u9fff]/u.test(fragment)
        && compiled.includes(fragment)) {
        return true
      }
    }
  }
  return false
}

export function validateCompiledIntent({ draft, compiled, references = [], referencedFiles = [] }) {
  const protectedLiterals = collectProtectedLiterals(draft, references)
  if (protectedLiterals.some((literal) => !compiled.includes(literal))) {
    throw new FidelityError('rewrite omitted protected text')
  }

  const allowedReferences = new Set([
    ...extractAtReferences(draft, references),
    ...exactReferences(references),
  ])
  if (extractAtReferences(compiled, references)
    .some((reference) => !allowedReferences.has(reference))) {
    throw new FidelityError('rewrite introduced a new reference')
  }

  if (copiedFileFragment(compiled, referencedFiles)) {
    throw new FidelityError('rewrite copied file content')
  }

  return { protectedLiterals }
}
