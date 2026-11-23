/* Какая функция рисует какую вкладку.
   Перенесено из reference/src/ui3.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { vOverview } from './overview.ts';
import { vWorkout } from './workout.ts';
import { vJournal } from './journal.ts';
import { vProgram } from './program.ts';
import { vProgress } from './progress.ts';
import { vMuscles } from './muscles.ts';
import { vCoach } from './coach.ts';
import { vSetup } from './setup.ts';
import type { View } from './types.ts';

export const VIEW_FN: Record<string, () => View> = { overview: vOverview, workout: vWorkout, journal: vJournal, progress: vProgress, muscles: vMuscles, coach: vCoach, program: vProgram, setup: vSetup };
