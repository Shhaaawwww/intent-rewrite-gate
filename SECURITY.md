# Security Policy

## Supported version

Security fixes target the latest tagged version. DeepSeek Harness is in developer preview, so compatibility is verified against the minimum version documented in the README and the current supported Harness release before each plugin release.

## Data boundary

- The unsent draft and any explicitly selected file content are sent to the model provider already configured in DeepSeek Harness.
- The plugin stores no API key and creates no separate prompt or file-content database.
- Raw command input is excluded from the Harness command log; the rewritten result remains in the session record.
- File and credential checks reduce accidental disclosure but cannot prove that arbitrary text contains no sensitive information. Do not select private or credential-bearing files.

## Reporting a vulnerability

Use the repository's GitHub Security tab to report a vulnerability privately when private reporting is available. Otherwise, open an issue containing only a minimal description and ask the maintainer for a private channel. Do not include credentials, private prompts, file contents, local paths, or exploit data in a public issue.
