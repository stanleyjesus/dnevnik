/* Программа текстом (решение владельца, 25 ноября 2026, онбординг): разбор текста по дням и упражнениям (src/core/paste.ts)
   и сверка названий со справочником. Шаг мастера проходит сценарий «онбординг: программа текстом» (scripts/scenarios.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { pasteDays, pasteLine, pasteMatch } from '../src/core/paste.ts';

const cfg = () => { useDays(3, false); try { return Core.mergeCfg(withStarter(null)); } finally { useDays(null, true); } };

test('строка упражнения: подходы, повторы и вес в разных записях, название без чисел и значков', () => {
  assert.deepEqual(pasteLine('1. Жим штанги лёжа 4×6-8 80 кг'), { line: '1. Жим штанги лёжа 4×6-8 80 кг', name: 'Жим штанги лёжа', n: 4, lo: 6, hi: 8, w: 80 });
  assert.deepEqual(pasteLine('- Тяга верхнего блока 3x10'), { line: '- Тяга верхнего блока 3x10', name: 'Тяга верхнего блока', n: 3, lo: 10 });
  assert.deepEqual(pasteLine('Присед 5х5 @102,5'), { line: 'Присед 5х5 @102,5', name: 'Присед', n: 5, lo: 5, w: 102.5 });   // «х» — русская буква
  assert.deepEqual(pasteLine('Румынская тяга 3 x (8–10)'), { line: 'Румынская тяга 3 x (8–10)', name: 'Румынская тяга', n: 3, lo: 8, hi: 10 });
  assert.deepEqual(pasteLine('Махи в стороны — 3 подхода по 15'), { line: 'Махи в стороны — 3 подхода по 15', name: 'Махи в стороны', n: 3, lo: 15 });
  assert.deepEqual(pasteLine('Отжимания на брусьях 3 по 12'), { line: 'Отжимания на брусьях 3 по 12', name: 'Отжимания на брусьях', n: 3, lo: 12 });
  assert.deepEqual(pasteLine('• Планка 3 подхода'), { line: '• Планка 3 подхода', name: 'Планка', n: 3 });
  assert.deepEqual(pasteLine('Жим гантелей под углом 30 3×8'), { line: 'Жим гантелей под углом 30 3×8', name: 'Жим гантелей под углом 30', n: 3, lo: 8 });
  assert.deepEqual(pasteLine('Шраги'), { line: 'Шраги', name: 'Шраги', n: null });
  assert.equal(pasteLine('4×8'), null, 'без названия — не упражнение');
});

test('дни: заголовки «День N», «Тренировка», дни недели и строки с двоеточием; без заголовков — по пустым строкам', () => {
  const t = 'День 1 — грудь\nЖим лежа 4×8\nРазводка 3×12\n\nВторник:\nПрисед 5×5\n\n\nТренировка 3\nПодтягивания 4×8\nДень ног\nВыпады 3×10\nСр\nТяга 3×8\nГрудь и спина:\nОтжимания 3×20';
  assert.deepEqual(pasteDays(t).map(d => [d.name, d.items.map(it => it.name)]), [
    ['День 1 — грудь', ['Жим лежа', 'Разводка']], ['Вторник', ['Присед']], ['Тренировка 3', ['Подтягивания']], ['День ног', ['Выпады']], ['Ср', ['Тяга']], ['Грудь и спина', ['Отжимания']]
  ]);
  assert.deepEqual(pasteDays('Жим лежа 3x8\nТяга 3x10\n\nПрисед 3x5\n\nВыпады 3x10').map(d => d.items.length), [2, 1, 1], 'без заголовков дни разделяет пустая строка');
  assert.deepEqual(pasteDays('Жим лежа 3x8\nДень 2\nПрисед 3x5').map(d => d.name), ['', 'День 2'], 'строки до первого заголовка — тоже день');
  assert.deepEqual(pasteDays('День 1\n\nДень 2\nПрисед'), [{ name: 'День 2', items: [{ line: 'Присед', name: 'Присед', n: null }] }], 'день без упражнений не в счёт');
  assert.deepEqual(pasteDays('Средние дельты 3×15'), [{ name: '', items: [{ line: 'Средние дельты 3×15', name: 'Средние дельты', n: 3, lo: 15 }] }], '«Ср» — день недели, только отдельным словом');
  assert.deepEqual(pasteDays(''), []);
});

test('названия: то же, похожее по словам или короче по смыслу; незнакомое — null', () => {
  const c = cfg(), m = (n: string) => { const id = pasteMatch(c, n); return id ? c.ex[id].n : null; };
  assert.equal(m('жим лёжа'), 'Жим лежа');
  assert.equal(m('Жим штанги лёжа'), 'Жим лежа');
  assert.equal(m('Присед со штангой'), 'Приседания со штангой');
  assert.equal(m('Становая'), 'Становая тяга');
  assert.equal(m('Армейский жим'), 'Жим штанги стоя');
  assert.equal(m('Жим гантелей на наклонной'), 'Жим гантелей под углом 45');
  assert.equal(m('Подтягивания широким хватом'), 'Подтягивания');
  assert.equal(m('Тяга верхнего блока к груди'), 'Тяга верхнего блока');
  assert.equal(m('Молотки'), 'Молотки с гантелями');
  for (const n of ['Планка', 'Пуловер', 'Тяга гантели одной рукой']) assert.equal(m(n), null, n);
  assert.equal(m('Жим ногами'), 'Жим ногами', 'жим ногами — не жим лежа');
});

test('лёгкие и средние дни не предлагаются: они идут за своим упражнением', () => {
  const raw = withStarter(null);
  raw.ex!.bench_light = { n: 'Жим лежа — лёгкий день', mode: 'light', of: 'bench' } as never;
  useDays(3, false);
  try { const c = Core.mergeCfg(raw); assert.equal(pasteMatch(c, 'Жим лежа — лёгкий день'), 'bench'); } finally { useDays(null, true); }
});
