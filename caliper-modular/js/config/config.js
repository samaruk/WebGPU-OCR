/* ======================================================================
   STAGE LIST  ·  the ordered set of gallery outputs
   Why: the renderer, the thumbnail gallery and the stage caption must all
   walk the same ordered list. Defining it once here makes adding or
   reordering a stage a single edit.

   Each stage: { id, kind, pass, group, name, desc }
     kind   – which renderer draws it (see render.js)
     pass   – which result object it reads: null (source images),
              'BR' (S.borders), 'TL' (S.textLines), 'CL' (S.columns),
              'CH' (S.characters), 'RC' (S.recognition)
   ====================================================================== */
export const STAGES=[];
const add=(id,kind,pass,group,name,desc)=>STAGES.push({id,kind,pass,group,name,desc});

/* ---- SOURCE ---------------------------------------------------------- */
add('source','source',null,'SOURCE','Source',
  'Original image as loaded, before any correction.');
add('lens','lens',null,'SOURCE','Lens-corrected',
  'Radial lens distortion removed — barrel / pincushion edge bowing straightened. Identical to the source when no bowing is detected or when Rectify image (section 00b) is unchecked.');
add('rectified','rectified',null,'SOURCE','Rectified',
  'Perspective-corrected image — the page quad warped back to a rectangle. Identical to the source when no confident page perspective is detected or when Rectify image is unchecked. Every later stage works on this image.');

/* ---- BORDERS · rules --------------------------------------------------- */
for(const [kind,name,desc] of [
  ['border-binary','Binary',
   'Sauvola binary of the rectified image built with the border k of section 02 (lower than the text k, so thin and faint rules survive). Every rule is read from this mask.'],
  ['border-h-opened','H-opened',
   'Per-row gap bridging then horizontal opening: only locally-near-horizontal structures survive. Every component here is a candidate horizontal rule.'],
  ['border-v-opened','V-opened',
   'The same with the axis swapped: candidate vertical rules.'],
  ['rules','Rules',
   'Every detected rule on the rectified image — solid as strokes, dashed with dot markers. Horizontal in cyan, vertical in lime. Pen lines, table borders and section rules alike.'],
  ['rules-erased','Rules Erased',
   'The working image with every detected rule painted out — table borders, section lines, pen lines and dashed rules alike — using the paper on either side of each rule. Every later stage processes this image.'],
  ['border-layout','Border Layout',
   'The rules interpreted. Full table grid: table region, row bands and column boundaries from borders. Vertical grid: region and columns from borders, rows from text. Header box: a boxed header row whose separators give the column boundaries, extended down over the body. Row rules: stacked long horizontals (header underline, totals line) bounding the table. Section separators in orange.']
]) add('BR_'+kind,kind,'BR','BORDERS · rules','BR · '+name,desc);

/* ---- TEXT LINES · clean ------------------------------------------------ */
for(const [kind,name,desc] of [
  ['border-binary','Binary',
   'Sauvola binary of the rules-erased image (section 01 parameters). Components are labelled on this mask after a 1 px heal dilation.'],
  ['glyph-filter','Components',
   'Character-level components after the noise filter. Green = kept glyph, cyan = piece cut out of a tall component (parent dashed white, dropped bridge rows dark grey), red = still multi-line after the cut, grey = too short (dust, halftone, thin rules), orange = rule-shaped.'],
  ['text-lines','Text Lines',
   'Kept components chained into text lines by horizontal proximity, vertical overlap and comparable height. One colour per accepted line with its member boxes; rejected chains are red and labelled with the reason (lone speck, dash-like, uneven heights, too few glyphs, bridge = pen mark reaching two lines, off-line mark, isolated glyph, page edge). A component whose neighbours sit on two different lines is never allowed to link them, and a chain with members above and below its fitted line is split.'],
  ['full-lines','Full Lines',
   'Accepted lines joined left to right into one full line per text row — one piece per x position, never taller than one line, each piece judged against its nearest neighbour so curled rows still join. Drawn as a polygon that follows the pieces with a centreline through their centres. The join runs in a de-skewed frame using a page tilt estimated from the lines themselves, so a tilted photo never chains neighbouring rows together.'],
  ['clean-binary','Clean Binary',
   'Ink of the accepted text lines only: every rule, border, logo, halftone region, speck and pen mark is gone.']
]) add('TL_'+kind,kind,'TL','TEXT LINES · clean','TL · '+name,desc);

/* ---- COLUMNS ------------------------------------------------------------ */
for(const [kind,name,desc] of [
  ['row-bands','Row Bands',
   'Every full line classified (a table box from the border stage, when present, is folded into the band found from the text, which also grows through every adjacent column-compatible table row): green = table band, blue = invoice header rows above it (a key-value block whose rows cross the item gutters is dropped as foreign), orange = invoice footer rows below (totals, amount in words, free products, signatures — cut off structurally at the first tabular row whose first column is empty and, after recognition, from the first row reading Sub Total / Grand Total / Amount in words / Free Product; a sub-total followed by more item rows stays inside the table). Tags give the piece count. A second run of tabular rows separated from the main one by damaged rows (watermark, pen line, fold) is merged back in when its glyphs respect the same gutters; the badge says how many parts were merged.'],
  ['coverage','Coverage Profile',
   'Glyph coverage across the table band, x de-skewed along the COLUMNS (their slope is estimated separately from the row slope; both are shown in the badge): bar height = how many band rows have ink at that x. Gutters are shaded as slanted bands: red where almost no row has ink, amber where the profile drops to at most 42 % of the neighbouring peaks — a word-space-sized gap that sits at the same x in every row. Word spaces inside a column fall at different x per row and only dent the profile.'],
  ['columns','Columns',
   'The intervals between gutters, trimmed to their content, drawn as slanted quads across the band with index, alignment (left / right / centre from the spread of the cell edges) and cell count.'],
  ['cells','Cells',
   'Row × column grid: every glyph goes to the column under its centre and the union of a row’s glyphs in a column is the cell, coloured by column. A piece that chained two columns is split here. Empty cells are dotted.'],
  ['table','Table Layout',
   'Table region with slanted column separators (at gutter centres) and row separators (between consecutive rows), plus the header and footer regions. This is the invoice skeleton.']
]) add('CL_'+kind,kind,'CL','COLUMNS','CL · '+name,desc);

/* ---- CHARACTERS ------------------------------------------------------- */
for(const [kind,name,desc] of [
  ['characters','Characters',
   'One box per symbol inside every accepted text line of the whole page — table or not: green = a single component, magenta = stacked parts joined into one symbol (i-dot and stem, the dots of a colon), cyan = a piece cut out of a merged component (touching letters or digits). Tags give the line\u2019s typical character width.'],
  ['char-splits','Split Profiles',
   'Every component that was cut: its column ink profile drawn under it, the mean ink level dashed, and the chosen cut columns in red. A cut lands on a local minimum at most the valley depth × mean ink, at least the min character width from the previous cut; slivers narrower than that are merged back.'],
  ['char-sheet','Contact Sheet',
   'Every character crop, normalised into a grid, line by line, so single-character segmentation can be checked at a glance. Cell frame colour follows the character kind (green single, magenta joined, cyan split, yellow / orange reconciled to the engine after recognition).']
]) add('CH_'+kind,kind,'CH','CHARACTERS','CH · '+name,desc);

/* ---- RECOGNITION ------------------------------------------------------- */
for(const [kind,name,desc] of [
  ['rec-characters','Recognised Characters',
   'The recognised symbol drawn over every character box, coloured by confidence (green ≥ 80, amber ≥ 50, red below; grey = no symbol assigned). Recognition runs per full line with Tesseract.js on a crop of the row’s own glyphs (sheared level, upscaled, optional grayscale edges), dictionaries off. The character boxes are then reconciled with the engine word by word: as many boxes under a word as it has characters map one to one; otherwise the word is re-segmented into exactly that many boxes at the best ink valleys (yellow in the Characters stage).'],
  ['rec-lines','Line Text',
   'The engine’s text for every full line of the whole page, each recognised word drawn in its own box at the original size and coloured by confidence. Any piece the full-line join or the table band did not cover is recognised on its own, so nothing on the page is skipped.'],
  ['rec-table','Table Text',
   'The recognised text of every table cell, built from the characters inside the cell in reading order (a middle dot marks a character with no symbol).']
]) add('RC_'+kind,kind,'RC','RECOGNITION','RC · '+name,desc);
