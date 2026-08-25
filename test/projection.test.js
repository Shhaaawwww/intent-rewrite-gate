import assert from 'node:assert/strict'
import test from 'node:test'

import { projectDraftForCompilation } from '../src/client/draft-context.js'
import { decodeCompilePayload, encodeCompilePayload } from '../src/protocol.js'

test('projects adjacent file and session chips with exact projected offsets', () => {
  const draft = '修复@auth里的逻辑，参考@Previous。'
  const fileOffset = draft.indexOf('@auth')
  const sessionOffset = draft.indexOf('@Previous')
  const projection = projectDraftForCompilation({
    draft,
    occurrences: [
      {
        source: 'reference',
        appearance: 'file',
        ref: '@src/auth.ts',
        offset: fileOffset,
        length: '@auth'.length,
      },
      {
        source: 'reference',
        appearance: 'session',
        ref: '@codex://threads/example',
        offset: sessionOffset,
        length: '@Previous'.length,
      },
    ],
  })

  assert.equal(projection.draft, '修复@src/auth.ts里的逻辑，参考@codex://threads/example。')
  assert.deepEqual(projection.references, [
    {
      kind: 'file',
      ref: '@src/auth.ts',
      offset: projection.draft.indexOf('@src/auth.ts'),
    },
    {
      kind: 'session',
      ref: '@codex://threads/example',
      offset: projection.draft.indexOf('@codex://threads/example'),
    },
  ])
  assert.deepEqual(projection.fileReferences, ['@src/auth.ts'])
})

test('private payload round-trips multiline mixed-language drafts', () => {
  const draft = '修一下 @src/auth.ts\nkeep the API stable'
  const references = [{ kind: 'file', ref: '@src/auth.ts', offset: draft.indexOf('@src/auth.ts') }]
  const encoded = encodeCompilePayload(draft, references)
  assert.deepEqual(decodeCompilePayload(` ${encoded}`), {
    draft,
    references,
  })
})

test('private payload rejects forged or overlapping chip ranges', () => {
  const draft = 'Use @auth.ts and @other.ts'
  assert.throws(
    () => decodeCompilePayload(encodeCompilePayload(draft, [
      { kind: 'file', ref: '@auth.ts', offset: 0 },
    ])),
    /does not match/u,
  )
  assert.throws(
    () => decodeCompilePayload(encodeCompilePayload(draft, [
      { kind: 'file', ref: '@auth.ts', offset: draft.indexOf('@auth.ts') },
      { kind: 'file', ref: '@auth.ts', offset: draft.indexOf('@auth.ts') },
    ])),
    /does not match/u,
  )
})
