/* Настоящий браузер для проверок: Edge или Chrome без окна, управление — по его отладочному протоколу.
   Ничего ставить не нужно: браузер уже есть в системе, а Node умеет fetch и WebSocket сам.
   Один запуск — один браузер с одной страницей: страница в нём всегда на виду и в фокусе, как у человека,
   а не лежит фоновой вкладкой, где браузер придерживает перерисовку и события.
   Путь к браузеру берётся из CHROME_PATH (так в облачной сессии Claude Code), затем из CHROME_BIN (так на машинах GitHub), затем из обычных
   мест установки и только потом из BROWSER: на Linux BROWSER часто означает «чем открывать ссылки».
   На Linux под учётной записью root (так устроены облачные машины и контейнеры) Chrome запускается без своей песочницы: иначе он не стартует. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

const PATHS = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];

/** Запускает браузер без окна с чистым профилем и отдаёт его страницу.
    who — как назвать страницу в сообщениях; ready — выражение, которое в странице становится истинным, когда она готова к работе */
export async function launch(who, ready) {
  const exe = [process.env.CHROME_PATH, process.env.CHROME_BIN].concat(PATHS, [process.env.BROWSER]).find(p => p && fs.existsSync(p));
  if (!exe) throw new Error('Не найден Edge или Chrome. Укажи путь к браузеру в переменной CHROME_PATH.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dnevnik-browser-'));
  /* порт отладки браузер выбирает сам и записывает в свой профиль: два браузера не займут один порт */
  const linux = process.platform === 'linux', root = linux && typeof process.getuid === 'function' && process.getuid() === 0;
  const proc = spawn(exe, [...(root ? ['--no-sandbox'] : []), ...(linux ? ['--disable-dev-shm-usage'] : []), '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--user-data-dir=' + profile, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  /* что браузер пишет об ошибках: последние 2000 знаков, для сообщения, если он не запустится */
  let said = '';
  proc.stderr.on('data', d => { said = (said + d).slice(-2000); });
  proc.on('error', e => { said = (said + ' ' + (e && e.message || e)).slice(-2000); });
  const close = async () => {
    proc.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* браузер ещё держит свою папку: она временная */ }
  };
  try {
    let target = null;
    for (let i = 0; i < 150 && !target; i++) {
      try {
        const port = +fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
        target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page');
      } catch { /* браузер ещё запускается */ }
      if (!target) await sleep(200);
    }
    if (!target) throw new Error(who + ': браузер не запустился (' + exe + ')' + (said.trim() ? ': ' + said.trim() : ''));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.addEventListener('open', ok); ws.addEventListener('error', no); });
    let id = 0, init = null, gone = false;
    /* браузер закрылся или упал: всё, что ждёт ответа, получает ошибку, а не ждёт вечно */
    const waiting = new Set();
    ws.addEventListener('close', () => { gone = true; for (const rej of waiting) rej(new Error(who + ': браузер закрылся')); waiting.clear(); });
    const call = (method, params) => new Promise((res, rej) => {
      if (gone) { rej(new Error(who + ': браузер закрылся')); return; }
      const my = ++id, on = ev => { const m = JSON.parse(ev.data); if (m.id !== my) return; ws.removeEventListener('message', on); waiting.delete(rej); if (m.error) rej(new Error(m.error.message)); else res(m.result); };
      waiting.add(rej);
      ws.addEventListener('message', on);
      ws.send(JSON.stringify({ id: my, method, params }));
    });
    /* код выполняется в странице; что он вернул через return, приходит сюда */
    const run = async code => {
      const r = await call('Runtime.evaluate', { expression: '(async () => { ' + code + ' })()', awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(who + ': ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text).split('\n')[0]);
      return r.result.value;
    };
    await call('Page.enable');
    await call('Emulation.setFocusEmulationEnabled', { enabled: true });   // страница считает себя в фокусе: события фокуса приходят, как у человека за экраном
    /* ждать, пока загрузится новая страница и её код будет готов к работе */
    const arrive = async (when = ready) => {
      for (let i = 0; ; i++) {
        if (await run('return !window.__old && document.readyState === "complete" && (' + when + ');').catch(() => false)) return;
        if (i > 300) throw new Error(who + ': страница не загрузилась — ' + await run('return location.href + " " + document.readyState + ", готовность: " + (() => { try { return String(' + when + '); } catch (e) { return e.message; } })() + ", на экране: " + document.body.innerText.slice(0, 200).replace(/\\s+/g, " ");').catch(e => e.message));
        await sleep(100);
      }
    };
    return {
      who, call, run, close,
      /* код, который выполняется в странице до её собственного */
      async init(source) { if (init) await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: init }); init = (await call('Page.addScriptToEvaluateOnNewDocument', { source })).identifier; },
      async blank() { await call('Page.navigate', { url: 'about:blank' }); await sleep(150); },
      /* when — своё условие готовности вместо обычного: например, когда страница должна открыться с сообщением о сбое */
      async goto(address, when) { await run('window.__old = true;').catch(() => {}); await call('Page.navigate', { url: address }); await arrive(when); },
      async reload() { await run('window.__old = true;'); await call('Page.reload', {}); await arrive(); },
      /* перезагрузка, когда страница может и не открыться: true — открылась */
      async tryReload(ms) {
        await run('window.__old = true;');
        await call('Page.reload', {});
        for (let i = 0; i < ms / 100; i++) { if (await run('return !window.__old && document.readyState === "complete" && (' + ready + ');').catch(() => false)) return true; await sleep(100); }
        return false;
      },
      size: (w, h) => call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
    };
  } catch (e) { await close(); throw e; }
}
