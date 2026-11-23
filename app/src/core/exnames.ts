/* Что тренирует упражнение: мышцы читаются из названия.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { MUSCLE, MUSCLES, PATTERNS } from './catalog.ts';
import { clone } from './records.ts';
import type { ExGuess, MuscleMap } from './types.ts';

/* ---------- what an exercise trains, read from its name: the athlete names it, the diary knows the muscles ----------
   The first rule that fits wins, so the narrow ones stand before the broad ones («бицепс бедра» before «бицепс», «румынская тяга» before «тяга»). */
export const EX_RULES: [RegExp, string, MuscleMap][] = [
  [/французск/, 'iso', { triceps: 1 }],
  [/узк\S* хват/, 'h_push', { triceps: 1, chest: 0.5, delt_front: 0.5 }],
  [/брусь/, 'h_push', { chest: 1, triceps: 1, delt_front: 0.5 }],
  [/выпад|болгарск|сплит|зашагиван|lunge/, 'knee', { quads: 1, glutes: 1 }],
  [/жим\S* ног|гакк|присед|squat|leg press/, 'knee', { quads: 1, glutes: 0.5 }],
  [/жим.*(груд|под углом|наклонн)|(груд|наклонн).*жим|incline/, 'h_push', { chest: 1, delt_front: 0.5, triceps: 0.5 }],
  [/над голов|армейск|жим\S* (\S+ )?(стоя|сидя)|жим.*(плеч|дельт|арнольда)|overhead press|ohp/, 'v_push', { delt_front: 1, delt_mid: 0.5, triceps: 0.5 }],
  [/жим|отжиман|bench|press/, 'h_push', { chest: 1, delt_front: 0.5, triceps: 0.5 }],
  [/подтягив|вертикальн\S* тяг|тяг\S* верхн|pull-?up|pulldown/, 'v_pull', { lats: 1, upper_back: 0.5, biceps: 0.5 }],
  [/пуловер|pullover/, 'iso', { lats: 1 }],
  [/румынск|становая|м[её]ртвая тяга|на прямых ногах|гуд ?морнинг|rdl|deadlift/, 'hinge', { hams: 1, glutes: 1, erectors: 1 }],
  [/гиперэкстенз|разгибан\S* спин/, 'hinge', { erectors: 1, glutes: 0.5, hams: 0.5 }],
  [/ягодичн\S* мост|hip thrust|мостик/, 'hinge', { glutes: 1, hams: 0.5 }],
  [/отведени\S* (ног|бедра)|мах\S* ног|kickback/, 'iso', { glutes: 1 }],
  [/тяг\S* к лицу|face pull|задн\S* дельт|обратн\S* (бабочк|разведен)|(мах|разведен)\S* (\S+ )?в наклоне/, 'iso', { delt_rear: 1, upper_back: 0.5 }],
  [/шраг/, 'iso', { upper_back: 1 }],
  [/тяг|гребл|row/, 'h_pull', { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 }],
  [/разгибан\S* (ног|голен)|leg ext/, 'iso', { quads: 1 }],
  [/сгибан\S* (ног|голен)|бицепс\S* б[её]др|leg curl/, 'iso', { hams: 1 }],
  [/икр|на носки|голен|calf/, 'iso', { calves: 1 }],
  [/пресс|скручив|подъ[её]м\S* ног|планк|ролик/, 'iso', { abs: 1 }],
  [/передн\S* дельт|мах\S* впер[её]д|подъ[её]м\S* (\S+ )?перед собой/, 'iso', { delt_front: 1 }],
  [/мах|средн\S* дельт|разведен\S* (\S+ )?в стороны|отведени\S* рук|lateral/, 'iso', { delt_mid: 1 }],
  [/бабочк|сведени\S* рук|кроссовер|разводк|разведен|pec|fly/, 'iso', { chest: 1, delt_front: 0.5 }],
  [/молот|hammer/, 'iso', { biceps: 1, forearms: 0.5 }],
  [/кист|предплеч|запяст|wrist/, 'iso', { forearms: 1 }],
  [/бицепс|сгибан\S* рук|curl/, 'iso', { biceps: 1 }],
  [/трицепс|разгибан\S* рук|pushdown/, 'iso', { triceps: 1 }]
];
/* name -> { pat, m, uni? }, or null when the name says nothing the diary knows */
export function guessEx(name: string | null | undefined): ExGuess | null {
  const s = ' ' + String(name || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const r = EX_RULES.find(x => x[0].test(s));
  if (!r) return null;
  const def: ExGuess = { pat: r[1], m: clone(r[2]) };
  if (/ (лев|прав)(ая|ой|ую|ый|ое|ого) /.test(s)) def.uni = true;         // «кисть на блоке левая»: one side, its own exercise
  return def;
}
/* a muscle map that came from outside (Claude's answer): only known muscles, only 1 or 0.5, at least one main */
export function cleanDef(o: any): ExGuess | null {
  if (!o || typeof o !== 'object') return null;
  const m: MuscleMap = {};
  for (const [k, v] of Object.entries<any>(o.m || {})) if (MUSCLE[k] && (+v === 1 || +v === 0.5)) m[k] = +v;
  if (!Object.values(m).some(v => v === 1)) return null;
  return { pat: PATTERNS.some(p => p.id === o.pat) ? o.pat : 'iso', m };
}
export const exPrompt = (name: string) => 'Силовое упражнение называется «' + String(name).slice(0, 80) + '». Определи, какие мышцы оно тренирует, и ответь одной строкой JSON без пояснений: {"pat":"…","m":{"…":1}}.\n' +
  'pat — одно из: ' + PATTERNS.map(p => p.id + ' (' + p.n.toLowerCase() + ')').join(', ') + '.\n' +
  'm — мышцы только из списка: ' + MUSCLES.map(x => x.id + ' (' + x.n.toLowerCase() + ')').join(', ') + '. Значение 1 — основная мышца, 0.5 — помогает. Основных одна-три, помогающих не больше трёх.';
export const parseDef = (text: string | null | undefined) => { const t = String(text || ''), i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { return cleanDef(JSON.parse(t.slice(i, j + 1))); } catch (e) { return null; } };
