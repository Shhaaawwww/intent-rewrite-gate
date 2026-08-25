/** Pure projection from composer chips to exact model-facing references. */

export function projectDraftForCompilation(input) {
  const draft = typeof input?.draft === 'string' ? input.draft : ''
  const occurrences = Array.isArray(input?.occurrences) ? input.occurrences : []
  const replacements = []

  for (const occurrence of occurrences) {
    const isKnownReference = occurrence?.source === 'reference'
      && (occurrence.appearance === 'file' || occurrence.appearance === 'session')
    const start = occurrence?.offset
    const end = Number.isSafeInteger(start) && Number.isSafeInteger(occurrence?.length)
      ? start + occurrence.length
      : -1
    if (!isKnownReference || occurrence.invalid === true || typeof occurrence.ref !== 'string'
      || !occurrence.ref.startsWith('@') || start < 0 || end < start || end > draft.length) {
      continue
    }

    replacements.push({
      start,
      end,
      text: occurrence.ref,
      kind: occurrence.appearance,
    })
  }

  replacements.sort((left, right) => left.start - right.start)
  let projected = ''
  let cursor = 0
  const references = []
  for (const replacement of replacements) {
    if (replacement.start < cursor) continue
    projected += draft.slice(cursor, replacement.start)
    const offset = projected.length
    projected += replacement.text
    references.push({
      kind: replacement.kind,
      ref: replacement.text,
      offset,
    })
    cursor = replacement.end
  }
  projected += draft.slice(cursor)

  return {
    draft: projected,
    references,
    fileReferences: [...new Set(
      references.filter((reference) => reference.kind === 'file')
        .map((reference) => reference.ref),
    )],
  }
}
