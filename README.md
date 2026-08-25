# Vibe Intent Compiler

[简体中文](README.zh-CN.md)

A one-click DeepSeek Harness plugin that turns a Vibe Coder's messy draft into a concise, faithful, and actionable instruction—without inventing details.

This is not a general-purpose prompt enhancer. It reads the complete, unsent draft in the DeepSeek Harness composer, reorganizes only what the user actually said, and fills the result back in place. When the user explicitly selects an `@file`, the plugin may use that file only to resolve references already present in the draft. The user reviews, edits, and sends the result.

Version 0.4 is the **Faithful Context Beta**: model rewriting is surrounded by deterministic input and output checks. If a safe, faithful result cannot be verified, the original draft stays unchanged.

## Install

Requirements:

- Node.js `22.19.x` or `24+` (`^22.19.0 || >=24.0.0`).
- DeepSeek Harness `0.1.1-rc.2` or later.
- `pnpm` available on `PATH`. Harness uses it internally to manage profile plugins, even when Harness itself was installed with `npm` or launched through `npx`.
- A default model configured in Harness.

```bash
npm install -g @deepseek-ai/dsh pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
dsh web
```

The plugin command must complete successfully before starting the Web UI. Open or create a conversation; the `✦ Clarify` button appears in the conversation composer, not on the landing page.

If you run Harness through `npx`:

```bash
npm install -g pnpm
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
npx @deepseek-ai/dsh web
```

### Installation troubleshooting

If Harness reports `pnpm not found on PATH`, the plugin has not been installed yet. Stop the Web UI, then run:

```bash
npm install -g pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
dsh web
```

Warnings about `node-domexception` or peer dependencies are non-fatal when installation finishes with `Done`. If the button is still missing, restart `dsh web`, enter a conversation, and hard-refresh the page.

## Use

1. Write a natural, fragmented, or self-correcting request in the composer.
2. Optionally type `@` and pick up to three files from Harness. Only picked file chips are read; plain paths and manually typed mentions are not.
3. Click `✦ Clarify`. The button shows how many files will be used.
4. Review the rewritten draft, edit it if needed, and send it yourself.

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
- Verifies protected text after rewriting and rejects results that omit it or introduce a new `@reference`.
- Does not invent project facts, files, frameworks, implementation details, steps, tests, acceptance criteria, features, or permissions.
- Can resolve an existing name or vague reference from explicitly selected files without searching the project, following imports, or starting an agent loop.
- Keeps short inputs short; normal output is limited to roughly twice the effective source length.
- Never executes the task or sends the message automatically.

## Boundaries and privacy

- Version 0.4 rewrites the complete draft, not a selected range.
- It does not use a double-space shortcut, avoiding conflicts with IMEs, code, and Markdown.
- It uses the default provider and model already configured in Harness, stores no additional API key, and explicitly requests `low` reasoning instead of inheriting the conversation's reasoning effort.
- File context is deterministic, not agentic: only valid file chips recorded by the Harness composer are read. Structured chip offsets are verified, so references work beside Chinese text or punctuation while manually typed `@text` is not treated as a selected file.
- Directories, binary/non-UTF-8 files, workspace escapes, and symlink escapes are rejected.
- Sensitive paths such as `.env`, credential/secret files, SSH/AWS/Git metadata, and private-key formats are blocked. The draft and selected file text are also checked for common credential patterns before they can reach the model.
- At most three files are accepted, up to 24 KiB each and 48 KiB in total. Files are never silently truncated; a rejected reference leaves the draft unchanged.
- Selected file contents are sent to the same configured model provider as the draft. The plugin does not persist a separate copy, but the provider's own retention policy still applies.
- Sensitive-content detection is a conservative, best-effort guard—not a secret manager. Never select a file that may contain credentials or private data.
- The result must retain selected references and detectable code, commands, URLs, paths, and identifiers. It must not introduce a new `@reference` or copy a substantial file line. Failed validation leaves the draft unchanged.
- If the draft changes during rewriting, the stale result is discarded instead of overwriting new input.
- The raw draft is excluded from the command input log. The rewritten result remains in the Harness session as the command result.
- Drafts longer than 20,000 characters are left unchanged rather than silently truncated.

## Local installation

```bash
dsh plugin --profile web add /absolute/path/to/vibe-intent-compiler
dsh web
```

Prebuilt artifacts are committed, so installation does not run build scripts.

For vulnerability reporting and the supported security boundary, see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
