/* Логика дневника без DOM. Core — тот же набор функций, что страница знала как объект Core. */
import { MUSCLES, MUSCLE, FIX, PATTERNS, SLOTS, SLOT } from './catalog.ts';
import { dnum, dstr, dow, addDays, todayStr, fmtDate, fmtDay, fmtDM, mondayOf, weekNo, weekRange } from './dates.ts';
import { fmt, pct, signed, plural, nSets, list } from './format.ts';
import { parseSets, fmtSets, fromDoc, toDoc, clone } from './records.ts';
import { GEAR, NO_GEAR, gearGuess, gearList, gearOf, placed } from './gear.ts';
import { guessEx, exPrompt, parseDef } from './exnames.ts';
import { mergeCfg, exName, isCycle, cycleOrder, isLight, kindOf, LIGHT, OFF_DEFAULT } from './config.ts';
import { work, e1, topSet, bestSet, effReps, setTarget, estRir, setRir, setVol } from './sets.ts';
import { cycleVol, GOALS, goalOf, goalName, goalRange, waveOf, waveSetsAvg, LIGHT_A, AUTO, lightOf, progPending } from './goals.ts';
import { sortW, sessions, exStats, allStats, weeksInfo, strengthIndex, program, stalledSets } from './stats.ts';
import { ZONE, splitText, volume, zone, avgVolume } from './volume.ts';
import { lastSessionItem, inferStep, stepOf, formulaRange, suggestSet, planCycle, planLight, makeItem, hints, nextSlot, nextDate, plan, knownMax, startWeight, startOf, rangeOf } from './plan.ts';
import { planned, ruleBreaks } from './tally.ts';
import { estMinutes, fmtDur, fmtRest, REST_OPTS } from './time.ts';
import { additions, adapt, applyAdapt } from './adapt.ts';
import { progTally, currentSlots, buildProgram, nudgeMuscle, swapsFor, PRIO_K, PRIOS } from './program.ts';
import { bodyRate } from './body.ts';
import { insights } from './insights.ts';
import { toCsv, coachPrompt } from './export.ts';

export const Core = {
  MUSCLES, MUSCLE, FIX, PATTERNS, SLOTS, SLOT, ZONE, dnum, dstr, dow, addDays, todayStr, fmtDate, fmtDay, fmtDM, mondayOf, weekNo, weekRange, fmt, pct,
  signed, plural, nSets, list, parseSets, fmtSets, fromDoc, toDoc, clone, mergeCfg, exName, isCycle, cycleOrder, splitText, work, e1, topSet, bestSet,
  effReps, setTarget, estRir, setRir, setVol, cycleVol, GOALS, goalOf, goalName, goalRange, waveOf, waveSetsAvg, isLight, kindOf, LIGHT, LIGHT_A, AUTO,
  lightOf, progPending, sortW, sessions, exStats, allStats, weeksInfo, volume, zone, avgVolume, strengthIndex, program, stalledSets, planned, additions,
  adapt, applyAdapt, lastSessionItem, inferStep, stepOf, formulaRange, suggestSet, planCycle, planLight, makeItem, hints, nextSlot, nextDate, plan,
  progTally, currentSlots, buildProgram, nudgeMuscle, swapsFor, PRIO_K, OFF_DEFAULT, knownMax, startWeight, startOf, rangeOf, ruleBreaks, estMinutes,
  fmtDur, fmtRest, REST_OPTS, PRIOS, GEAR, NO_GEAR, gearGuess, gearList, gearOf, placed, guessEx, exPrompt, parseDef, bodyRate, insights, toCsv,
  coachPrompt
};

export type CoreApi = typeof Core;
export type * from './types.ts';
export type { ExStat } from './stats.ts';
export type { Tally } from './tally.ts';
export type { Adapted } from './adapt.ts';
export type { OptRes } from './program.ts';
