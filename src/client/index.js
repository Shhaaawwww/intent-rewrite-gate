/** DeepSeek Harness browser half for Intent Rewrite Gate. */

import { createElement, useEffect, useRef, useState } from 'react'

export const name = 'intent-rewrite-gate'
export const inject = ['slots', 'remote', 'remote.commands', 'locale']

const ID = 'dsh-intent-rewrite-gate'
const COMMAND_NAME = 'rewrite-intent'
const MAX_DRAFT_LENGTH = 20_000

const CSS = `
.irg-button { display: inline-flex; align-items: center; gap: 5px; height: 24px;
  border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit;
  border-radius: 999px; padding: 0 9px; font: inherit; font-size: 12px; line-height: 1;
  cursor: pointer; opacity: .8; white-space: nowrap; }
.irg-button:hover:not(:disabled) { opacity: 1; background: rgba(127,127,127,.12); }
.irg-button:disabled { cursor: default; opacity: .4; }
.irg-spinner { width: 11px; height: 11px; border: 1.5px solid currentColor;
  border-right-color: transparent; border-radius: 50%; animation: irg-spin .8s linear infinite; }
@keyframes irg-spin { to { transform: rotate(360deg); } }
`

const ZH = {
  'button.idle': '整理意图',
  'button.busy': '整理中…',
  'button.error': '重试整理',
  'button.stale': '未覆盖新内容',
  'button.long': '草稿过长',
  'title.idle': '整理为简洁、忠实、可执行的意图；不会自动发送',
  'title.busy': '正在整理意图…',
  'title.error': '整理失败，原草稿未更改；点击重试',
  'title.stale': '检测到你继续编辑，因此没有覆盖新内容',
  'title.long': '草稿超过 20,000 个字符，插件不会截断处理',
}

const EN = {
  'button.idle': 'Clarify intent',
  'button.busy': 'Clarifying…',
  'button.error': 'Retry',
  'button.stale': 'New edits kept',
  'button.long': 'Draft too long',
  'title.idle': 'Turn the draft into a concise, faithful, executable intent; never auto-send',
  'title.busy': 'Clarifying intent…',
  'title.error': 'Rewrite failed and the draft was left unchanged; click to retry',
  'title.stale': 'You edited the draft while rewriting, so the newer text was kept',
  'title.long': 'Drafts over 20,000 characters are never silently truncated',
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

  ctx.effect(() => ctx.locale.register(ID, { zh: ZH, en: EN }), 'intent-rewrite-gate: locale')
  const t = ctx.locale.bind(ID)

  function IntentRewriteButton(props) {
    const input = props.useInput((state) => state)
    const inputActions = props.inputActions
    const sessionId = props.sessionId ? String(props.sessionId) : ''
    const [status, setStatus] = useState('idle')
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

    const draft = typeof input.draft === 'string' ? input.draft : ''
    const isBusy = status === 'busy'
    const isLong = draft.length > MAX_DRAFT_LENGTH
    const disabled = isBusy || draft.trim().length === 0 || sessionId === '' || isLong
    const labelKey = isLong ? 'button.long' : `button.${status}`
    const titleKey = isLong ? 'title.long' : `title.${status}`

    const rewrite = async () => {
      if (disabled) return
      const source = draft
      const revision = input.draftRev
      const controller = new AbortController()
      requestRef.current = controller
      setStatus('busy')

      try {
        const response = await ctx.remote.commands.execute(
          sessionId,
          `/${COMMAND_NAME} ${source}`,
          [],
          controller.signal,
        )
        const result = response?.ok ? response.value?.result : undefined
        if (result?.kind !== 'success' || typeof result.text !== 'string'
          || result.text.trim().length === 0) {
          throw new Error('rewrite command failed')
        }

        const current = inputRef.current
        if (current?.draftRev !== revision || current?.draft !== source) {
          if (mountedRef.current) setStatus('stale')
          return
        }

        inputActions.setDraft(result.text)
        if (mountedRef.current) setStatus('idle')
      } catch (error) {
        if (!controller.signal.aborted && mountedRef.current) {
          console.error('intent-rewrite-gate: rewrite failed; draft left unchanged')
          setStatus('error')
        }
      } finally {
        if (requestRef.current === controller) requestRef.current = null
      }
    }

    return createElement('button', {
      type: 'button',
      className: 'irg-button',
      disabled,
      onClick: rewrite,
      title: t(titleKey),
      'aria-label': t(titleKey),
      'aria-live': 'polite',
    },
    isBusy
      ? createElement('span', { className: 'irg-spinner', 'aria-hidden': 'true' })
      : createElement('span', { 'aria-hidden': 'true' }, '✦'),
    createElement('span', null, t(labelKey)))
  }

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    {
      name: 'conversation.input.right',
      id: 'intent-rewrite-gate',
      order: 100,
      label: 'Clarify intent',
    },
    (props) => createElement(IntentRewriteButton, props),
  ))
}
