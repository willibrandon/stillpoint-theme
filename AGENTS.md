# Repository Guidelines

## Project Structure & Module Organization

Stillpoint is an asset-only VS Code extension with Night, Day, and Contrast variants. `palette.json` defines color roles; `scripts/build.mjs` maps them to workbench, TextMate, semantic, and terminal colors. Generated assets live in `themes/stillpoint-{night,day,contrast}.json`.

`fixtures/` contains language specimens. `validation/` holds the pinned color-registry snapshot and editor integration suite. `preview.html` is a standalone, manually classified visual preview, not a live editor. Keep its embedded palettes synchronized with `palette.json`.

## Build, Test, and Development Commands

Use Node.js 22 or 24 and npm. Validation requires the sibling `../vscode` checkout with tag `1.136.1` available.

- `npm ci`: install locked development dependencies.
- `npm run build`: regenerate all three theme files.
- `npm run check`: verify generated output, color registrations, transparency, grammar colors, and preview syntax; regenerate `contrast-report.json`.
- `npm run package`: run checks and create `dist/stillpoint-theme-0.1.0.vsix`.

Open `preview.html` in a browser for local comparisons. Install the package through **Extensions: Install from VSIX…** for actual-editor review.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, and single-quoted JavaScript strings; preserve surrounding formatting without unrelated rewrites. Scripts use ESM `.mjs`; the editor harness uses CommonJS `.cjs`. JSON uses double quotes and two-space indentation. No formatter or lint command is configured.

Use existing palette role names and uppercase hex colors, including alpha where required. Edit palette and generator sources, then rebuild; do not hand-edit generated theme JSON.

## Testing Guidelines

Tests use Node assertions, `vscode-textmate`, and `vscode-oniguruma`. Extend grammar cases in `scripts/verify.mjs` and add representative language-named fixtures. All three variants must pass; preserve contrast thresholds and transparent overlays. Current checks include 411 palette comparisons and 33 grammar checks, not comprehensive accessibility certification.

For editor integration, launch VS Code with `--extensionDevelopmentPath` pointing here and `--extensionTestsPath` pointing to `validation/editor-suite.cjs`. Always supply isolated `--user-data-dir` and `--extensions-dir`: the suite changes theme settings.

## Commit & Pull Request Guidelines

The initial commit uses an imperative subject: “Add Stillpoint theme with Night, Day, and Contrast variants.” Continue concise, verb-led subjects. PRs should describe changes, link relevant issues, report validation results, and include all-variant screenshots for visual changes. Update `CHANGELOG.md` for user-visible changes.

## Repository Boundaries

Keep `DESIGN.md`, `research/`, dependencies, packages, and test artifacts Git-ignored. Treat sibling VS Code repositories as read-only references. Preserve asset-only packaging: no activation code, telemetry, or automatic user-setting changes.
