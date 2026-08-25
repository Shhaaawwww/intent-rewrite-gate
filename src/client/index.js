/** DeepSeek Harness browser half for Vibe Intent Compiler. */

import { createElement, useEffect, useRef, useState } from 'react'
import { projectDraftForCompilation } from './draft-context.js'
import { encodeCompilePayload } from '../protocol.js'

export const name = 'vibe-intent-compiler'
export const inject = ['slots', 'remote', 'remote.commands', 'locale']

const ID = 'dsh-vibe-intent-compiler'
const COMMAND_NAME = 'compile-intent'
const MAX_DRAFT_LENGTH = 20_000
const MAX_REFERENCED_FILES = 3

const CSS = `
.vic-button { display: inline-flex; align-items: center; gap: 5px; height: 24px;
  border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit;
  border-radius: 999px; padding: 0 9px; font: inherit; font-size: 12px; line-height: 1;
  cursor: pointer; opacity: .8; white-space: nowrap; }
.vic-button:hover:not(:disabled) { opacity: 1; background: rgba(127,127,127,.12); }
.vic-button:disabled { cursor: default; opacity: .4; }
.vic-ref-count { opacity: .72; }
.vic-spinner { width: 11px; height: 11px; border: 1.5px solid currentColor;
  border-right-color: transparent; border-radius: 50%; animation: vic-spin .8s linear infinite; }
@keyframes vic-spin { to { transform: rotate(360deg); } }
`

const ZH = {
  'button.idle': 'Clarify',
  'button.busy': 'Clarifying…',
  'button.error': 'Retry',
  'button.stale': '未覆盖新内容',
  'button.long': '草稿过长',
  'button.refsLimit': '最多 3 文件',
  'button.refs': '{count} 文件',
  'title.idle': '把当前草稿整理成简洁、忠实、可执行的指令；不会自动发送',
  'title.busy': '正在整理当前草稿…',
  'title.error': '整理失败，原草稿未更改；点击重试',
  'title.stale': '检测到你继续编辑，因此没有覆盖新内容',
  'title.long': '草稿超过 20,000 个字符，插件不会截断处理',
  'title.refsLimit': '一次最多使用 3 个明确选择的文件',
  'title.refs': '只读取明确选择的 {count} 个文件，不读取项目中的其他文件',
}

const EN = {
  'button.idle': 'Clarify',
  'button.busy': 'Clarifying…',
  'button.error': 'Retry',
  'button.stale': 'New edits kept',
  'button.long': 'Draft too long',
  'button.refsLimit': '3 files max',
  'button.refs': '{count} files',
  'title.idle': 'Compile the draft into a concise, faithful, executable intent; never auto-send',
  'title.busy': 'Compiling intent…',
  'title.error': 'Compilation failed and the draft was left unchanged; click to retry',
  'title.stale': 'You edited the draft while compiling, so the newer text was kept',
  'title.long': 'Drafts over 20,000 characters are never silently truncated',
  'title.refsLimit': 'At most 3 explicitly selected files can be used at once',
  'title.refs': 'Uses only the {count} explicitly selected files; no other project files are read',
}

function withCount(template, count) {
  return template.replace('{count}', String(count))
}

function installStyle() {
  if (typeof document === 'undefined') return
  const selector = `style[data-plugin-css="${ID}"]`
  if (document.querySelector(selector) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = ID
  tag.dataset.pluginCss = ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

export function apply(ctx) {
  installStyle()

  ctx.effect(() => ctx.locale.register(ID, { zh: ZH, en: EN }), 'vibe-intent-compiler: locale')
  const t = ctx.locale.bind(ID)

  function VibeIntentCompilerButton(props) {
    const input = props.useInput((state) => state)
    const inputActions = props.inputActions
    const sessionId = props.sessionId ? String(props.sessionId) : ''
    const [status, setStatus] = useState('idle')
    const [errorText, setErrorText] = useState('')
    const [, refreshLocale] = useState(0)
    const inputRef = useRef(input)
    const requestRef = useRef(null)
    const mountedRef = useRef(true)
    inputRef.current = input

    useEffect(() => ctx.locale.subscribe(() => refreshLocale((value) => value + 1)), [])
    useEffect(() => () => {
      mountedRef.current = false
      requestRef.current?.abort()
    }, [])

    const draft = typeof input?.draft === 'string' ? input.draft : ''
    const projection = projectDraftForCompilation(input)
    const fileReferenceCount = projection.fileReferences.length
    const isBusy = status === 'busy'
    const isLong = projection.draft.length > MAX_DRAFT_LENGTH
    const hasTooManyFiles = fileReferenceCount > MAX_REFERENCED_FILES
    const disabled = isBusy || draft.trim().length === 0 || sessionId === '' || isLong
      || hasTooManyFiles
    const labelKey = hasTooManyFiles
      ? 'button.refsLimit'
      : isLong ? 'button.long' : `button.${status}`
    const titleKey = hasTooManyFiles
      ? 'title.refsLimit'
      : isLong ? 'title.long' : `title.${status}`
    const referenceTitle = fileReferenceCount === 0 || hasTooManyFiles
      ? ''
      : withCount(t('title.refs'), fileReferenceCount)
    const showError = !hasTooManyFiles && !isLong && status === 'error' && errorText !== ''
    const title = [showError ? errorText : t(titleKey), referenceTitle]
      .filter(Boolean)
      .join(' · ')

    const compileDraft = async () => {
      if (disabled) return
      const source = draft
      const sourceProjection = projection
      const revision = input?.draftRev
      const controller = new AbortController()
      requestRef.current = controller
      setErrorText('')
      setStatus('busy')

      try {
        const response = await ctx.remote.commands.execute(
          sessionId,
          `/${COMMAND_NAME} ${encodeCompilePayload(
            sourceProjection.draft,
            sourceProjection.references,
          )}`,
          [],
          controller.signal,
        )
        const result = response?.ok ? response.value?.result : undefined
        if (result?.kind !== 'success' || typeof result.text !== 'string'
          || result.text.trim().length === 0) {
          throw new Error(result?.kind === 'error' && typeof result.text === 'string'
            ? result.text
            : 'intent compilation command failed')
        }

        const current = inputRef.current
        if (current?.draftRev !== revision || current?.draft !== source) {
          if (mountedRef.current) setStatus('stale')
          return
        }

        inputActions.setDraft(result.text)
        setErrorText('')
        if (mountedRef.current) setStatus('idle')
      } catch (error) {
        if (!controller.signal.aborted && mountedRef.current) {
          console.error('vibe-intent-compiler: compilation failed; draft left unchanged')
          setErrorText(error instanceof Error ? error.message : 'intent compilation failed')
          setStatus('error')
        }
      } finally {
        if (requestRef.current === controller) requestRef.current = null
      }
    }

    return createElement('button', {
      type: 'button',
      className: 'vic-button',
      disabled,
      onClick: compileDraft,
      title,
      'aria-label': title,
      'aria-live': 'polite',
    },
    isBusy
      ? createElement('span', { className: 'vic-spinner', 'aria-hidden': 'true' })
      : createElement('span', { 'aria-hidden': 'true' }, '✦'),
    createElement('span', null, t(labelKey)),
    fileReferenceCount > 0 && !hasTooManyFiles
      ? createElement('span', { className: 'vic-ref-count' }, `· ${withCount(
        t('button.refs'),
        fileReferenceCount,
      )}`)
      : null)
  }

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    {
      name: 'conversation.input.right',
      id: 'vibe-intent-compiler',
      order: 100,
      label: 'Clarify',
    },
    (props) => createElement(VibeIntentCompilerButton, props),
  ))
}
