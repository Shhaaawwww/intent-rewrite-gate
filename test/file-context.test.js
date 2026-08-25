import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import {
  FileContextError,
  MAX_REFERENCED_FILE_BYTES,
  loadExplicitFileContext,
  pathFromFileReference,
} from '../src/file-context.js'

async function temporaryWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'vic-workspace-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function selections(draft, references) {
  return references.map((ref) => ({ kind: 'file', ref, offset: draft.indexOf(ref) }))
}

test('decodes plain and quoted file references', () => {
  assert.equal(pathFromFileReference('@src/auth.ts'), 'src/auth.ts')
  assert.equal(pathFromFileReference('@"folder/a b.ts"'), 'folder/a b.ts')
})

test('loads chips adjacent to Chinese text or punctuation and deduplicates aliases', async (t) => {
  const root = await temporaryWorkspace(t)
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src', 'auth.ts'), 'export function authenticate() {}\n')
  await symlink(join(root, 'src', 'auth.ts'), join(root, 'auth-link.ts'))

  const draft = '修复@src/auth.ts里的逻辑，也检查@auth-link.ts，别改调用方'
  const files = await loadExplicitFileContext({
    cwd: root,
    draft,
    fileSelections: selections(draft, ['@src/auth.ts', '@auth-link.ts']),
  })

  assert.deepEqual(files, [{
    reference: '@src/auth.ts',
    path: 'src/auth.ts',
    content: 'export function authenticate() {}\n',
  }])
})

test('rejects traversal and symlink escape from the workspace', async (t) => {
  const root = await temporaryWorkspace(t)
  const outside = await temporaryWorkspace(t)
  await writeFile(join(outside, 'outside.txt'), 'outside')
  await symlink(join(outside, 'outside.txt'), join(root, 'linked.txt'))
  const traversal = `@../${basename(outside)}/outside.txt`

  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: `Read ${traversal}`,
      fileSelections: selections(`Read ${traversal}`, [traversal]),
    }),
    (error) => error instanceof FileContextError && /leaves the workspace/u.test(error.message),
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @linked.txt',
      fileSelections: selections('Read @linked.txt', ['@linked.txt']),
    }),
    (error) => error instanceof FileContextError && /leaves the workspace/u.test(error.message),
  )
})

test('rejects binary, oversized, over-budget, excessive, and unlisted references', async (t) => {
  const root = await temporaryWorkspace(t)
  await writeFile(join(root, 'binary.dat'), Buffer.from([0x61, 0x00, 0x62]))
  await writeFile(join(root, 'invalid-utf8.dat'), Buffer.from([0xc3, 0x28]))
  await mkdir(join(root, 'folder'))
  await writeFile(join(root, 'large.txt'), 'x'.repeat(MAX_REFERENCED_FILE_BYTES + 1))
  await writeFile(join(root, 'part-a.txt'), 'a'.repeat(17 * 1024))
  await writeFile(join(root, 'part-b.txt'), 'b'.repeat(17 * 1024))
  await writeFile(join(root, 'part-c.txt'), 'c'.repeat(17 * 1024))

  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @binary.dat',
      fileSelections: selections('Read @binary.dat', ['@binary.dat']),
    }),
    /not UTF-8 text/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @invalid-utf8.dat',
      fileSelections: selections('Read @invalid-utf8.dat', ['@invalid-utf8.dat']),
    }),
    /not UTF-8 text/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @folder',
      fileSelections: selections('Read @folder', ['@folder']),
    }),
    /not a regular file/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @/etc/passwd',
      fileSelections: selections('Read @/etc/passwd', ['@/etc/passwd']),
    }),
    /workspace-relative/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @https://example.test/a',
      fileSelections: selections('Read @https://example.test/a', ['@https://example.test/a']),
    }),
    /invalid file reference/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @large.txt',
      fileSelections: selections('Read @large.txt', ['@large.txt']),
    }),
    /exceeds 24 KiB/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @part-a.txt @part-b.txt @part-c.txt',
      fileSelections: selections(
        'Read @part-a.txt @part-b.txt @part-c.txt',
        ['@part-a.txt', '@part-b.txt', '@part-c.txt'],
      ),
    }),
    /48 KiB total limit/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @a @b @c @d',
      fileSelections: selections('Read @a @b @c @d', ['@a', '@b', '@c', '@d']),
    }),
    /at most 3/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'No reference here',
      fileSelections: [{ kind: 'file', ref: '@outside.txt', offset: 0 }],
    }),
    /valid selected file chip/u,
  )
})

test('blocks sensitive paths, symlink aliases, and credential-like contents', async (t) => {
  const root = await temporaryWorkspace(t)
  await writeFile(join(root, '.env'), 'SAFE_PLACEHOLDER=example\n')
  await symlink(join(root, '.env'), join(root, 'alias.txt'))
  await writeFile(join(root, 'config.txt'), `SERVICE_API_KEY=${'a'.repeat(24)}\n`)
  await writeFile(join(root, 'config.js'), `const API_KEY = "${'b'.repeat(24)}"\n`)
  await writeFile(join(root, 'template.txt'), 'SERVICE_API_KEY=your_api_key_here\n')
  await writeFile(join(root, 'template.js'), 'const API_KEY = process.env.API_KEY\n')
  await writeFile(join(root, 'private.pem'), 'synthetic placeholder\n')
  await writeFile(join(root, 'service-account-prod.json'), '{}\n')

  for (const reference of [
    '@.env',
    '@alias.txt',
    '@private.pem',
    '@service-account-prod.json',
  ]) {
    const draft = `Read ${reference}`
    await assert.rejects(
      loadExplicitFileContext({
        cwd: root,
        draft,
        fileSelections: selections(draft, [reference]),
      }),
      /sensitive file/u,
    )
  }

  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @config.txt',
      fileSelections: selections('Read @config.txt', ['@config.txt']),
    }),
    /appears to contain credentials/u,
  )
  await assert.rejects(
    loadExplicitFileContext({
      cwd: root,
      draft: 'Read @config.js',
      fileSelections: selections('Read @config.js', ['@config.js']),
    }),
    /appears to contain credentials/u,
  )

  const allowedTemplate = await loadExplicitFileContext({
    cwd: root,
    draft: 'Read @template.txt',
    fileSelections: selections('Read @template.txt', ['@template.txt']),
  })
  assert.equal(allowedTemplate[0].content, 'SERVICE_API_KEY=your_api_key_here\n')
  const allowedCode = await loadExplicitFileContext({
    cwd: root,
    draft: 'Read @template.js',
    fileSelections: selections('Read @template.js', ['@template.js']),
  })
  assert.equal(allowedCode[0].content, 'const API_KEY = process.env.API_KEY\n')
})
