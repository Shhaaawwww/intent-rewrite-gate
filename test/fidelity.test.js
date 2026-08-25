import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FidelityError,
  collectProtectedLiterals,
  extractAtReferences,
  validateCompiledIntent,
} from '../src/fidelity.js'

test('collects exact references, code, commands, URLs, paths, and identifiers', () => {
  const draft = [
    '运行 `pnpm test`，访问 https://example.test/spec。',
    '修改 src/auth.ts 的 rewrite_user_prompt，然后待确认 rm -rf build。',
    '保留 a@example.com 和字段 "task_type": "rewrite"。',
  ].join('\n')
  const references = [{ kind: 'file', ref: '@auth.ts', offset: 0 }]
  const literals = collectProtectedLiterals(draft, references)

  for (const expected of [
    '@auth.ts',
    '`pnpm test`',
    'https://example.test/spec',
    'src/auth.ts',
    'rewrite_user_prompt',
    'rm -rf build',
    'a@example.com',
    'task_type',
  ]) {
    assert.ok(literals.includes(expected), `missing protected literal: ${expected}`)
  }
})

test('recognizes selected references beside Chinese text and punctuation', () => {
  const references = [{ kind: 'file', ref: '@auth.ts', offset: 2 }]
  assert.deepEqual(extractAtReferences('修复@auth.ts里的逻辑，别改调用方', references), ['@auth.ts'])
  assert.deepEqual(extractAtReferences('修复 @auth.ts，别改调用方', references), ['@auth.ts'])
})

test('accepts faithful reordering and rejects omissions or new references', () => {
  const draft = '先别执行 rm -rf build。修改 src/auth.ts 的 rewrite_user_prompt。'
  const compiled = '修改 src/auth.ts 的 rewrite_user_prompt；保留 rm -rf build，但先别执行。'
  assert.doesNotThrow(() => validateCompiledIntent({ draft, compiled }))

  assert.throws(
    () => validateCompiledIntent({ draft, compiled: '修改认证逻辑，但先别执行。' }),
    (error) => error instanceof FidelityError && /omitted/u.test(error.message),
  )
  assert.throws(
    () => validateCompiledIntent({
      draft: '修复登录问题。',
      compiled: '修复 @other.ts 中的登录问题。',
    }),
    (error) => error instanceof FidelityError && /new reference/u.test(error.message),
  )
})

test('rejects verbatim file-content leakage while allowing a needed identifier', () => {
  const referencedFiles = [{
    path: 'auth.ts',
    content: 'export function authenticate(input) { return input.trim() }\n',
  }]
  assert.doesNotThrow(() => validateCompiledIntent({
    draft: '修复认证函数的空输入问题。',
    compiled: '修复 authenticate 的空输入问题。',
    referencedFiles,
  }))
  assert.throws(
    () => validateCompiledIntent({
      draft: '修复认证函数的空输入问题。',
      compiled: 'export function authenticate(input) { return input.trim() }',
      referencedFiles,
    }),
    (error) => error instanceof FidelityError && /file content/u.test(error.message),
  )
})
