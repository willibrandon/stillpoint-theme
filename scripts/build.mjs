import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const root = new URL('../', import.meta.url);
const palettes = JSON.parse(await readFile(new URL('palette.json', root), 'utf8'));
const checking = process.argv.includes('--check');

function theme(p, variant) {
  const colors = {};
  const set = (keys, value) => keys.split(/\s+/).filter(Boolean).forEach(key => {
    if (key in colors) throw new Error(`Duplicate color: ${key}`);
    colors[key] = value;
  });
  const wash = (role, alpha) => p[role] + alpha;
  set('foreground editor.foreground terminal.foreground input.foreground dropdown.foreground menu.foreground quickInput.foreground sideBar.foreground panelTitle.activeForeground statusBar.foreground statusBar.noFolderForeground statusBar.debuggingForeground titleBar.activeForeground tab.activeForeground editorWidget.foreground editorHoverWidget.foreground editorSuggestWidget.foreground notifications.foreground breadcrumb.activeSelectionForeground list.activeSelectionForeground list.inactiveSelectionForeground list.focusForeground list.hoverForeground peekViewResult.selectionForeground editorInlayHint.foreground inlineChat.foreground', p.fg);
  set('descriptionForeground disabledForeground input.placeholderForeground titleBar.inactiveForeground tab.inactiveForeground tab.unfocusedActiveForeground tab.unfocusedInactiveForeground panelTitle.inactiveForeground sideBarTitle.foreground sideBarSectionHeader.foreground breadcrumb.foreground breadcrumb.focusForeground gitDecoration.ignoredResourceForeground gitDecoration.submoduleResourceForeground editorCodeLens.foreground editorGhostText.foreground minimap.foregroundOpacity', p.muted);
  // This key is an alpha mask, not readable foreground text.
  colors['minimap.foregroundOpacity'] = '#FFFFFFA0';
  set('icon.foreground activityBar.foreground editorBracketHighlight.foreground1 editorBracketHighlight.foreground4', p.property);
  set('editor.background terminal.background tab.activeBackground notebook.cellEditorBackground inlineEdit.originalBackground inlineEdit.modifiedBackground', p.bg);
  set('activityBar.background titleBar.activeBackground titleBar.inactiveBackground editorGroupHeader.tabsBackground statusBar.background statusBar.noFolderBackground statusBar.debuggingBackground', p.recessed);
  set('sideBar.background sideBarSectionHeader.background panel.background tab.inactiveBackground editor.lineHighlightBackground editorInlayHint.background textCodeBlock.background textPreformat.background peekViewEditor.background diffEditor.unchangedRegionBackground multiDiffEditor.headerBackground chat.requestBackground chat.requestBubbleBackground inlineChatInput.background', p.panel);
  set('editorWidget.background editorHoverWidget.background editorHoverWidget.statusBarBackground editorSuggestWidget.background quickInput.background quickInputTitle.background input.background dropdown.background dropdown.listBackground menu.background notifications.background notificationCenterHeader.background peekViewResult.background peekViewTitle.background inlineChat.background debugToolBar.background', p.raised);
  set('activityBar.border sideBar.border sideBarSectionHeader.border panel.border editorGroup.border editorGroupHeader.tabsBorder tab.border titleBar.border statusBar.border statusBar.noFolderBorder statusBar.debuggingBorder editorRuler.foreground editorIndentGuide.background1 editorIndentGuide.background2 editorIndentGuide.background3 editorIndentGuide.background4 editorIndentGuide.background5 editorIndentGuide.background6 editorBracketPairGuide.background1 editorBracketPairGuide.background2 editorBracketPairGuide.background3 editorBracketPairGuide.background4 editorBracketPairGuide.background5 editorBracketPairGuide.background6 multiDiffEditor.border chat.requestBorder chat.requestCodeBorder chat.checkpointSeparator', p.border);
  set('input.border dropdown.border widget.border editorWidget.border editorHoverWidget.border editorSuggestWidget.border menu.border notificationCenter.border notifications.border inlineChat.border inlineChatInput.border editorGhostText.border editorIndentGuide.activeBackground1 editorIndentGuide.activeBackground2 editorIndentGuide.activeBackground3 editorIndentGuide.activeBackground4 editorIndentGuide.activeBackground5 editorIndentGuide.activeBackground6', p.control);
  set('focusBorder list.focusOutline list.inactiveFocusOutline list.focusAndSelectionOutline activityBar.activeBorder tab.activeBorderTop panelTitle.activeBorder inputOption.activeBorder progressBar.background sash.hoverBorder editorCursor.foreground terminalCursor.foreground terminalCommandDecoration.successBackground statusBarItem.remoteBackground badge.background button.background editorBracketMatch.border editorLink.activeForeground textLink.foreground textLink.activeForeground editorSuggestWidget.highlightForeground editorSuggestWidget.focusHighlightForeground editorHoverWidget.highlightForeground peekView.border peekViewTitleLabel.foreground inlineChatInput.focusBorder interactive.activeCodeBorder inlineEdit.modifiedBorder inlineEdit.tabWillAcceptModifiedBorder', p.accent);
  set('button.foreground badge.foreground statusBarItem.remoteForeground terminalCursor.background', p.bg);
  set('button.hoverBackground', variant === 'day' ? '#005C55' : variant === 'contrast' ? '#B1FFEF' : '#93E4D8');
  set('button.border', p.control);
  set('button.secondaryBackground button.secondaryHoverBackground list.activeSelectionBackground list.inactiveSelectionBackground list.focusBackground list.hoverBackground editor.selectionBackground editor.inactiveSelectionBackground editorSuggestWidget.selectedBackground peekViewResult.selectionBackground selection.background inputOption.activeBackground editor.wordHighlightBackground editor.wordHighlightStrongBackground editor.wordHighlightTextBackground menu.selectionBackground terminal.selectionBackground', p.selection);
  set('button.secondaryForeground editorSuggestWidget.selectedForeground editorSuggestWidget.selectedIconForeground menu.selectionForeground terminal.selectionForeground', p.fg);
  set('list.highlightForeground list.focusHighlightForeground inputOption.activeForeground', p.accent);
  set('editorLineNumber.foreground editorGutter.foldingControlForeground', p.line);
  set('editorLineNumber.activeForeground', p.fg);
  set('editorWhitespace.foreground', p.border);
  set('editorBracketHighlight.foreground2 editorBracketHighlight.foreground5', p.type);
  set('editorBracketHighlight.foreground3 editorBracketHighlight.foreground6', p.keyword);
  set('editorBracketHighlight.unexpectedBracket.foreground', p.error);
  set('editorBracketMatch.background', wash('accent', '10'));
  set('editor.findMatchBackground', p.accent);
  set('terminal.findMatchBackground', wash('accent','18'));
  set('editor.findMatchForeground', p.bg);
  set('editor.findMatchBorder terminal.findMatchBorder editor.findMatchHighlightBorder terminal.findMatchHighlightBorder editor.wordHighlightBorder editor.wordHighlightStrongBorder editor.wordHighlightTextBorder', p.accent);
  set('editor.findMatchHighlightBackground terminal.findMatchHighlightBackground peekViewResult.matchHighlightBackground peekViewEditor.matchHighlightBackground', wash('accent', '10'));
  set('editor.findRangeHighlightBackground editor.rangeHighlightBackground', wash('accent', '08'));
  set('editorError.foreground errorForeground list.errorForeground gitDecoration.deletedResourceForeground gitDecoration.conflictingResourceForeground editorGutter.deletedBackground editorOverviewRuler.errorForeground minimap.errorHighlight testing.iconFailed testing.message.error.badgeForeground problemsErrorIcon.foreground notificationsErrorIcon.foreground debugIcon.breakpointForeground chat.linesRemovedForeground', p.error);
  set('editorWarning.foreground list.warningForeground editorOverviewRuler.warningForeground minimap.warningHighlight testing.iconQueued testing.iconUnset problemsWarningIcon.foreground notificationsWarningIcon.foreground', p.warning);
  set('editorInfo.foreground editorHint.foreground problemsInfoIcon.foreground notificationsInfoIcon.foreground editorOverviewRuler.infoForeground gitDecoration.modifiedResourceForeground editorGutter.modifiedBackground chat.editedFileForeground', p.info);
  set('gitDecoration.addedResourceForeground gitDecoration.untrackedResourceForeground editorGutter.addedBackground testing.iconPassed testing.message.info.decorationForeground chat.linesAddedForeground terminalCommandDecoration.defaultBackground', p.success);
  set('gitDecoration.renamedResourceForeground', p.type);
  set('testing.iconSkipped activityBar.inactiveForeground peekViewTitleDescription.foreground editorUnnecessaryCode.border', p.muted);
  set('editorUnnecessaryCode.opacity', '#000000FF');
  set('diffEditor.insertedLineBackground', wash('success','10'));
  set('diffEditor.removedLineBackground', wash('error','10'));
  set('diffEditor.insertedTextBackground inlineChatDiff.inserted inlineEdit.modifiedChangedTextBackground', wash('success','18'));
  set('diffEditor.removedTextBackground inlineChatDiff.removed inlineEdit.originalChangedTextBackground', wash('error','18'));
  set('inlineEdit.modifiedChangedLineBackground', wash('success','10'));
  set('inlineEdit.originalChangedLineBackground', wash('error','10'));
  set('diffEditorGutter.insertedLineBackground diffEditorOverview.insertedForeground', p.success);
  set('diffEditorGutter.removedLineBackground diffEditorOverview.removedForeground', p.error);
  set('diffEditor.border diffEditor.diagonalFill diffEditor.unchangedRegionForeground multiDiffEditor.background', p.border);
  colors['diffEditor.unchangedRegionForeground'] = p.muted;
  colors['multiDiffEditor.background'] = p.bg;
  set('diffEditor.unchangedCodeBackground', p.bg);
  set('diffEditor.move.border diffEditor.moveActive.border', p.info);
  set('merge.currentHeaderBackground merge.incomingHeaderBackground merge.commonHeaderBackground', p.selection);
  set('merge.currentContentBackground merge.incomingContentBackground merge.commonContentBackground', p.panel);
  set('merge.border', p.control);
  set('editor.stackFrameHighlightBackground editor.focusedStackFrameHighlightBackground', wash('warning','10'));
  set('debugIcon.breakpointDisabledForeground debugIcon.breakpointUnverifiedForeground', p.muted);
  set('debugIcon.breakpointCurrentStackframeForeground debugIcon.breakpointStackframeForeground', p.warning);
  set('debugExceptionWidget.background inputValidation.errorBackground inputValidation.warningBackground inputValidation.infoBackground', p.raised);
  set('debugExceptionWidget.border inputValidation.errorBorder', p.error);
  set('inputValidation.warningBorder', p.warning);
  set('inputValidation.infoBorder', p.info);
  set('inputValidation.errorForeground inputValidation.warningForeground inputValidation.infoForeground', p.fg);
  set('terminalCommandDecoration.errorBackground', p.error);
  set('terminal.border terminalOverviewRuler.border', p.control);
  set('terminal.inactiveSelectionBackground', p.selection);
  set('terminalOverviewRuler.cursorForeground', p.accent);
  set('terminalOverviewRuler.findMatchForeground', p.warning);
  set('textPreformat.foreground', p.string);
  set('textBlockQuote.background', p.panel);
  set('textBlockQuote.border textSeparator.foreground', p.control);
  set('chat.slashCommandForeground chat.avatarForeground', p.accent);
  set('chat.slashCommandBackground chat.avatarBackground chat.requestBubbleHoverBackground', p.selection);
  set('inlineChatInput.placeholderForeground chat.thinkingShimmer', p.muted);
  set('interactive.inactiveCodeBorder inlineEdit.originalBorder', p.control);
  for (const tier of ['primary','secondary','successful']) {
    set(`inlineEdit.gutterIndicator.${tier}Foreground`, p.fg);
    set(`inlineEdit.gutterIndicator.${tier}Background`, p.panel);
    set(`inlineEdit.gutterIndicator.${tier}Border`, tier === 'successful' ? p.success : p.accent);
  }
  set('inlineEdit.gutterIndicator.background', p.panel);
  set('inlineEdit.tabWillAcceptOriginalBorder', p.control);
  set('scrollbar.shadow widget.shadow inlineChat.shadow', '#00000030');
  set('scrollbarSlider.background', p.control+'55');
  set('scrollbarSlider.hoverBackground', p.control+'88');
  set('scrollbarSlider.activeBackground', p.control+'BB');
  set('minimap.selectionHighlight', p.selection);
  set('minimap.findMatchHighlight', p.accent);
  // These registered colors are overlays, including several named Foreground.
  // Keep their alpha explicit so underlying decorations remain visible.
  Object.assign(colors, {
    'chat.linesAddedForeground': wash('success','E6'),
    'chat.linesRemovedForeground': wash('error','E6'),
    'chat.requestBubbleBackground': p.panel+'E6',
    'chat.requestBubbleHoverBackground': p.selection+'90',
    'chat.requestCodeBorder': p.control+'CC',
    'chat.thinkingShimmer': p.muted+'E6',
    'editor.inactiveSelectionBackground': p.selection+'80',
    'editor.wordHighlightBackground': wash('accent','10'),
    'editor.wordHighlightStrongBackground': wash('accent','18'),
    'editor.wordHighlightTextBackground': wash('accent','10'),
    'inlineEdit.originalBackground': p.bg+'00',
    'inlineEdit.modifiedBackground': p.bg+'00',
    'merge.currentHeaderBackground': wash('accent','18'),
    'merge.currentContentBackground': wash('accent','08'),
    'merge.incomingHeaderBackground': wash('info','18'),
    'merge.incomingContentBackground': wash('info','08'),
    'merge.commonHeaderBackground': wash('keyword','18'),
    'merge.commonContentBackground': wash('keyword','08'),
    'minimap.selectionHighlight': p.selection+'A0',
    'minimap.findMatchHighlight': wash('accent','80')
  });
  if (variant === 'contrast') {
    set('contrastBorder', p.border);
    set('contrastActiveBorder', p.accent);
    set('editor.selectionForeground', p.fg);
    colors['editorUnnecessaryCode.opacity'] = '#000000FF';
  }
  const ansi = {Black:p.recessed,Red:p.error,Green:p.success,Yellow:p.number,Blue:p.function,Magenta:p.keyword,Cyan:p.accent,White:p.property,BrightBlack:p.muted,BrightRed:p.error,BrightGreen:p.string,BrightYellow:p.warning,BrightBlue:p.function,BrightMagenta:p.keyword,BrightCyan:p.accent,BrightWhite:p.fg};
  for (const [name, color] of Object.entries(ansi)) set(`terminal.ansi${name}`,color);
  const tokenColors=[];
  const rule=(name,scope,role,fontStyle='')=>tokenColors.push({name,scope:scope.split(', '),settings:{foreground:p[role],fontStyle}});
  rule('Explanatory text','comment, punctuation.definition.comment','muted');
  rule('Strings','string','string');
  rule('Numbers and constants','constant.numeric, constant.language, variable.other.constant','number');
  rule('Keywords and declaration','keyword, storage.type, storage.modifier','keyword');
  rule('Types','entity.name.type, support.type, support.class, entity.name.class, entity.name.tag','type');
  rule('Calls','entity.name.function, support.function','function');
  rule('Variables','variable.other.readwrite, variable.other.object','fg');
  rule('Properties and keys','variable.other.property, variable.other.object.property, support.type.property-name, support.type.property-name.json, entity.other.attribute-name, meta.object-literal.key, meta.mapping.key string','property');
  rule('Parameters','variable.parameter','parameter');
  rule('Namespaces and labels','entity.name.namespace, entity.name.label','property');
  rule('Operators and punctuation','keyword.operator, punctuation','operator');
  rule('Escapes and interpolation delimiters','constant.character.escape, punctuation.section.interpolation, punctuation.definition.template-expression','keyword');
  rule('Regexp operators','keyword.operator.regexp, keyword.operator.quantifier.regexp, punctuation.definition.character-class.regexp','keyword');
  rule('Configuration sections','entity.name.section, entity.name.namespace.site-address.caddyfile','type');
  rule('Configuration variables','variable.other.systemd.specifier, variable.other.systemd.environment, variable.other.placeholder.caddyfile, variable.other.environment.caddyfile, variable.other.environment.vhs','parameter');
  rule('Configuration paths','string.unquoted.path.logrotate, string.quoted.path.logrotate','string');
  rule('Configuration identities','entity.name.user.logrotate, entity.name.group.logrotate','property');
  rule('Configuration units','keyword.other.unit.logrotate, keyword.other.unit.vhs','number');
  rule('Markdown headings','markup.heading, entity.name.section.markdown','fg','bold');
  rule('Markdown links','markup.underline.link, markup.underline.link.image','accent','underline');
  rule('Markdown emphasis','markup.italic','fg','italic');
  rule('Markdown strong','markup.bold','fg','bold');
  rule('Markdown code','markup.inline.raw, markup.fenced_code.block punctuation.definition','string');
  rule('Added lines','markup.inserted','success');
  rule('Removed lines','markup.deleted','error');
  rule('Changed lines','markup.changed','warning');
  rule('Invalid syntax','invalid.illegal','error','underline');
  const semanticTokenColors={};
  for(const [selectors,role] of [
    ['keyword modifier decorator','keyword'],['type class interface struct enum typeParameter','type'],
    ['function method macro','function'],['variable','fg'],['property event namespace label','property'],
    ['parameter','parameter'],['number enumMember variable.readonly property.readonly','number'],
    ['string regexp','string'],['comment','muted'],['operator','operator']
  ]) for(const selector of selectors.split(' ')) semanticTokenColors[selector]={foreground:p[role],bold:false,italic:false};
  semanticTokenColors['*.deprecated']={strikethrough:true};
  semanticTokenColors['variable.reassigned:csharp']={underline:true};
  semanticTokenColors['parameter.reassigned:csharp']={underline:true};
  return {$schema:'vscode://schemas/color-theme',name:p.name,semanticHighlighting:true,colors:Object.fromEntries(Object.entries(colors).sort(([a],[b])=>a.localeCompare(b))),tokenColors,semanticTokenColors};
}

await mkdir(new URL('themes/',root),{recursive:true});
await mkdir(new URL('dist/',root),{recursive:true});
for(const [variant,p] of Object.entries(palettes)) {
  const result=theme(p,variant);
  const file=new URL(`themes/stillpoint-${variant}.json`,root);
  if(checking){
    const existing=JSON.parse(await readFile(file,'utf8'));
    if(!isDeepStrictEqual(existing,result)) throw new Error(`Generated theme is stale: ${file.pathname}`);
  } else await writeFile(file,JSON.stringify(result,null,2)+'\n');
  console.log(`${checking?'Verified':'Built'} ${p.name}: ${Object.keys(result.colors).length} workbench colors, ${result.tokenColors.length} grammar rules, ${Object.keys(result.semanticTokenColors).length} semantic rules.`);
}
