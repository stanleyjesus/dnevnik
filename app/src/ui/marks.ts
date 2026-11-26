/* Значки вместо подписей (просьбы владельца, 26 ноября 2026). Только с днями «День N»; с таблицей дней эталона экраны — как в эталоне.
   - Нагрузка по мышцам на «Обзоре» и «Мышцах»: у мышцы нет подписи «рабочая зона», «ниже рабочей зоны» …, только значок зоны,
     а что значит каждый значок, говорит одна легенда под списком.
   - Журнал: у упражнения рядом с названием — отметка тренировки (рекорд, застой, откат, не делал), а подходы раскрываются нажатием. */
import { C, h, icon, pill, sv } from './dom.ts';
import { D } from './render.ts';
import type { Item, Workout, Zones } from '../core/index.ts';

/* мышца вне расчёта: кружок с чертой — дневник подходов ей не выделяет */
const OFF = 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16zM7 11h10v2H7z';
const offIcon = () => sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('path', { d: OFF, fill: 'currentColor' }));
const ZK = (z: Zones): [string, string][] => [['none', 'нет нагрузки'], ['low', 'мало: до ' + z.min], ['base', 'ниже рабочей: ' + z.min + '–' + z.opt], ['opt', 'рабочая зона: ' + z.opt + '–' + z.high], ['high', 'выше зоны: больше ' + z.high]];

/* значок зоны мышцы; название зоны — в подсказке и для чтения с экрана */
export function zoneMark(v: number, z: Zones, off: boolean) {
  const k = C.zone(v, z), name = off ? 'вне расчёта' : C.ZONE[k].n;
  return h('span', { class: 'pill mark ' + (off ? 'off' : C.ZONE[k].sev), role: 'img', title: name, 'aria-label': name }, off ? offIcon() : icon(C.ZONE[k].sev));
}
/* значок зоны для легенды по ключу зоны ('off' — вне расчёта) */
export const keyMark = (k: string) => k === 'off' ? h('span', { class: 'pill mark off' }, offIcon()) : h('span', { class: 'pill mark ' + C.ZONE[k].sev }, icon(C.ZONE[k].sev));
/* одна легенда на список мышц */
export const zoneKey = (z: Zones, withOff: boolean) => h('div', { class: 'zkey' }, ZK(z).map(([k, t]) => h('span', null, keyMark(k), t)), withOff ? h('span', null, keyMark('off'), 'вне расчёта') : null);

/* отметка упражнения в каждой тренировке — по тем же правилам, что статус на «Прогрессе», и у базового по проценту (максимум по подходам), кроме лёгкого дня: новый максимум — рекорд;
   три тренировки подряд без рекорда (от четвёртой записи) — застой, а если максимум ниже рекордного больше чем на 5% — откат */
let seen: unknown = null, marks: Map<string, string> = new Map();
function markOf(wid: string, ex: string) {
  if (seen !== D) {
    seen = D; marks = new Map();
    for (const s of D.stats) {
      if (C.isLight(D.cfg, s.id)) continue;
      let pr = 0;
      s.ss.forEach((x, i) => {
        if (i && x.metric > s.ss[pr].metric * 1.0005) { pr = i; marks.set(x.wid + '|' + s.id, 'pr'); }
        else if (i >= 3 && i - pr >= 3) marks.set(x.wid + '|' + s.id, x.metric < s.ss[pr].metric * 0.95 ? 'down' : 'flat');
      });
    }
  }
  return marks.get(wid + '|' + ex) || null;
}
const MARK: Record<string, [string, string]> = { pr: ['good', 'рекорд'], flat: ['warn', 'застой'], down: ['serious', 'откат'] };

/* строка упражнения в журнале: название и отметка, подходы — под нажатием */
export function journalRow(w: Workout, it: Item, chips: HTMLElement[]) {
  const m = it.skip ? null : markOf(w.id, it.ex);
  const name = h('span', { class: 'n' }, C.exName(D.cfg, it.ex), it.note ? h('span', { class: 'muted' }, ' · ' + it.note) : null);
  const tag = it.skip ? h('span', { class: 'tag' }, 'не делал') : m ? pill(MARK[m][0], MARK[m][1]) : null;
  if (it.skip) return h('div', { class: 'wo-row wo-fold' }, h('div', { class: 'wo-sum' }, name, tag));
  return h('details', { class: 'wo-row wo-fold' }, h('summary', { class: 'wo-sum' }, name, tag, h('span', { class: 'wo-more', 'aria-hidden': 'true' })),
    h('div', { class: 'chips' }, chips));
}
