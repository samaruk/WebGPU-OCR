/* PRODUCT MATCHER · worker
   Loads the product list and builds the index once, off the page's thread,
   then answers every {id, rows, opts} message with {id, results, ms}. */
import { PRODUCTS, PRODUCT_COLUMNS } from './products-data.js';
import { buildIndex, matchRows } from './matcher.js';

const t0=performance.now();
const index=buildIndex(PRODUCTS, PRODUCT_COLUMNS);
postMessage({ready:true, products:index.items.length, ms:Math.round(performance.now()-t0)});

onmessage=e=>{
  const {id, rows, opts}=e.data||{};
  const t=performance.now();
  try{ postMessage({id, results:matchRows(index, rows||[], opts||{}), ms:Math.round(performance.now()-t)}); }
  catch(err){ postMessage({id, error:String(err&&err.message||err)}); }
};
