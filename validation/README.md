# Validation

## Fast, offline gates

Run `npm ci`, then `npm run check`. The check reads the generated themes, measures
text on actual alpha composites, verifies diff/selection cues and line numbers,
checks default-color coverage, and tokenizes the pinned real grammars. It needs
neither another checkout nor network access once dependencies are installed.

State gates use consumer-specific foregrounds: syntax on code fills, line numbers
on gutters, ghost text on the editor, and bright-black on the terminal. Contrast
selection is checked against its forced white foreground. Header and content
lines are siblings. Every emitted alpha is inventoried separately; decorative
marks do not become text surfaces. Mutation tests must reject the previous
invisible/faint states without restoring blanket role/surface requirements.

Unused syntax is checked on code-bearing surfaces, including current lines,
diff/merge fills, word changes, and active/inactive selections over those states.
Native TypeScript fades parameters, properties, methods, functions, type aliases,
and whole unused imports (including their comments, strings, and punctuation).
All emitted syntax colors therefore retain the text minimum after the 20% fade;
named semantic-role checks and old-color mutations guard the reported regressions.
Gutter numbers, ghost text, UI labels, and merge headers remain separate consumers.
There is no selected-unused exception. Application-owned terminal backgrounds
and arbitrary provider decorations are not a claim of comprehensive conformance.

`grammars/manifest.json` records immutable commits and SHA-256 hashes for every
vendored grammar and license. Copies are unmodified; upstream contributor metadata
and VS Code's third-party notices are retained. These files are development-only
and excluded from the VSIX. Hash mismatches fail validation.

To restore pinned copies, run `node scripts/refresh-grammars.mjs`. To intentionally
update them, edit the source commits in the manifest, run the script with
`--record-checksums`, and review both grammar and checksum changes. An optional
`--reference /path/to/vscode` reads Microsoft files from a local Git object store.
Only the separate registry-refresh script, `scripts/snapshot-vscode.mjs`, needs
the sibling reference checkout. It never writes there.

`xml-doc-cases.json` tests complete C# documentation ranges with multiline grammar
state: tags, attribute names/quotes/values, entities, CDATA, nested comments, and
ordinary-comment isolation. Its ten semantic token IDs and fallback scopes follow
[Microsoft's C# extension](https://github.com/dotnet/vscode-csharp/blob/main/package.json).
Both paths must agree with their palette roles; synthetic fallback probes are
counted separately from real-grammar cases.

Day additionally checks 28 pairs of generated syntax colors using a minimum
Euclidean Oklab distance of 0.075. This is an art-direction regression threshold,
not a WCAG requirement or a color-vision guarantee. It rejects the old near-black
palette, neutralized syntax, and identical type/string colors. Foreground and seven
colored roles are compared; comments, punctuation, and intentionally shared roles
are excluded. Existing text-contrast and unused-opacity gates remain unchanged.

## Real-editor review on macOS

Never run either editor suite against your normal profile. Both change settings.

1. Run `npm run capture:prepare`; note the disposable workspace path it prints.
2. Launch the native VS Code executable with isolated data and extension folders:

   ```sh
   '/Applications/Visual Studio Code.app/Contents/MacOS/Code' \
     --user-data-dir "$PWD/output/capture-profile" \
     --extensions-dir "$PWD/output/capture-extensions" \
     --extensionDevelopmentPath "$PWD" \
     --extensionTestsPath "$PWD/validation/capture-suite.cjs" \
     --remote-debugging-port=3201 --disable-workspace-trust \
     /absolute/path/printed/by/capture-prepare
   ```

3. Connect a Playwright CLI session named `capture` using a JSON configuration
   containing `{"browser":{"isolated":false,"cdpEndpoint":"http://127.0.0.1:3201"}}`.
   Run `playwright-cli -s=capture open --config /path/to/config.json`.
4. Run `npm run capture`, or set `PLAYWRIGHT_CLI` to an installed CLI/wrapper path.
   `CAPTURE_SCENES=diff,terminal npm run capture -- day` selects a subset.
5. Run `node scripts/capture-scene.mjs night validate` for native schema checks,
   then `node scripts/capture-scene.mjs night finish` to close the test host.

The 54-capture suite covers diff, three-way merge, diff3 inline conflict, selection over
a diagnostic, inactive selection, unused code both selected and unselected,
Explorer hover, paused debugger Variables, native TypeScript inlay hints, Quick
Pick, a real Git graph, and terminal `ls`/`git diff`, in all three variants.
The XML documentation scene also checks every fixture range against native
TextMate-rendered CSS colors. It does not require or claim to run Roslyn;
the fast gates separately validate its custom semantic rules and fallback scopes.
The syntax scene adds a native TypeScript specimen checking seven colored roles,
ordinary variables, and comments, including after semantic highlighting activates.
The unused-role specimen adds normal, multi-selected, and unfocused multi-selected
states for six identifier roles plus an entire unused import. Assertions check
the native semantic foreground, unnecessary-opacity spans, real selection overlap,
and contrast computed from rendered CSS colors, not just the generator's values.
Inline-conflict assertions check native decorations and actual overview-ruler
canvas pixels for current, incoming, and base content. The inline fixture copies
the real Git conflict before the three-way editor initializes its shared result
working copy without markers. The harness uses a disposable Git repository and a
token-protected loopback controller; it does not install the extension. Run one
capture/validation command at a time. The macOS setup fixes Retina DPR at 2 and
uses the terminal's DOM renderer to avoid capture scaling artifacts.

Artifacts and rendered-state assertions go to `output/playwright/`; native schema
results go to `output/editor/validation.json`. Theme hashes must match the generated
JSON. Inspect screenshots as well as assertions. This is not cross-platform or
complete accessibility certification; provider-owned colors require separate tests.

## Package review

`npm run package` validates and creates the local VSIX; it does not publish, push,
or install it. Inspect its allowlisted contents before release. `assets/icon.svg`
is the editable, code-native mark; `assets/icon.png` is its 256×256 browser export.
The VS Code engine floor is unchanged; test any compatibility proposal separately
in an isolated older editor before changing it.
