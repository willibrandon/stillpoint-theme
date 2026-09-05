# Validation

## Fast, offline gates

Run `npm ci`, then `npm run check`. The check reads the generated themes, measures
text on actual alpha composites, verifies diff/selection cues and line numbers,
checks default-color coverage, and tokenizes the pinned real grammars. It needs
neither another checkout nor network access once dependencies are installed.

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

The 24 captures cover diff, merge conflict, selection over a diagnostic, paused
debugger Variables, native TypeScript inlay hints, Quick Pick, a real Git graph,
and terminal `ls`/`git diff`. The harness uses a disposable Git repository and a
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
