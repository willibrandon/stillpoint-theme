# Stillpoint

Calm surfaces. Precise semantic color.

Stillpoint is a VS Code color theme built around language tooling, terminals, structured logs, and code review. It includes graphite **Night**, warm-paper **Day**, and dark **Contrast** variants.

This is an unreleased local preview for VS Code 1.136 or later. It has no runtime entry point, network access, telemetry, or automatic settings changes.

## Install the local package

1. In VS Code, run **Extensions: Install from VSIX...**.
2. Select `dist/stillpoint-theme-0.1.0.vsix` from this repository.
3. Run **Preferences: Color Theme** and select a Stillpoint variant.

The publisher field identifies the intended author for local packaging. No Marketplace publisher registration or publication has been performed.

## Preview

Open `preview.html` from the source checkout in a browser to compare the three variants. It uses illustrative, manually classified specimens. The actual theme files are in `themes/`.

Teal identifies types and active controls, blue identifies calls, sage identifies strings, iris identifies keywords, and copper identifies literal values. Comments and secondary text retain measured contrast. All variants preserve your font, ligatures, layout, cursor, and terminal preferences.

Semantic highlighting follows your language provider and VS Code settings. The themes opt in when `editor.semanticHighlighting.enabled` is `configuredByTheme`. They do not install language servers.

## Integration notes

The theme maps ANSI colors, but terminal applications that emit their own RGB colors retain those colors. Keep your existing terminal contrast settings.

Extensions that draw their own colors retain those colors. Custom webviews follow the theme only when their extensions use VS Code theme variables.

## Develop

Use Node.js 22 or 24 and npm:

```sh
npm ci
npm run build
npm run check
npm run package
```

Edit `palette.json` and `mappings/{workbench,textmate,semantic}.json`, then rebuild. `scripts/state-palette.mjs` solves state washes separately from readable text colors. Do not hand-edit generated themes.

`npm run check` verifies generated output, schema registrations, transparency, default-color coverage, 2,849 renderer-specific color/state comparisons, 247 alpha entries, 48 rejected regression mutations, and 201 real-grammar cases. It reads committed, checksum-verified grammars; no sibling checkout or network is needed after `npm ci`. Review intentionally inherited colors in `validation/accepted-defaults.json` and the generated `output/reports/default-coverage.json`.

See [validation instructions](validation/README.md) for isolated real-editor captures and refreshing pinned references. Screenshots cover diff, three-way and inline conflicts, active/inactive selection, unused identifiers, Explorer hover, debugger Variables, inlay hints, Quick Pick, SCM graph, and terminal output in all three variants. Capture artifacts stay local under `output/playwright/`.

This preview includes measured palette validation. Complete editor accessibility, cross-platform compatibility, and comfort claims still require broader testing and extended use.
