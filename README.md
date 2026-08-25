# Intent Rewrite Gate

Turn messy vibe-coding requests into concise prompts without inventing requirements.

> Your words can be messy. Your intent should stay yours.

> **Status:** Experimental v0.1. The core workflow is usable, while comparative evaluation is still being strengthened.

This Skill is a lossless intent rewriter, not a prompt expander. It handles filler, mixed Chinese and English, tentative guesses, and mid-sentence corrections, then returns one copy-ready prompt for a coding agent. It does not execute the task.

## Use it

```text
$intent-rewrite-gate <your rough request>
```

That is the only command most users need.

## Examples

**Self-correction**

```text
Input:  登录最近老出问题，可能是 token，界面也改好看点，算了界面先别动。
Output: 修复最近频繁出现的登录问题；将 token 作为待验证的可能原因，不要修改界面。
```

**Preference versus requirement**

```text
Input:  必须兼容 Python 3.11，尽量只用标准库，实在需要可以加一个小依赖。
Output: 确保兼容 Python 3.11；优先只使用标准库，确有必要时可引入一个小型依赖。
```

**Mixed language and exact keys**

```text
Input:  Please clean this LLM instruction，但不要改变核心意图，output keys 必须是 original 和 rewritten。
Output: Clean this LLM instruction without changing its core intent. The output keys must be exactly `original` and `rewritten`.
```

**Hypothesis stays a hypothesis**

```text
Input:  测试偶尔超时，我怀疑是网络重试导致的。请先确认原因再修。
Output: 调查并修复测试偶尔超时的问题；先验证网络重试是否为原因，不要将其视为已确认结论。
```

**Withdrawn destructive action**

```text
Input:  数据不对就全删了重新导，等等别删数据，先查清楚哪里不对。
Output: 先查明数据异常的原因，不要删除或重新导入数据。
```

## Why it is different

General prompt optimizers often add context, structure, examples, implementation steps, or output requirements. Intent Rewrite Gate has a narrower contract:

- Preserve the final active intent.
- Keep facts, guesses, preferences, and requirements distinct.
- Remove withdrawn ideas instead of reviving them.
- Add no unsupported engineering detail.
- Keep short requests short.
- Read project context only with explicit permission and only to resolve meaning.

It is not an engineering-spec generator, repository summarizer, or task executor.

## Competitive boundary

GitHub Copilot CLI's [`/refine`](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) is the nearest documented product feature: it rewrites rough or spoken prompts for review and has a lower-friction native input experience. Its public command description does not specify this Skill's no-expansion, hypothesis-preservation, withdrawal, or minimal-grounding contract. This repository does not claim measured superiority because it does not include a reproducible `/refine` adapter.

General tools such as [Prompt Perfect](https://promptperfect.xyz/static/faq.html) and [Anthropic's Prompt Improver](https://claude.com/blog/prompt-improver) deliberately add context, structure, examples, or reasoning scaffolds. Intent Rewrite Gate is designed for the narrower case where added detail may silently change what a vibe coder asked for.

## Optional controls

```text
$intent-rewrite-gate strict <use only my words>
$intent-rewrite-gate grounded <use minimal context only to resolve meaning>
$intent-rewrite-gate audit <return the prompt plus a fidelity report>
```

## Install

Clone the Skill directly into your personal Codex skills directory:

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/Shhaaawwww/intent-rewrite-gate.git \
  ~/.agents/skills/intent-rewrite-gate
```

Alternatively, keep this directory anywhere and link it into the Codex skills directory:

```bash
mkdir -p ~/.agents/skills
ln -s /absolute/path/to/intent-rewrite-gate ~/.agents/skills/intent-rewrite-gate
```

Start a new conversation if the skill list has not refreshed, then invoke `$intent-rewrite-gate`. No global `AGENTS.md`, service, database, or third-party Python package is required.

## Evaluation

The repository includes 21 behavior cases, a standard-library evaluation runner, and a versioned snapshot report. See [`evals/README.md`](evals/README.md) and [`evals/results/v0.1-report.md`](evals/results/v0.1-report.md).

The checked-in v0.1 snapshot is invalidated because its generation prompt exposed behavior annotations to the candidate systems. The runner now hides those annotations, but the stored scores have not been regenerated and must not be used as comparative evidence.

Future published snapshots should distinguish deterministic measurements from model-judged semantic scores. They are evidence for a specific model and run, not a universal guarantee.

## License

MIT. See [`LICENSE`](LICENSE).
