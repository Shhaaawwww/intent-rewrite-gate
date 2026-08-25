# Intent Rewrite Gate

Turn messy vibe-coding requests into concise prompts without inventing requirements.

> Your words can be messy. Your intent should stay yours.

Intent Rewrite Gate is a small, instruction-only Skill. It cleans up filler, mixed Chinese and English, tentative guesses, and mid-sentence corrections, then returns one copy-ready prompt. It does not expand or execute the request.

## Use

```text
$intent-rewrite-gate <your rough request>
```

That is the default interface.

Optional controls are available when needed:

```text
$intent-rewrite-gate strict <use only my words>
$intent-rewrite-gate grounded <use minimal context to resolve meaning>
$intent-rewrite-gate audit <return the prompt plus a fidelity report>
```

## Example

```text
Input:  登录最近老出问题，可能是 token，界面也改好看点，算了界面先别动。
Output: 修复最近频繁出现的登录问题；将 token 作为待验证的可能原因，不要修改界面。
```

The Skill preserves final intent, keeps guesses distinct from facts, removes withdrawn ideas, and keeps short requests short.

## Install

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/Shhaaawwww/intent-rewrite-gate.git \
  ~/.agents/skills/intent-rewrite-gate
```

Start a new conversation if the Skill does not appear immediately, then invoke `$intent-rewrite-gate`.

## License

MIT. See [`LICENSE`](LICENSE).
