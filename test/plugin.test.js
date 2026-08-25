import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { apply } from '../src/index.js'
import { encodeCompilePayload } from '../src/protocol.js'

function selectedFile(draft, ref) {
  return { kind: 'file', ref, offset: draft.indexOf(ref) }
}

test('host performs one tool-free low-reasoning call with explicit file context', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'vic-plugin-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'auth.ts'), 'export function authenticate() {}\n')

  let command
  let request
  const ctx = {
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }),
    },
    commands: {
      register: (definition) => {
        command = definition
        return () => {}
      },
    },
    llm: {
      async *stream(options) {
        request = options
        yield {
          type: 'block-end',
          block: { type: 'text', text: '修复 @auth.ts 中的认证逻辑。' },
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
  }
  apply(ctx)

  const draft = '修复 @auth.ts 里面的认证逻辑'
  const controller = new AbortController()
  const result = await command.handler({
    rawInput: ` ${encodeCompilePayload(draft, [selectedFile(draft, '@auth.ts')])}`,
    agent: { session: { header: { cwd } } },
    signal: controller.signal,
  })

  assert.equal(result.kind, 'success')
  assert.equal(request.reasoningEffort, 'low')
  assert.equal(request.tools, undefined)
  assert.equal(request.messages.length, 1)
  const envelope = JSON.parse(request.messages[0].content[0].text)
  assert.equal(envelope.draft, draft)
  assert.deepEqual(envelope.requiredExactReferences, ['@auth.ts'])
  assert.deepEqual(envelope.explicitlyReferencedFiles, [{
    path: 'auth.ts',
    content: 'export function authenticate() {}\n',
  }])
})

test('host rejects rewrites that omit protected text or introduce references', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'vic-plugin-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'auth.ts'), 'export function authenticate() {}\n')

  let command
  let output = '修复认证逻辑。'
  const ctx = {
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }),
    },
    commands: {
      register(definition) {
        command = definition
        return () => {}
      },
    },
    llm: {
      async *stream() {
        yield { type: 'block-end', block: { type: 'text', text: output } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
  }
  apply(ctx)

  const fileDraft = '修复@auth.ts里的认证逻辑'
  const missingFile = await command.handler({
    rawInput: encodeCompilePayload(fileDraft, [selectedFile(fileDraft, '@auth.ts')]),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(missingFile.kind, 'error')
  assert.match(missingFile.text, /protected text/u)

  output = '修复 @other.ts 里的登录问题。'
  const newReference = await command.handler({
    rawInput: encodeCompilePayload('修复登录问题。', []),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(newReference.kind, 'error')
  assert.match(newReference.text, /protected text/u)
})

test('host blocks sensitive files before calling the model', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'vic-plugin-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, '.env'), 'SYNTHETIC_VALUE=example\n')

  let command
  let callCount = 0
  const ctx = {
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }),
    },
    commands: {
      register(definition) {
        command = definition
        return () => {}
      },
    },
    llm: {
      async *stream() {
        callCount += 1
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
  }
  apply(ctx)

  const draft = '检查@.env里的配置'
  const result = await command.handler({
    rawInput: encodeCompilePayload(draft, [selectedFile(draft, '@.env')]),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /sensitive file/u)
  assert.equal(callCount, 0)

  const sensitiveDraft = `API_KEY=${'c'.repeat(24)}`
  const draftResult = await command.handler({
    rawInput: encodeCompilePayload(sensitiveDraft, []),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(draftResult.kind, 'error')
  assert.match(draftResult.text, /draft appears to contain credentials/u)
  assert.equal(callCount, 0)
})

test('host rejects excessive expansion and verbatim file-content leakage', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'vic-plugin-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'auth.ts'), 'authenticate-input-contract-v1\n')

  let command
  let output = 'x'.repeat(100)
  const ctx = {
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }),
    },
    commands: {
      register(definition) {
        command = definition
        return () => {}
      },
    },
    llm: {
      async *stream() {
        yield { type: 'block-end', block: { type: 'text', text: output } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
  }
  apply(ctx)

  const expanded = await command.handler({
    rawInput: encodeCompilePayload('修复登录', []),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(expanded.kind, 'error')
  assert.match(expanded.text, /draft left unchanged/u)

  const draft = '检查@auth.ts里的认证逻辑'
  output = '检查 @auth.ts：authenticate-input-contract-v1'
  const leaked = await command.handler({
    rawInput: encodeCompilePayload(draft, [selectedFile(draft, '@auth.ts')]),
    agent: { session: { header: { cwd } } },
    signal: new AbortController().signal,
  })
  assert.equal(leaked.kind, 'error')
  assert.match(leaked.text, /protected text/u)
})
