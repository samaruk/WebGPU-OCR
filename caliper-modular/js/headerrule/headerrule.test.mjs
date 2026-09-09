// node headerrule.test.mjs — the closest rule laid over the profile columns in order
import { ruleInOrder, tokensOf } from './headerrule.js';
import { HEADER_RULES } from '../config/headerrules.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const W=s=>tokensOf(s).map(t=>({t, text:t}));
const acme=HEADER_RULES.find(r=>r.id==='acme');

console.log('[1] the ACME page read by the OCR: the name column split in four, "Trade Per pa" / "ck VAT", "Value Trade" / "VAT"');
{
  const cols=[W('Category & Produdt Name'),[],[],[],W('Pack Size.'),W('Batch No.'),W('Qty'),W('Trade Per pa'),W('ck VAT'),W('Value Trade'),W('VAT'),W('%'),W('Discount Value'),W('Net Value')];
  const r=ruleInOrder(acme,cols).map(o=>o&&o.key);
  console.log('   ', JSON.stringify(r));
  check(r[7]==='unittp' && r[8]==='unitvat' && r[9]==='totaltp' && r[10]==='totalvat', 'Trade, VAT, Trade, VAT → unittp, unitvat, totaltp, totalvat in order');
  check(r[11]==='discountpct' && r[12]==='totaldiscount' && r[13]==='net' && r[6]==='qty' && r[0]==='name' && r[4]==='pack' && r[5]==='batch', 'the other columns in order');
}
console.log('[1b] among every rule, ACME explains the most of these columns');
{
  const cols=[W('Category & Produdt Name'),[],[],[],W('Pack Size.'),W('Batch No.'),W('Qty'),W('Trade Per pack'),W('VAT'),W('Value Trade'),W('VAT'),W('%'),W('Discount Value'),W('Net Value')];
  const counts=HEADER_RULES.map(r=>({id:r.id, n:ruleInOrder(r,cols).filter(Boolean).length})).sort((a,b)=>b.n-a.n);
  console.log('   ', counts.slice(0,4).map(c=>c.id+':'+c.n).join(' '));
  check(counts[0].id==='acme' && counts[0].n>counts[1].n, 'acme first, ahead of every other rule');
}
console.log('[1c] a % read as 0/0');
check(tokensOf('0/0').join()==='pct' && tokensOf('%').join()==='pct' && tokensOf('Disc %').join()==='disc,pct', '"0/0" and "%" both tokenise to pct');
console.log('[2] fewer than three columns explained: nothing is named by the rule');
{
  const r=ruleInOrder(acme,[W('Foo'),W('Bar'),W('Trade')]);
  check(r.every(o=>!o), 'a lone Trade is not enough');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
