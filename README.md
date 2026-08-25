# Vibe Intent Compiler

[简体中文](README.zh-CN.md)

A one-click DeepSeek Harness plugin that turns a Vibe Coder's messy draft into a concise, faithful, and actionable instruction—without inventing details.

This is not a general-purpose prompt enhancer. It reads the complete, unsent draft in the DeepSeek Harness composer, reorganizes only what the user actually said, and fills the result back in place. The user reviews, edits, and sends it.

## Install

Requirements:

- Node.js `22.19.x` or `24+` (`^22.19.0 || >=24.0.0`).
- DeepSeek Harness `0.1.1-rc.2` or later.
- `pnpm` available on `PATH`. Harness uses it internally to manage profile plugins, even when Harness itself was installed with `npm` or launched through `npx`.
- A default model configured in Harness.

```bash
npm install -g @deepseek-ai/dsh pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.3.1"
dsh web
```

The plugin command must complete successfully before starting the Web UI. Open or create a conversation; the `✦ Clarify` button appears in the conversation composer, not on the landing page.

If you run Harness through `npx`:

```bash
npm install -g pnpm
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.3.1"
npx @deepseek-ai/dsh web
```

### Installation troubleshooting

If Harness reports `pnpm not found on PATH`, the plugin has not been installed yet. Stop the Web UI, then run:

```bash
npm install -g pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.3.1"
dsh web
```

Warnings about `node-domexception` or peer dependencies are non-fatal when installation finishes with `Done`. If the button is still missing, restart `dsh web`, enter a conversation, and hard-refresh the page.

## Use

1. Write a natural, fragmented, or self-correcting request in the composer.
2. Click `✦ Clarify`.
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

- Version 0.3 rewrites the complete draft, not a selected range.
- It does not use a double-space shortcut, avoiding conflicts with IMEs, code, and Markdown.
- It uses the default provider and model already configured in Harness, stores no additional API key, and does not inherit the conversation's reasoning effort.
- If the draft changes during rewriting, the stale result is discarded instead of overwriting new input.
- The raw draft is excluded from the command input log. The rewritten result remains in the Harness session as the command result.
- Drafts longer than 20,000 characters are left unchanged rather than silently truncated.

## Local installation

```bash
dsh plugin --profile web add /absolute/path/to/vibe-intent-compiler
dsh web
```

Prebuilt artifacts are committed, so installation does not run build scripts.

## License

MIT. See [LICENSE](LICENSE).
