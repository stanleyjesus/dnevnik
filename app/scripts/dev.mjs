#!/usr/bin/env node
/* Приложение на этом компьютере: http://localhost:5173.
   node scripts/dev.mjs [порт]           — для разработки: сборка без сжатия, пересборка при правке исходников
   node scripts/dev.mjs [порт] --prod    — готовая сборка как она уйдёт на телефон: сжатая, с работой без сети */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, outDir } from './build.mjs';
import { serve } from './serve.mjs';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const prod = process.argv.includes('--prod'), port = +process.argv.slice(2).find(a => /^\d+$/.test(a)) || 5173;

let building = null, again = false;
const rebuild = () => {
  if (building) { again = true; return building; }
  building = build({ dev: !prod }).then(() => console.log(new Date().toLocaleTimeString() + ' собрано'), e => console.log('Сборка не удалась: ' + (e && e.message || e)))
    .finally(() => { building = null; if (again) { again = false; rebuild(); } });
  return building;
};
await rebuild();
let timer = 0;
if (!prod) fs.watch(path.join(app, 'src'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
console.log('Приложение: ' + (await serve(outDir(!prod), port)).url);
