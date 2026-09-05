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
  desc:'Radial lens distortion removed — barrel/pincushion edge bowing straightened. Identical to the source when no edge bowing is detected.'},
  {id:'rectified',kind:'rectified',pass:null,group:'SOURCE',name:'Rectified',
  desc:'Perspective-corrected image — the page quad warped back to a rectangle. Identical to the source when no confident page perspective is detected.'}];
for(const [k,n,d] of PASS_KINDS) STAGES.push({id:'A_'+k,kind:k,pass:'A',group:'BEFORE ROTATE · pass A',
  name:'A · '+n,desc:'Before-rotate pass (original image). '+d});
STAGES.push({id:'deskew',kind:'deskewed',pass:null,group:'DESKEW',
  name:'Deskewed',desc:'Rotation-corrected image. Curl dewarping runs on this.'});
STAGES.push({id:'dewarp',kind:'dewarped',pass:null,group:'DESKEW',
  name:'Dewarped',desc:'Curl-corrected image - smoothly curved text-line baselines straightened by a non-rigid warp. Identical to Deskewed when the page is flat. The after-rotate pass runs on this.'});
for(const [k,n,d] of PASS_KINDS) STAGES.push({id:'B_'+k,kind:k,pass:'B',group:'AFTER ROTATE · pass B',
  name:'B · '+n,desc:'After-rotate pass — asymmetric dilation (rowDilH px on x, rowDilV px on y) with H ≫ V fuses entire text-lines into single blobs while keeping stacked lines separate. Row detection consumes these. '+d});
for(const [k,n,d] of PASS_KINDS) STAGES.push({id:'C_'+k,kind:k,pass:'C',group:'AFTER ROTATE · pass C',
  name:'C · '+n,desc:'After-rotate pass — asymmetric dilation (colDilH px on x, colDilV px on y) with V ≫ H fuses each column\u2019s stacked cells into single blobs while keeping side-by-side columns separate. Column detection consumes these. '+d});
STAGES.push({id:'density',kind:'density',pass:'B',group:'BLOB FILTER',
  name:'Height-Density Filter',desc:'Pass B word boxes colour-coded by the height-density rule from section 07b. The mini-histogram in the top-right shows the height distribution of accepted parts; the highlighted bucket span is the modal band [hMin, hMax). Green = kept (height in band); cyan = split children that landed in the band; grey = rejected as too small (noise); red = rejected as too tall with no valid split. Disabled in 07b → every part shows as kept.'});
STAGES.push({id:'borders',kind:'borders',pass:'B',group:'BORDERS',
  name:'Detected Borders',desc:'Horizontal and vertical rules detected on a SEPARATE Pass B binary built with its own k (kBorder). Lower kBorder values catch fainter rules at the cost of more text noise; the peak-density filter rejects the noise.'});
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
