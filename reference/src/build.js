const fs = require('fs');
const rd = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
let core = rd('core.js').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const ui = rd('ui1.js') + '\n' + rd('ui2.js') + '\n' + rd('ui_prog.js') + '\n' + rd('ui_body.js') + '\n' + rd('ui3.js');
// the three placeholders are replaced with functions so "$" in the sources is never treated as a pattern
let html = rd('shell.html').replace('/*CSS*/', () => rd('style.css')).replace('/*CORE*/', () => core).replace('/*UI*/', () => ui);
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/index.html', html);
// test harness: the same page with an in-memory stand-in for the platform store
const seedW = JSON.parse(rd('workouts.json')), seedC = JSON.parse(rd('config.json'));
const mock = `<script>
(() => {
  const store = new Map(), subs = [];
  ${JSON.stringify(seedW)}.forEach(d => store.set('workouts/' + d.date, d));
  store.set('config/main', ${JSON.stringify(seedC)});
  if (location.search.includes('empty')) store.clear();
  if (location.search.includes('p2')) { store.set('config/profiles', { list: [{ id: 'me', n: 'Мой дневник' }, { id: 'p2', n: 'Второй профиль' }] }); store.set('config/p2', ${JSON.stringify(JSON.parse(rd('config_p2.json')))}); }
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = p => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p), metadata: meta });
  const snapCol = c => { const docs = [...store.keys()].filter(k => k.startsWith(c + '/') && k.split('/').length === c.split('/').length + 1).sort().map(snapDoc); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta }; };
  const fire = () => subs.forEach(s => setTimeout(() => s(), 0));
  const doc = p => ({ id: p.split('/').pop(), path: p, get: async () => snapDoc(p), set: async d => { store.set(p, JSON.parse(JSON.stringify(d))); window.__writes = (window.__writes || 0) + 1; fire(); }, update: async d => { store.set(p, Object.assign({}, store.get(p), d)); fire(); }, delete: async () => { store.delete(p); fire(); },
    onSnapshot: (next) => { const f = () => next(snapDoc(p)); subs.push(f); setTimeout(f, 30); return () => {}; } });
  const col = c => { const q = { path: c, where: () => q, orderBy: () => q, limit: () => q, get: async () => snapCol(c), doc: id => doc(c + '/' + (id || Math.random().toString(36).slice(2))), onSnapshot: (next) => { const f = () => next(snapCol(c)); subs.push(f); setTimeout(f, 30); return () => {}; } }; return q; };
  const db = { doc, collection: col };
  const sample = async (input, o) => { window.__prompt = input; if (/^Силовое упражнение/.test(input)) { window.__asked = (window.__asked || 0) + 1; return { text: /Фермерская/.test(input) ? 'Вот: {"pat":"iso","m":{"forearms":1,"upper_back":0.5}}' : 'Не знаю такого упражнения.', truncated: false }; } const t = '- **Икры и пресс**: добавь по 3 подхода в среду и пятницу.\\n- Румынская тяга 3×8–12 в среду после жима ногами.'; if (o && o.onText) o.onText({ text: t, delta: t }); return { text: t, truncated: false }; };
  const caps = location.search.includes('nodb') ? {} : { db, sample, downloads: { save: async () => ({ status: 'saved' }) }, user: { can: async () => true } };
  window.claude = { use: async n => caps[n] || null };
  window.__store = store;
  window.__fire = fire;                                           // a test puts a document into the store and lets the page hear about it
})();
</script>`;
fs.writeFileSync(__dirname + '/dist/harness.html', html.replace('<script>\n/* ---------- Core', () => mock + '\n<script>\n/* ---------- Core'));
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
