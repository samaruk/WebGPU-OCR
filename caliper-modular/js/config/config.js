/* ======================================================================
   CONFIGURATION  ·  fixed pipeline structure
   Why: the render loop, the thumbnail gallery and the stage caption must all
   walk the *same* ordered list of outputs. Defining the 8 per-pass stage
   kinds and the full 21-entry STAGES list in one place makes adding or
   reordering a stage a single-file edit instead of three desynchronised ones.
   ====================================================================== */
/* one descriptor per visible output. Two passes — A (before rotate, on
   the original image) and B (after rotate, on the deskewed image) —
   each run the full Sauvola → dilate → CCA → contour → hull → calipers
   → OBB chain. */
export const PASS_KINDS=[
  ['binary',  'Binary · Sauvola',  'Local adaptive threshold T = m·(1 + k·(s/R − 1)). GPU.'],
  ['dilated', 'Dilated',           'Separable morphological dilation of the mask. CCA runs on this.'],
  ['cca',     'CCA Labels',        'Connected-component labelling (union-find); one hue per component.'],
  ['blobs',   'Blob Pixels',       'Components passing the min-area filter — these feed the geometry stages.'],
  ['contours','Contours',          'Moore-neighbour boundary trace of each blob.'],
  ['hull',    'Convex Hull',       'Andrew monotone-chain hull over each contour.'],
  ['calipers','Rotating Calipers', 'Min-area rectangle search; dots = the four caliper contact points.'],
  ['obb',     'Min-Area Rect (OBB)','Final oriented word boxes. Non-character filter applied; boxes spanning two lines are split at the gap.']
];
export const STAGES=[{id:'source',kind:'source',pass:null,group:'SOURCE',
  name:'Source',desc:'Original image as loaded, before any correction.'},
  {id:'lens',kind:'lens',pass:null,group:'SOURCE',name:'Lens-corrected',
  desc:'Radial lens distortion removed — barrel/pincushion edge bowing straightened. Identical to the source when no edge bowing is detected or when Rectify image (section 00b) is unchecked.'},
  {id:'rectified',kind:'rectified',pass:null,group:'SOURCE',name:'Rectified',
  desc:'Perspective-corrected image — the page quad warped back to a rectangle. Identical to the source when no confident page perspective is detected or when Rectify image (section 00b) is unchecked. Every later stage works on this image.'}];
for(const [k,n,d] of [
  ['rawbinary',    'Binary',        'Sauvola binary of the rectified image built with the border k of section 08 (lower than k, so thin and faint rules survive). Every rule below is read from this mask.'],
  ['borderhopened','H-opened',      'Per-row gap bridging then horizontal opening: only locally-near-horizontal structures survive. Every component here is a candidate horizontal rule.'],
  ['bordervopened','V-opened',      'The same with the axis swapped: candidate vertical rules.'],
  ['borders',      'Rules',         'Every detected rule on the rectified image — solid as strokes, dashed with dot markers. Horizontal in cyan, vertical in lime. Pen lines, table borders and section rules alike.'],
  ['brclean',      'Rules Erased',  'The working image with every detected rule painted out — table borders, section lines, pen lines and dashed rules alike — using the paper on either side of each rule. Every later stage (text lines, columns, pass A, deskew, dewarp, passes B and C) processes this image; only pass B\u2019s own border detection still reads the original.'],
  ['brlayout',     'Border Layout', 'The rules interpreted. Full table grid: table region, row bands and column boundaries from borders. Vertical grid: region and columns from borders, rows from text. Header box: a boxed header row whose separators give the column boundaries, extended down over the body. Row rules: stacked long horizontals (header underline, totals line) bounding the table. Section separators in orange. The erase mask removes every rule before glyph detection.']
]) STAGES.push({id:'BR_'+k,kind:k,pass:'BR',group:'BORDERS · rules',name:'BR · '+n,desc:d});
for(const [k,n,d] of [
  ['rawbinary', 'Binary',      'Sauvola binary of the rectified image (section 02 parameters). Components are labelled on this mask after a 1 px heal dilation.'],
  ['heightfilt','Components',  'Character-level components after the noise filter. Green = kept glyph, cyan = piece cut out of a tall component (parent dashed white, dropped bridge rows dark grey), red = still multi-line after the cut, grey = too short (dust, halftone, thin rules), orange = rule-shaped.'],
  ['tlchains',  'Text Lines',  'Kept components chained into text lines by horizontal proximity, vertical overlap and comparable height. One colour per accepted line with its member boxes; rejected chains are red and labelled with the reason (lone speck, dash-like, uneven heights, too few glyphs, bridge = pen mark reaching two lines). A component whose neighbours sit on two different lines is never allowed to link them.'],
  ['fulllines', 'Full Lines',  'Accepted lines joined left to right into one full line per text row — never overlapping horizontally, never taller than one line. Each full line is drawn as a polygon that follows its pieces (top edge along the piece tops, bottom edge along the piece bottoms) with a centreline through the piece centres, so tilted rows never overlap each other the way bounding rectangles would. The join runs in a de-skewed frame: the page tilt is estimated from the lines themselves, so on a tilted photo a row on the left is never joined to the neighbouring row on the right. A lone glyph that joins nothing is rejected as a stray mark.'],
  ['binary',    'Clean Binary','Ink of the accepted text lines only. This is the binary that pass A consumes: every rule, border, logo, halftone region and speck is gone before any word box is fitted.']
]) STAGES.push({id:'TL_'+k,kind:k,pass:'TL',group:'TEXT LINES · clean',name:'TL · '+n,desc:d});
for(const [k,n,d] of [
  ['clrows',   'Row Bands',        'Every full line classified (a table box from the border stage, when present, seeds the band, which then grows through every adjacent column-compatible table row): green = table band (rows with enough pieces, tolerating a few blank or wrapped rows), blue = header rows above the band, orange = footer rows below. Tags give the piece count. An invoice has one item table: a second run of tabular rows separated from the main one by damaged rows (watermark, pen line, fold) is merged back in when its glyphs respect the same gutters; the badge says how many parts were merged.'],
  ['clprofile','Coverage Profile', 'Glyph coverage across the table band in the de-skewed frame: bar height = how many band rows have ink at that x. Gutters are shaded as slanted bands: red where almost no row has ink, amber where the profile drops to at most 42 % of the neighbouring peaks — a word-space-sized gap that sits at the same x in every row. Word spaces inside a column fall at different x per row and only dent the profile.'],
  ['clcols',   'Columns',          'The intervals between gutters, trimmed to their content, drawn as slanted quads across the band with index, alignment (left / right / centre from the spread of the cell edges) and cell count.'],
  ['clcells',  'Cells',            'Row × column grid: every glyph goes to the column under its centre and the union of a row\u2019s glyphs in a column is the cell, coloured by column. A piece that chained two columns is split here. Empty cells are dotted.'],
  ['cltable',  'Table Layout',     'Table region with slanted column separators (at gutter centres) and row separators (between consecutive rows), plus the header and footer regions. This is the invoice skeleton before any word box is fitted.']
]) STAGES.push({id:'CL_'+k,kind:k,pass:'CL',group:'COLUMNS',name:'CL · '+n,desc:d});
for(const [k,n,d] of PASS_KINDS){
  STAGES.push({id:'A_'+k,kind:k,pass:'A',group:'BEFORE ROTATE · pass A',
    name:'A · '+n,desc:'Before-rotate pass (rectified image). '+d});
  if(k==='blobs') STAGES.push({id:'A_heightfilt',kind:'heightfilt',pass:'A',group:'BEFORE ROTATE · pass A',
    name:'A · Height Filter',desc:'Before-rotate pass (rectified image). One blob must be a single letter, word or line: blobs taller than the max line height are cut at their ink valleys into one blob per line, then every blob is kept only if its height is between the min height and the max line height and it is not rule-shaped (section 05). Green = kept, cyan = line cut out of a multi-line blob (parent outlined dashed white, dropped bridge rows dark grey), red = multi-line merge that could not be cut, grey = too short, orange = rule-shaped. Only green and cyan blobs go on to the contour, hull, calipers and OBB stages.'});
  if(k==='obb') STAGES.push({id:'A_lines',kind:'lines',pass:'A',group:'BEFORE ROTATE · pass A',
    name:'A · Line Blobs',desc:'Before-rotate pass (rectified image). The blobs kept by the height filter are fused horizontally (section 05b) and re-labelled, so every connected component is one whole text line. The tinted mask is the fused component; each line box carries its index and the number of word blobs inside it.'});
  if(k==='obb') STAGES.push({id:'A_fulllines',kind:'fulllines',pass:'A',group:'BEFORE ROTATE · pass A',
    name:'A · Full Lines',desc:'Before-rotate pass (rectified image). Line blobs from 05b that sit on the same text row are joined left to right into one full line (section 05c), drawn as a polygon that follows the pieces so tilted rows never overlap. A join is refused when the combined height would exceed the max line height, and whenever two pieces overlap horizontally — reading left to right there is exactly one piece at any x position, so no full line ever contains more than one line. Each row box carries its index, how many line pieces it joined and its word count; the pieces are outlined faintly inside it.'});
}
STAGES.push({id:'deskew',kind:'deskewed',pass:null,group:'DESKEW',
  name:'Deskewed',desc:'Rotation-corrected image (rules erased when section 02a is on). Curl dewarping runs on this.'});
STAGES.push({id:'dewarp',kind:'dewarped',pass:null,group:'DESKEW',
  name:'Dewarped',desc:'Curl-corrected image - smoothly curved text-line baselines straightened by a non-rigid warp. Identical to Deskewed when the page is flat. The after-rotate pass runs on this.'});
for(const [k,n,d] of PASS_KINDS) STAGES.push({id:'B_'+k,kind:k,pass:'B',group:'AFTER ROTATE · pass B',
  name:'B · '+n,desc:'After-rotate pass — asymmetric dilation (rowDilH px on x, rowDilV px on y) with H ≫ V fuses entire text-lines into single blobs while keeping stacked lines separate. Row detection consumes these. '+d});
for(const [k,n,d] of PASS_KINDS) STAGES.push({id:'C_'+k,kind:k,pass:'C',group:'AFTER ROTATE · pass C',
  name:'C · '+n,desc:'After-rotate pass — asymmetric dilation (colDilH px on x, colDilV px on y) with V ≫ H fuses each column\u2019s stacked cells into single blobs while keeping side-by-side columns separate. Column detection consumes these. '+d});
STAGES.push({id:'density',kind:'density',pass:'B',group:'BLOB FILTER',
  name:'Height-Density Filter',desc:'Pass B word boxes colour-coded by the height-density rule from section 07b. The mini-histogram in the top-right shows the height distribution of accepted parts; the highlighted bucket span is the modal band [hMin, hMax). Green = kept (height in band); cyan = split children that landed in the band; grey = rejected as too small (noise); red = rejected as too tall with no valid split. Disabled in 07b → every part shows as kept.'});
STAGES.push({id:'borderbinary',kind:'borderbinary',pass:'B',group:'BORDERS',
  name:'Border · Binary',desc:'The Sauvola binary mask (built with k=kBorder) that the border detector operates on. Lower kBorder values produce a denser mask that catches fainter rules at the cost of more text noise. This is the literal input to all downstream border logic — use it to debug why a rule was missed (not in the binary) vs why a false positive showed up (something rule-shaped IS in the binary).'});
STAGES.push({id:'borderhopened',kind:'borderhopened',pass:'B',group:'BORDERS',
  name:'Border · H-opened',desc:'The horizontal-opening result that solid h-rule detection runs CCA on. After per-row gap-bridging (fills text crossings) and horizontal morphological opening (wipes anything that isn\u2019t locally-near-horizontal). Every visible connected component in this mask becomes a candidate solid horizontal rule.'});
STAGES.push({id:'bordervopened',kind:'bordervopened',pass:'B',group:'BORDERS',
  name:'Border · V-opened',desc:'The vertical-opening result that solid v-rule detection runs CCA on. Same pipeline as H-opened with the axis swapped. If you expected a vertical rule that wasn\u2019t detected, look here — if the rule\u2019s pixels aren\u2019t in this mask, the issue is upstream (binary or opening kernel); if they ARE here but the rule is missing from Detected Borders, the issue is in the filters (length / coverage / thickness).'});
STAGES.push({id:'borderdots',kind:'borderdots',pass:'B',group:'BORDERS',
  name:'Border · Dots',desc:'Every small connected component (bbox ≤ maxDotSize in both dimensions) the dashed detector considered as a dot candidate. Colour: chained dots that survived all dashed-rule filters are coloured per chain; rejected dots are dim gray. Hover near a column of dim dots that you expected to be detected to see why they were rejected.'});
STAGES.push({id:'borders',kind:'borders',pass:'B',group:'BORDERS',
  name:'Detected Borders',desc:'Horizontal and vertical rules detected on the SEPARATE Pass B binary built with its own k (kBorder). Solid rules drawn as solid strokes; dashed/dotted rules drawn with a dashed pattern. Lower kBorder values catch fainter rules at the cost of more text noise; the perp-isolation filter rejects the noise.'});
for(const [k,n,d] of [
  ['brows', 'Border Table Rows',    'Border-only table detection — same word-row grouping as the heuristic path, but the table band is constrained to rows whose centres lie between the topmost and bottommost detected horizontal rules. Empty when fewer than 2 horizontal rules are detected.'],
  ['bcols', 'Border Table Columns', 'Border-only column detection — column boundaries come directly from detected vertical rules (one column per adjacent border pair). Empty when fewer than 3 vertical rules are detected.'],
  ['btable','Border Table Layout',  'Border-only table region. Compares against the heuristic Table Layout (next group) so you can see which detection method picked up your invoice better.']
]) STAGES.push({id:'BT_'+k,kind:k,pass:'B',group:'BORDER TABLE',name:n,desc:d});
for(const [k,n,d] of [
  ['rows', 'Table Rows',    'After-rotate word boxes grouped into text-line rows; the dominant multi-column band is the line-item table.'],
  ['cols', 'Table Columns', 'Persistent vertical whitespace gutters between word columns split the table into columns.'],
  ['table','Table Layout',  'Detected table region with its row × column grid, plus the invoice header and footer bands.']
]) STAGES.push({id:'T_'+k,kind:k,pass:'B',group:'TABLE LAYOUT',name:n,desc:d});
