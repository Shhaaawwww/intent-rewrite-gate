# Vibe Intent Compiler

[简体中文](README.zh-CN.md)

A one-click DeepSeek Harness plugin that turns a Vibe Coder's messy draft into a concise, faithful, and actionable instruction—without inventing details.

> Repository and plugin ID: `intent-rewrite-gate`. The stable technical ID is kept for installation compatibility.

This is not a general-purpose prompt enhancer. It reads the complete, unsent draft in the DeepSeek Harness composer, reorganizes only what the user actually said, and fills the result back in place. The user reviews, edits, and sends it.

## Install

Requires DeepSeek Harness `0.1.1-rc.2` or later with a default model already configured.

```bash
npm install -g @deepseek-ai/dsh
dsh plugin --profile web add "github:Shhaaawwww/intent-rewrite-gate#v0.2.1"
dsh web
```

Restart the Web UI after installation. The `✦ Clarify intent` button will appear next to the send button.

If you run Harness through `npx`:

```bash
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/intent-rewrite-gate#v0.2.1"
npx @deepseek-ai/dsh web
```

## Use

1. Write a natural, fragmented, or self-correcting request in the composer.
2. Click `✦ Clarify intent`.
3. Review the rewritten draft, edit it if needed, and send it yourself.

Example:

```text
Before: Login keeps breaking lately, maybe it's the token. Make the UI nicer too—actually, leave the UI alone for now.

After: Fix the recent recurring login issue. Treat the token as a possible cause to investigate, and do not change the UI.
```

## What makes it different

- Uses only information explicitly present in the draft.
- Treats later corrections as replacements only when they conflict with earlier wording.
- Removes withdrawn ideas while preserving constraints, preferences, and uncertainty.
- Preserves code, commands, paths, URLs, error messages, identifiers, schema keys, and technical terms.
- Does not invent project facts, files, frameworks, implementation details, steps, tests, acceptance criteria, features, or permissions.
- Keeps short inputs short; normal output is limited to roughly twice the effective source length.
- Never executes the task or sends the message automatically.

## Boundaries and privacy

- Version 0.2 rewrites the complete draft, not a selected range.
- It does not use a double-space shortcut, avoiding conflicts with IMEs, code, and Markdown.
- It uses the default model already configured in Harness and stores no additional API key.
- If the draft changes during rewriting, the stale result is discarded instead of overwriting new input.
- The raw draft is excluded from the command input log. The rewritten result remains in the Harness session as the command result.
- Drafts longer than 20,000 characters are left unchanged rather than silently truncated.

## Local installation

```bash
dsh plugin --profile web add /absolute/path/to/intent-rewrite-gate
dsh web
```

Prebuilt artifacts are committed, so installation does not run build scripts.

## License

MIT. See [LICENSE](LICENSE).
