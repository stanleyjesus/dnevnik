/* Выбор сценария на «Программе»: цель и уточняющий список (функция 39 в docs/05). Здесь — правила без экрана:
   какой цели принадлежит режим сборки, что происходит с лимитом недели у силового режима и какой режим считается потерянным.
   Сам экран — кнопки, списки, запоминание выбора — проверяют сценарии npm run screens. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalOf, liftOf, lostMode, mixText, modeKey, othersOf, setMode, soloNow, soloText } from '../src/ui/goal.ts';
import { useDays } from '../src/core/days.ts';
import { STRONG } from '../src/core/strength.ts';
import type { ProgUi } from '../src/ui/types.ts';

const ui = (focus: string, budget = 100): ProgUi => ({ focus, others: 'hold', budget, draft: null, key: '' });

test('цель по режиму сборки: масса, сила, гибрид, вручную', () => {
  assert.equal(goalOf('manual'), 'hand');
  assert.equal(goalOf('even'), 'mass');
  assert.equal(goalOf('m:back'), 'mass');
  assert.equal(goalOf('s'), 'force');
  assert.equal(goalOf('s:bench'), 'force', 'сила в одном базовом — тоже цель «Сила»');
  assert.equal(goalOf('l:bench'), 'mix');
  assert.deepEqual(['l:bench', 's:pullup', 's', 'even', 'm:back', 'manual'].map(liftOf), ['bench', 'pullup', null, null, null, null]);
});

test('силовой режим приходит со своим лимитом недели, а уходя из него, лимит возвращается к прежнему', () => {
  const st = ui('m:back', 70);
  setMode(st, 's', 100);
  assert.deepEqual([st.focus, st.budget, st.keep], ['s', STRONG.budget, 70]);
  st.budget = 60;                                                     // лимит, выбранный уже в силовом режиме
  setMode(st, 's', 100);
  assert.deepEqual([st.budget, st.keep], [60, 70], 'повторный выбор того же режима ничего не трогает');
  setMode(st, 'l:bench', 100);
  assert.deepEqual([st.focus, st.budget, 'keep' in st], ['l:bench', 70, false], 'вернулся лимит, стоявший до силового режима');
});

test('между «всеми базовыми» и одним базовым лимит недели не меняется, а уходя от цели «Сила», возвращается прежний', () => {
  const st = ui('even', 100);
  setMode(st, 's:bench', 100);
  assert.deepEqual([st.focus, st.budget, st.keep], ['s:bench', STRONG.budget, 100]);
  st.budget = 70;
  for (const f of ['s', 's:pullup', 's:bench']) { setMode(st, f, 100); assert.deepEqual([st.focus, st.budget, st.keep], [f, 70, 100]); }
  setMode(st, 'l:bench', 100);
  assert.deepEqual([st.focus, st.budget, 'keep' in st], ['l:bench', 100, false]);
});

test('лимит профиля меньше числа силового режима: берётся лимит профиля', () => {
  const st = ui('even', 60);
  setMode(st, 's', 60);
  assert.equal(st.budget, 60);
  setMode(st, 'even', 60);
  assert.equal(st.budget, 60);
});

test('экран открылся на принятой силовой программе: при уходе к другой цели ставится лимит профиля', () => {
  const st = ui('s', STRONG.budget);
  setMode(st, 'even', 100);
  assert.deepEqual([st.focus, st.budget], ['even', 100]);
});

test('между остальными режимами лимит недели не меняется', () => {
  const st = ui('even', 70);
  for (const f of ['m:legs', 'l:bench', 'manual', 'l:pullup', 'even']) {
    setMode(st, f, 100);
    assert.deepEqual([st.focus, st.budget, 'keep' in st], [f, 70, false]);
  }
});

test('режим, которого больше не из чего собрать: базового нет в справочнике или базовых нет вовсе', () => {
  assert.equal(lostMode('l:bench', ['leg_press', 'pullup']), true);
  assert.equal(lostMode('l:bench', ['bench', 'pullup']), false);
  assert.equal(lostMode('s', []), true);
  assert.equal(lostMode('s', ['bench']), false);
  assert.equal(lostMode('s:bench', ['leg_press', 'pullup']), true, 'сила в базовом, которого больше нет');
  assert.equal(lostMode('s:bench', ['bench']), false);
  assert.equal(lostMode('s:bench', []), true);
  for (const f of ['manual', 'even', 'm:back']) assert.equal(lostMode(f, []), false, f + ' собирается и без базовых');
});

/* дни «День N» (в эталоне дней всегда три): слова о днях режима — под выбранное число дней, а строка о действующей программе —
   по тому, в скольких днях движение стоит сейчас: после смены числа дней действующая программа остаётся прежней */
test('слова о днях режима: под число дней и под то, как программа стоит сейчас', () => {
  assert.ok(soloText(3).startsWith('Оно идёт в каждой тренировке') && soloText(3).includes('лёгкие дни в остальные'));
  assert.ok(soloText(2).startsWith('Оно идёт в каждой тренировке') && soloText(2).endsWith('и лёгкий день.'));
  assert.ok(soloText(4).startsWith('Оно идёт три дня из четырёх') && soloText(4).endsWith('и два лёгких дня.'));
  assert.ok(mixText(2).includes('упражнение на массу стоит в лёгкий день') && mixText(3).includes('и один день на массу'));
  assert.equal(mixText(4), mixText(3));
  assert.equal(soloNow(3, 3), 'оно идёт в каждой тренировке — тяжёлый день и лёгкие');
  assert.equal(soloNow(2, 2), 'оно идёт в каждой тренировке — тяжёлый день и лёгкий');
  assert.equal(soloNow(3, 4), 'оно идёт три дня из четырёх — тяжёлый день и два лёгких');
  assert.equal(soloNow(2, 3), 'оно идёт два дня из трёх — тяжёлый день и лёгкий');      // принята на четыре дня, выбрано три
  assert.equal(soloNow(2, 4), 'оно идёт два дня из четырёх — тяжёлый день и лёгкий');   // принята на два дня, выбрано четыре
});

/* режим сборки одной строкой — по нему принятая «по времени» программа узнаёт свой лимит: «остальные базовые» входят только там, где на сборку влияют */
test('режим сборки для лимита по времени', () => {
  assert.equal(modeKey({ focus: 'even', others: 'grow' }), 'even');
  assert.equal(modeKey({ focus: 's', others: 'grow' }), 's');
  assert.equal(modeKey({ focus: 'l:bench', others: 'grow' }), 'l:bench|grow');
  assert.equal(modeKey({ focus: 's:bench', others: 'hold' }), 's:bench|hold');
});

/* «Остальные базовые» в «Гибриде»: с днями «День N» — «Как подсобка» или «Растут как раньше», «Поддержания» в выборе нет
   (решение владельца, 25 ноября 2026); программа, принятая с ним, показывается с «Как подсобка». С таблицей дней эталона — как в эталоне */
test('остальные базовые в «Гибриде»: с днями «День N» два варианта, прежнее поддержание — как подсобка', () => {
  const all = [null, {}, { others: '' }, { others: 'hold' }, { others: 'grow' }, { others: 'plain' }].map(P => othersOf(P));
  assert.deepEqual(all, ['hold', 'hold', 'hold', 'hold', 'grow', 'hold'], 'с таблицей дней эталона — поддержание, если не выбрано «растут»');
  useDays(3, false);
  try {
    assert.deepEqual([null, {}, { others: '' }, { others: 'hold' }, { others: 'grow' }, { others: 'plain' }].map(P => othersOf(P)), ['plain', 'plain', 'plain', 'plain', 'grow', 'plain']);
  } finally { useDays(null, true); }
});
