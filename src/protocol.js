/** Private browser-to-host payload for the Clarify command. */

export const COMMAND_PAYLOAD_PREFIX = '__VIC_COMPILE_V1__'
const MAX_REFERENCE_SELECTIONS = 32
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/u

export function encodeCompilePayload(draft, references) {
  return `${COMMAND_PAYLOAD_PREFIX}${JSON.stringify({ draft, references })}`
}

function validReference(reference) {
  return reference !== null && typeof reference === 'object' && !Array.isArray(reference)
    && (reference.kind === 'file' || reference.kind === 'session')
    && typeof reference.ref === 'string' && reference.ref.startsWith('@')
    && reference.ref.length > 1 && reference.ref.length <= 2_000
    && !CONTROL_RE.test(reference.ref)
    && Number.isSafeInteger(reference.offset) && reference.offset >= 0
}

function validateReferenceRanges(draft, references) {
  let previousEnd = 0
  for (const reference of [...references].sort((left, right) => left.offset - right.offset)) {
    const end = reference.offset + reference.ref.length
    if (reference.offset < previousEnd || end > draft.length
      || draft.slice(reference.offset, end) !== reference.ref) {
      throw new TypeError('reference selection does not match the projected draft')
    }
    previousEnd = end
  }
}

export function decodeCompilePayload(rawInput) {
  const input = String(rawInput ?? '').replace(/^[\t\n\r ]/, '')
  if (!input.startsWith(COMMAND_PAYLOAD_PREFIX)) {
    return { draft: input, references: [] }
  }

  let payload
  try {
    payload = JSON.parse(input.slice(COMMAND_PAYLOAD_PREFIX.length))
  } catch {
    throw new TypeError('invalid intent compiler payload')
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || typeof payload.draft !== 'string' || !Array.isArray(payload.references)
    || payload.references.length > MAX_REFERENCE_SELECTIONS
    || payload.references.some((reference) => !validReference(reference))) {
    throw new TypeError('invalid intent compiler payload')
  }
  validateReferenceRanges(payload.draft, payload.references)

  return {
    draft: payload.draft,
    references: payload.references.map((reference) => ({
      kind: reference.kind,
      ref: reference.ref,
      offset: reference.offset,
    })),
  }
}
