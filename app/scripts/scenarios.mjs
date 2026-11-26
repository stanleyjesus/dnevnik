/* Сценарии для сверки экранов (scripts/screens.mjs). Сценарий — название и шаги; шаг — подпись и действие.
   Действие выполняется на эталонной странице и в приложении, после него страницы сравниваются.
   Каждый сценарий начинается с чистого запуска обеих страниц с одними и теми же записями и идёт дважды:
   на примерных данных и на том же дневнике неделей позже. Поэтому шаги не привязаны к конкретным упражнениям:
   поле выбирается по началу его id и номеру, дата — от дня, на котором стоят часы страницы.

   data: 'empty' — один раз на пустом дневнике; 'notes' — примерные данные с сохранённым разбором;
   'tuned' — примерные данные со своими лимитами и методикой в настройке первого профиля;
   size: [ширина, высота] — размер экрана, по умолчанию телефон 390 × 844;
   app: true — сценарий идёт только в приложении (того, что он проверяет, у эталона нет) и проверяет себя сам через expect;
   noStore: true — приложение запускается так, будто база браузера недоступна.

   Как добавить шаг: ['что происходит', действие]. Шаг, после которого в приложении ничего не изменилось, считается ошибкой
   сценария — кроме перезагрузки, смены размера и шага с expect. Посмотреть, что меняет каждый шаг: npm run screens -- --шаги. */
const J = v => JSON.stringify(v);

/* действия */
export const go = view => 'await __t.go(' + J(view) + ');';                                   // открыть вкладку
/* открыть вкладку из меню: вкладки «Советы» с днями «День N» нет (решение владельца, 25 ноября 2026) — такой шаг идёт через maybe и там пропускается */
export const tab = view => '__t.el(' + J('#tabs a[href="#' + view + '"]') + '); ' + go(view);
/* шаг, который возвращает с «Советов»: с днями «День N» прошлый шаг пропущен, и возвращаться неоткуда — тогда и этот пропускается */
export const fromCoach = code => maybe('__t.el(' + J('#tabs a[href="#coach"]') + '); ' + code);
export const press = (text, n = 0) => '__t.press(' + J(text) + ', ' + n + ');';              // кнопка по её тексту, n — номер среди одинаковых
export const click = (sel, n = 0) => '__t.click(' + J(sel) + ', ' + n + ');';                // элемент по селектору
export const type = (sel, value, n = 0) => '__t.type(' + J(sel) + ', ' + n + ', ' + J(value) + ');';   // ввести в поле
export const typeAll = (sel, value) => '__t.typeAll(' + J(sel) + ', ' + J(value) + ');';     // одно и то же во все подходящие поля
export const clickAll = sel => '__t.clickAll(' + J(sel) + ');';                              // нажать все подходящие кнопки
export const typeDay = (sel, offset, n = 0) => '__t.type(' + J(sel) + ', ' + n + ', __t.day(' + offset + '));';   // ввести дату: 0 — сегодня по часам страницы
export const pick = (sel, value, n = 0) => '__t.pick(' + J(sel) + ', ' + n + ', ' + J(value) + ');';   // выбрать в списке по значению или тексту
export const pickAt = (sel, index, n = 0) => '__t.pickAt(' + J(sel) + ', ' + n + ', ' + index + ');';  // выбрать в списке по номеру пункта, с конца — отрицательный
/* сценарий сборки на «Программе»: 'manual', 'even', 'm:glutes', 'l:bench', 's', 's:bench', 'p' (тройка, только с днями «День N») или место в группе — { prio: 0 } первая группа мышц, { lift: -1 } последнее базовое.
   У эталона это пункт списка «Как собрать», у приложения — кнопка цели и пункт уточняющего списка: помощник знает оба вида */
export const mode = what => 'await __t.mode(' + J(what) + ');';
export const key = (sel, k, n = 0) => '__t.key(' + J(sel) + ', ' + n + ', ' + J(k) + ');';   // клавиша в поле
export const point = (sel, kind, n = 0, fx = 0.5, fy = 0.5) => '__t.point(' + J(sel) + ', ' + n + ', ' + J(kind) + ', ' + fx + ', ' + fy + ');';   // указатель над элементом
export const wait = ms => 'await __t.wait(' + ms + ');';                                      // прошло столько-то времени по часам проверки: срабатывает автосохранение
export const settle = 'await __t.settle();';                                                  // дождаться, пока экран перестанет меняться
export const expect = (cond, what) => '__t.expect(' + cond + ', ' + J(what) + ');';           // условие (код для страницы) должно выполняться
export const maybe = code => '@maybe ' + code;                                                // шаг «если есть»: на других записях такой кнопки может не быть
export const size = (w, h) => '@size ' + w + ' ' + h;                                         // сменить размер экрана
export const RELOAD = '@reload';                                                              // перезагрузить обе страницы

const TABS = ['overview', 'workout', 'journal', 'progress', 'muscles', 'coach', 'program', 'setup'];
const tabs = note => TABS.map(v => [v + (note ? ' ' + note : ''), v === 'coach' ? maybe(tab(v)) : go(v)]);
/* вкладки приложения с днями «День N»: «Советов» там нет (решение владельца, 25 ноября 2026) — для сценариев, которые идут только в приложении */
const APP_TABS = TABS.filter(v => v !== 'coach');
const AUTOSAVE = 2800;                                                                        // черновик сохраняется через 2,5 с после правки
const BIG = [1280, 900];

/* одна тренировка по плану: день программы, дата от часов страницы, базовые — по плану или с недобором, запас в их подходах, подсобка — по 10 повторов */
const FINISH = press('Завершить тренировку') + settle + 'if (__t.count("#view .confirm")) ' + press('Завершить');
/* кнопка «все подходы по плану» и поля повторов и запаса есть только у подходов по проценту: с днями «День N» базовое в «Массе» идёт по двойной прогрессии, и их нет */
const ifAny = (sel, code) => 'if (__t.count(' + J(sel) + ')) { ' + code + ' }';
/* кнопка замены у упражнения в дне программы: ссылка «заменить» или кнопка «Заменить», но не пункт списка под ней */
const SWAP = '#view button[id^="sw-"]:not([id$="-to"])';
/* новая программа на «Программе» — последняя карточка; пометки строк, которых у программы, которую собрал дневник, нет */
const DRAFT = '[...document.querySelectorAll("#view section.card")].pop()';
const NO_TAGS = '![...d.querySelectorAll(".prow .tag")].some(t => /^(новое|перенос|[+−]\\d)/.test(t.textContent))';
const session = (label, slot, offset, reserve, reps, after = '') => [
  [label + ': план', go('workout') + settle + press(slot) + settle + typeDay('#np-date', offset)],
  [label + ': старт', press('Начать тренировку') + (after ? settle + after : '')],
  [label + ': подходы', (reps == null ? ifAny('.cyc-sets button', clickAll('.cyc-sets button')) : ifAny('input[id^="cr-"]', typeAll('input[id^="cr-"]', reps))) + (reserve == null ? '' : ifAny('input[id^="cq-"]', typeAll('input[id^="cq-"]', reserve))) + typeAll('input[id^="r-"]', 10)],
  [label + ': завершить', FINISH]
];
/* неделя по программе: часы страницы стоят на среде, поэтому понедельник следующей недели — через 5 дней */
const week = (n, reserve, reps, after) => [...session('неделя ' + n + ', пн', 'Понедельник', 7 * n - 2, reserve, reps, after), ...session('неделя ' + n + ', ср', 'Среда', 7 * n, reserve, reps, after), ...session('неделя ' + n + ', пт', 'Пятница', 7 * n + 2, reserve, reps, after)];
/* заметить на экране текст и потом убедиться, что он встречался: так сценарий сам показывает, что дошёл до нужного правила */
const mark = (text, key) => 'if (document.getElementById("view").innerText.includes(' + J(text) + ')) sessionStorage.setItem(' + J(key) + ', "1");';
const WIDTHS = [[360, 740], [414, 896], [600, 900], [768, 1024], [1024, 768], [1440, 900]];
/* «Сила: пауэрлифтерская тройка» в черновике (r — строки дней): у каждого движения один тяжёлый день по запасу и один лёгкий; день начинается тяжёлым днём
   одного движения, за ним — лёгкий день другого */
const TRIAD_DAYS = 'r.length === 3 && ["Приседания со штангой", "Жим лежа", "Становая тяга"].every(n => r.filter(d => d[0].startsWith(n) && d[0].includes("сила по запасу")).length === 1 && r.filter(d => d[1].startsWith(n + " — лёгкий день")).length === 1)'
  + ' && r.every(d => d[1].split(" — ")[0] !== d[0].replace(/(новое|сила по запасу)+$/, ""))';
/* движение, которого ещё нет в журнале, — без веса: атлет вводит его сам (здесь 60 кг) */
const NEW_W = 'for (const e of document.querySelectorAll("input[id^=\\"cw-\\"]")) if (!e.value) __t.type("#" + e.id, 0, 60);';

/* для сценариев, которые идут только в приложении */
const box = 'document.getElementById("import-box")';
const loadCopy = text => 'window.__dnevnik.loadBackupText(' + text + ', "copy.json");';
const stored = '(await __t.look()).store';
/* встроенный справочник упражнений: сколько упражнений лежит на снарядах, сколько «без снаряда», сообщение внизу экрана */
const chips = 'document.querySelectorAll("#view .gear-grid .chip").length', looseN = 'document.getElementById("gear-loose-n").textContent.trim()';
const toastIs = text => 'document.getElementById("toast").textContent === ' + J(text);
/* черновик программы: текст первой строки каждого дня — название упражнения вместе с его метками */
const firstRows = '[...[...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday")].map(d => (d.querySelector(".prow .pn") || { textContent: "" }).textContent)';
/* то же для профиля, у которого программа уже есть: дни черновика — в последней сетке на странице; по каждому дню — тексты всех строк */
const draftRows = '[...[...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday")].map(d => [...d.querySelectorAll(".prow .pn")].map(x => x.textContent))';
/* выбор сценария на «Программе»: какая кнопка цели нажата (mass, force, mix, hand), какие цели есть, что стоит в уточняющем списке и из чего он состоит */
const goalIs = g => 'document.getElementById("pg-' + g + '").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#pg button[aria-pressed=true]").length === 1';
const goals = '[...document.querySelectorAll("#pg button")].map(b => b.textContent).join()';
const listIs = (id, value) => 'document.getElementById(' + J(id) + ').value === ' + J(value);
const listOf = id => '[...document.getElementById(' + J(id) + ').options].map(o => o.value).join()';
const progTitle = '[...document.querySelectorAll("#view section.card")].pop().querySelector("h2").textContent';
/* время на тренировку: минуты каждого дня черновика (из заголовков дней), подпись выбранного лимита недели, настройка профиля в хранилище */
const dayMins = '[...[...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday-h .sub")].map(e => { const m = e.textContent.match(/≈ (?:(\\d+) ч)?\\s*(?:(\\d+) мин)?/); return m ? (+m[1] || 0) * 60 + (+m[2] || 0) : 0; })';
/* лимит недели черновика — «В программе N из лимита» под счётчиком свободных подходов: с днями «День N» списка «Подходов в неделю» нет, подходы дневник
   считает от времени, дней и цели (просьба владельца, 25 ноября 2026); нет и выбора отдыха — его дневник ставит упражнению сам */
const capOf = '+((document.querySelector("#prog-free .sub").textContent.match(/ из (\\d+)/) || [])[1])';
const noPicks = '!document.getElementById("pb-budget") && !document.getElementById("prog-rest")';
/* новая программа: сколько подходов в неделю (число в начале её заголовка) и сколько упражнений в самом полном дне */
const draftSets = 'parseFloat([...document.querySelectorAll("#view section.card")].pop().querySelector(".sec-h .sub").textContent)';
const dayEx = 'Math.max(...[...[...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday")].map(d => d.querySelectorAll(".prow").length))';
/* новая программа: «сейчас N» в её заголовке — недельная нагрузка того, что действует сейчас; пояснение режима под заголовком */
const nowLoad = '(([...document.querySelectorAll("#view section.card")].pop().querySelector(".sec-h .sub").textContent.match(/сейчас ([\\d.,]+)/) || [])[1] || "")';
const progNote = '[...document.querySelectorAll("#view section.card")].pop().querySelector("p.note").textContent';
const accepted = expect('document.getElementById("toast").textContent.startsWith("Программа принята")', 'сообщение «Программа принята»');
const cfgMain = '(JSON.parse(' + stored + ').find(x => x[0] === "config/main") || [0, {}])[1]';
const journal = n => expect('document.querySelectorAll(".wo").length === ' + n, 'записей в журнале: ' + n);
/* карточка упражнения в идущей тренировке по началу названия; тренировки из хранилища; строка плана «Разгибания ног» (поправка «Не делал два раза») */
const exCard = name => '[...document.querySelectorAll("#view .ex")].find(c => c.querySelector("h3").textContent.startsWith(' + J(name) + '))';
const savedW = 'JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/")).map(x => x[1])';
/* «сила по запасу»: вес тяжёлого дня движения (83%) по записям тренировок, по датам. Правило проверяется по пояснению в карточке идущей тренировки,
   а с днями «День N» пояснения о прошлом разе там нет (просьба владельца, 26 ноября 2026) — тогда по весу: последняя неделя против предыдущей */
const heavyW = id => savedW + '.filter(w => w.items.some(i => i.ex === ' + J(id) + ' && String(i.cyc).startsWith("83/"))).sort((a, b) => a.date < b.date ? -1 : 1).map(w => Math.max(...String(w.items.find(i => i.ex === ' + J(id) + ' && String(i.cyc).startsWith("83/")).sets).split(" ").map(s => parseFloat(s) || 0)))';   // в записи: cyc "83/4", подходы "90x4@2 90x4@2 …"
const WAS = { up: 'a > b', hold: 'a === b', fail: 'a < b', short: 'a < b' };
const seenW = (key, id, what) => expect('sessionStorage.getItem(' + J(key) + ') === "1" || (t => t.length > 1 && ((a, b) => ' + WAS[key] + ')(t[t.length - 1], t[t.length - 2]))(' + heavyW(id) + ')', what);
const skipRow = '([...document.querySelectorAll("#view .plan-row")].find(r => r.textContent.startsWith("Разгибания ног")) || { textContent: "" })';
/* онбординг (решение владельца, 25 ноября 2026): какой шаг на экране, видны ли вкладки, строка «что возьмёт дневник» у упражнения */
const onbAt = (n, of) => '!!document.getElementById("onb") && document.getElementById("onb-n").textContent === "Шаг ' + n + ' из ' + of + '"';
const DOT = '(i => [...document.querySelectorAll(".pdots button")].map(b => b.getAttribute("aria-current")).join() === [0, 1].map(j => String(j === i)).join())';   // в карусели дней онбординга открыт день i (два дня)
const OPEN = '(i => [...document.querySelectorAll("#onb-days > .pslot")].map(e => e.dataset.off).join() === [0, 1].map(j => String(j - i)).join() && !document.querySelector("#onb-days > .pslot:nth-child(" + (i + 1) + ") > .pclip").inert)';   // открыт день i: остальные — края, его упражнения доступны
const SWIPE = '(dx => { const c = document.getElementById("onb-days"), r = c.getBoundingClientRect(), p = (t, x) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, isPrimary: true, pointerId: 7, pointerType: "touch", clientX: x, clientY: r.top + 60 })); p("pointerdown", r.left + r.width / 2); for (let k = 1; k <= 4; k++) p("pointermove", r.left + r.width / 2 + dx * k / 4); p("pointerup", r.left + r.width / 2 + dx); })';   // палец по карусели дней вбок на dx
const tabsOff = 'getComputedStyle(document.querySelector(".tabs")).display === "none"';
const PASTED = 'День 1\nЖим штанги лёжа 4×6-8 80 кг\nТяга верхнего блока к груди 3x10\nПуловер с гантелью 3×12\n\nДень 2:\nПрисед 4×6 @100\nРумынская тяга 3 x (8–10)';
const outIs = (id, text) => expect('document.getElementById("kw-out-' + id + '").textContent === ' + J(text), id + ': ' + text);
/* вкладка открылась: нарисована, без сообщения о сбое. Ошибку в коде страницы и страницу шире экрана проверка ловит сама на каждом шаге */
const opens = (v, note = '') => [v + (note ? ' ' + note : '') + ': открывается', go(v) + settle + expect('location.hash === "#' + v + '" && !document.querySelector(".banner.crit") && document.querySelector("#view .wrap").children.length > 0', 'вкладка ' + v + ' открылась')];

export const SCENARIOS = [
  { name: 'вкладки, телефон', steps: tabs() },
  { name: 'вкладки, большой экран', size: BIG, steps: tabs() },

  { name: 'тренировка: запись и завершение', steps: [
    ['план', go('workout')],
    ['старт', press('Начать тренировку')],
    /* базовое по волне: подход с запасом; подсобка: в диапазоне, верх диапазона, ниже диапазона */
    ['ввод подходов', ifAny('input[id^="cr-"]', type('input[id^="cr-"]', 5) + type('input[id^="cq-"]', 2)) + type('input[id^="r-"]', 9) + type('input[id^="q-"]', 1) + type('input[id^="r-"]', 12, 1) + type('input[id^="r-"]', 7, 2) + type('input[id^="q-"]', 0, 2)],
    ['перезагрузка до автосохранения: ввод цел', RELOAD],
    ['автосохранение', wait(AUTOSAVE)],
    ['обзор: тренировка идёт', go('overview')],
    ['продолжить с обзора', press('Продолжить')],
    ['в журнале запись «идёт»', go('journal')],
    ['продолжить из журнала', press('Продолжить')],
    ['вопрос перед завершением', press('Завершить тренировку')],
    ['вернуться', press('Вернуться')],
    ['завершить', press('Завершить тренировку') + settle + press('Завершить')],
    ['журнал после тренировки', go('journal')],
    /* то же, что в «журнале» у шага «вместо правки снова план»: после «Завершить» вкладка «Тренировка» иногда успевает отрисоваться посреди перехода
       на «Обзор», ещё без законченной записи, и у той страницы, где это случилось, план остался бы прежним (среда вместо пятницы). Кнопка дня берёт план заново */
    ['новый план', go('workout') + settle + press('Пятница')],
    ['вторая тренировка в тот же день', typeDay('#np-date', 0) + settle + press('Начать с пустого листа')],
    ['автосохранение второй', type('#wk-note', 'вторая за день') + wait(AUTOSAVE)],
    ['отменить вторую: вопрос', press('Отменить')],
    ['отменить вторую: да', press('Удалить тренировку')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'тренировка: план', steps: [
    ['план', go('workout')],
    ['день: пятница', press('Пятница')],
    ['день: понедельник', press('Понедельник')],
    ['день: среда', press('Среда')],
    ['дата на завтра', typeDay('#np-date', 1)],
    ['только по моим правилам', maybe(press('Только по моим правилам'))],
    ['с поправками дневника', maybe(press('С поправками дневника'))],
    ['снять первую поправку', maybe(click('input[id^="pp-"]'))],
    ['снять вторую поправку', maybe(click('input[id^="pp-"]', 1))],
    ['вернуть первую поправку', maybe(click('input[id^="pp-"]'))],
    ['отдых 3 минуты', maybe(pick('#np-rest', 180))],                                  // с днями «День N» выбора отдыха нет: его ставит дневник
    ['пятница', press('Пятница')],
    ['пустой лист', press('Начать с пустого листа')],
    ['упражнение в пустой лист', pickAt('#add-ex', 0) + press('Добавить упражнение')],
    ['отменить: вопрос', press('Отменить')],
    ['отменить: вернуться', press('Вернуться')],
    ['отменить: да', press('Отменить') + settle + press('Удалить тренировку')],
    ['план снова', go('workout')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'тренировка: правки по ходу', steps: [
    ['старт', go('workout') + settle + press('Начать тренировку')],
    /* с днями «День N» режима у базового нет, а в «Массе» оно идёт по двойной прогрессии: эти шаги там пропускаются */
    ['режим базового: сила по запасу', maybe(pick('select[id^="goal-"]', 'auto'))],
    ['режим базового: обычная волна', maybe(pick('select[id^="goal-"]', ''))],
    ['вес базового', maybe(type('input[id^="cw-"]', '182,5'))],
    ['схема базового', maybe(pickAt('select[id^="cs-"]', 1))],
    ['число подходов базового', maybe(type('input[id^="cn-"]', 5))],
    ['все подходы по плану', maybe(click('.cyc-sets button'))],
    ['запас в последнем подходе', maybe(type('input[id^="cq-"]', 1, 4))],
    ['поправка: вернуть по правилу', maybe(press('Вернуть по правилу'))],
    ['поправка: применить', maybe(press('Применить'))],
    /* с днями «День N» в идущей тренировке нет диапазона, стрелок и «убрать» (просьба владельца, 26 ноября 2026): эти шаги там пропускаются */
    ['диапазон: нижняя граница', maybe(type('input[id^="rng-"]', 6))],
    ['диапазон: верхняя граница', maybe(type('input[id^="rng-"]', 10, 1))],
    ['диапазон по формуле шага', maybe(click('button[title^="Шаг "]'))],
    ['цель подсобки: 6–10', maybe(pick('select[aria-label="Диапазон по цели"]', 'both'))],
    ['цель подсобки: 8–12', maybe(pick('select[aria-label="Диапазон по цели"]', 'mass'))],
    ['добавить подход', press('Подход')],
    ['убрать второй подход', click('button[aria-label="Убрать подход 2"]')],
    ['упражнение ниже', maybe(click('button[aria-label="Переместить ниже"]'))],
    ['упражнение выше', maybe(click('button[aria-label="Переместить выше"]', 2))],
    ['не делал', click('button[aria-label="Отметить «не делал»"]', 3)],
    ['вернуть в тренировку', click('button[aria-label="Вернуть в тренировку"]')],
    ['не делал: оставить', click('button[aria-label="Отметить «не делал»"]', 2)],
    ['убрать упражнение', maybe(click('button[aria-label="Убрать упражнение"]', 4))],
    ['упражнение из списка', pick('#add-ex', 'pec_fly') + press('Добавить упражнение')],
    ['базовое из списка', pick('#add-ex', 'bench') + press('Добавить упражнение')],
    ['новое упражнение: форма', pick('#add-ex', '__new') + press('Добавить упражнение')],
    ['новое упражнение: без названия', press('Сохранить упражнение')],
    ['новое упражнение: без мышц', type('#xf-new-n', 'Фермерская прогулка') + press('Сохранить упражнение')],
    ['новое упражнение: сохранить', pick('#xf-new-m-forearms', '1') + pick('#xf-new-m-upper_back', '0.5') + type('#xf-new-lo', 10) + type('#xf-new-hi', 15) + click('#xf-new-uni') + press('Сохранить упражнение')],
    ['дата тренировки: вчера', typeDay('#wk-date', -1)],
    ['день программы: пятница', press('Пт')],
    ['отдых 2 минуты', maybe(pick('#wk-rest', 120))],
    ['заметки', type('input[id^="ex-note-"]', 'хват уже') + type('#wk-note', 'мало спал')],
    ['автосохранение', wait(AUTOSAVE)],
    ['после перезагрузки всё на месте', RELOAD],
    ['завершить: вопрос с подсчётом', press('Завершить тренировку')],
    ['завершить', press('Завершить')],
    ['журнал', go('journal')],
    ['прогресс', go('progress')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'журнал', steps: [
    ['открыть', go('journal')],
    ['свернуть неделю', click('details.week > summary')],
    ['развернуть старую неделю', click('details.week > summary', 4)],
    ['удаление: вопрос', press('Удалить')],
    ['удаление: нет', press('Нет')],
    ['удаление: вопрос у второй записи', press('Удалить', 1)],
    ['удаление: да', click('.wo .btn.sm.danger:not(.ghost)')],
    ['правка: открыть', press('Изменить', 1)],
    ['правка: отмена', press('Отмена')],
    ['правка: открыть снова', press('Изменить', 1)],
    ['правка: повторы, вес, запас', type('input[id^="r-"]', 11) + type('input[id^="w-"]', '42,5', 1) + type('input[id^="q-"]', 3, 1)],
    ['правка: заметки', type('input[id^="ex-note-"]', 'локти ближе', 1) + type('#wk-note', 'спал мало')],
    ['правка: ушёл в журнал, не сохранив', go('journal')],
    ['чужую запись при открытой правке не открыть', press('Изменить', 2)],
    ['правка: вернуться к ней', press('Изменить', 1)],
    ['правка: сохранить', press('Сохранить изменения')],
    ['вторая правка: дата на сегодня', press('Изменить', 2) + settle + typeDay('#wk-date', 0)],
    ['вторая правка: день программы', press('Пн')],
    ['вторая правка: убрать упражнение и подход', click('button[aria-label="Убрать упражнение"]', 1) + settle + click('button[aria-label="Убрать подход 1"]')],
    ['вторая правка: сохранить под новой датой', press('Сохранить изменения')],
    ['удалить запись, открытую на правку', press('Изменить') + settle + go('journal') + settle + press('Удалить') + settle + click('.wo .btn.sm.danger:not(.ghost)')],
    /* план новой тренировки берётся заново кнопкой дня: страница запоминает план при первом показе вкладки «Тренировка», а при «сохранить под новой датой»
       вкладка иногда успевает отрисоваться посреди перехода в журнал, ещё без записи на сегодня, — и у той страницы, где это случилось, план остался бы прежним */
    ['вместо правки снова план', go('workout') + settle + press('Среда')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'обзор', steps: [
    ['обзор', go('overview')],
    ['открыть план', press('Открыть план')],
    ['назад к обзору', go('overview')],
    ['все советы', maybe(click('#view a[href="#coach"]'))],
    ['обзор ещё раз', fromCoach(go('overview'))],
    ['нагрузка по неделям', press('По неделям')],
    ['обзор в третий раз', go('overview')],
    /* с днями «День N» в «Массе» карточек базовых на обзоре нет: базовое идёт по двойной прогрессии, как подсобка (решение владельца, 24 ноября 2026) — тогда прогресс открывается вкладкой */
    ['базовое → его прогресс', 'if (__t.count("button.ex-card")) { ' + click('button.ex-card') + ' } else { ' + go('progress') + ' }'],
    ['обзор в четвёртый раз', go('overview')],
    ['третье базовое → его прогресс', 'if (__t.count("button.ex-card") > 2) { ' + click('button.ex-card', 2) + ' } else { ' + go('progress') + ' }'],
    ['большой экран', size(...BIG)],
    ['обзор на большом экране', go('overview')]
  ] },

  { name: 'второй профиль', steps: [
    ['свой обзор', go('overview')],
    ['открыть второй профиль', pick('#prof', 'p2')],
    ...tabs('у второго профиля').slice(1),                                         // обзор уже открыт
    ['план второго профиля', go('workout')],
    ['старт', press('Начать тренировку')],
    ['ввод', type('input[id^="w-"]', 40) + type('input[id^="r-"]', 12) + type('input[id^="q-"]', 2) + type('input[id^="w-"]', 40, 1) + type('input[id^="r-"]', 11, 1)],
    ['в первый профиль, не дожидаясь сохранения', pick('#prof', 'me')],
    ['свой журнал', go('journal')],
    ['снова второй профиль', pick('#prof', 'p2')],
    ['тренировка второго профиля на месте', go('workout')],
    ['после перезагрузки открыт второй профиль', RELOAD],
    ['завершить', press('Завершить тренировку') + settle + press('Завершить')],
    ...tabs('у второго профиля после первой тренировки').slice(1),
    ['в первый профиль', pick('#prof', 'me')],
    ['свой обзор прежний', go('overview')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* только в приложении: пустой дневник начинается со встроенного справочника упражнений, разложенного по снарядам.
     Программу можно собрать сразу; в хранилище список попадает только с первым сохранением настройки */
  { name: 'пустой дневник', data: 'empty', app: true, steps: [
    /* (решение владельца, 25 ноября 2026) пустой профиль начинается с онбординга; «Пропустить» возвращает прежний пустой «Обзор» */
    ['обзор: онбординг вместо пустого обзора', go('overview') + settle + expect(onbAt(1, 6), 'онбординг, шаг 1 из 6') + expect(tabsOff, 'вкладок не видно') + expect(stored + ' === "[]"', 'в хранилище пусто')],
    /* (решение владельца, 25 ноября 2026) в карточке пустого «Обзора» две кнопки: «Собрать программу» открывает онбординг, вторая — резервная копия */
    ['пропустить: пустой обзор с двумя кнопками', click('#onb-skip') + settle + expect('!!document.querySelector(".card.empty")', 'карточка «В дневнике пока пусто»')
      + expect('[...document.querySelectorAll(".card.empty .btn")].map(b => b.id + ":" + b.textContent).join() === "onb-again:Собрать программу,import-first:Загрузить резервную копию"', 'в карточке две кнопки: «Собрать программу» и «Загрузить резервную копию»') + expect('!(' + tabsOff + ')', 'вкладки на месте')],
    ['собрать программу: снова онбординг', click('#onb-again') + settle + expect(onbAt(1, 6) + ' && ' + tabsOff, 'онбординг, шаг 1 из 6, без вкладок')],
    ['и снова пропустить', click('#onb-skip') + settle + expect('!!document.querySelector(".card.empty")', 'карточка «В дневнике пока пусто»')],
    ...APP_TABS.slice(1).map(v => opens(v)),
    ['настройка: справочник заполнен и разложен по снарядам', go('setup') + settle + expect(chips + ' === 63', '63 упражнения на снарядах') + expect(looseN + ' === "0"', '«без снаряда» пусто')
      + expect('!!document.getElementById("gear-g_pullup")', 'есть снаряд «Подтягивания»') + expect('!document.getElementById("starter-tools")', 'кнопок справочника нет: раскладывать и добавлять нечего')
      + expect(stored + ' === "[]"', 'список встроен: в хранилище по-прежнему пусто')],
    ['блока «Лимиты и методика» нет', click('#setup-more > summary') + settle + expect('!document.getElementById("st-start") && !document.getElementById("view").textContent.includes("Лимиты и методика")', 'в «Остальных настройках» нет лимитов и методики')
      + expect('[...document.querySelectorAll("#setup-more section.card h2")].map(x => x.textContent).join() === "Что беречь,Профили,Справочник упражнений,Данные"', 'в «Остальных настройках» четыре раздела: что беречь, профили, справочник, данные')],
    ['программа: вручную, в списке дня — весь справочник', go('program') + settle + expect(goalIs('hand') + ' && !document.querySelector("#pm, #pl, #ps")', 'для пустого дневника цель «Вручную», уточняющего списка нет')
      + expect('document.querySelectorAll("#pa-mon option").length === 63', 'в списке понедельника 63 упражнения')],
    ['цели: масса, сила, гибрид, вручную', expect(goals + ' === "Масса,Сила,Гибрид,Вручную"', 'четыре кнопки цели: в справочнике есть базовые, поэтому сила и гибрид на месте')],
    /* в «Массе» базовые справочника с нуля сами не встают (решение владельца, 25 ноября 2026): упражнения подбираются по мышцам из остального справочника */
    ['равномерно: без базовых, упражнения по мышцам', mode('even') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'even'), 'цель «Масса», в списке — «Всем поровну»')
      + expect('document.querySelectorAll("#view .prow").length >= 15', 'в черновике не меньше 15 упражнений')
      + expect('![...[...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".prow .pn")].some(e => /^(Жим лежа|Жим ногами|Подтягивания)(новое|$)/.test(e.textContent))', 'жима лежа, жима ногами и подтягиваний в черновике нет')
      + expect('!(document.getElementById("prog-why") || { textContent: "" }).textContent.includes("Базовые — первыми")', 'заметки «Базовые — первыми» нет')],
    ['пауэрбилдинг с нуля: жим лежа', mode('l:bench') + settle + 'const r = ' + firstRows + ';'
      + expect(goalIs('mix') + ' && ' + listOf('pl') + ' === "l:bench,l:squat,l:leg_press,l:pullup,l:deadlift,l:hip_thrust,l:ohp,l:barbell_curl"', 'цель «Гибрид», в списке — восемь движений целей (пункт 8, 24 ноября 2026), первое — жим лежа')
      + expect('r[0].startsWith("Жим лежа") && r[0].includes("сила по запасу")', 'понедельник начинается с жима лежа на силу по запасу')
      + expect('!' + draftRows + '.flat().some(t => t.includes("поддержание"))', 'остальные базовые по умолчанию — как подсобка, без поддержания (вывод 5 аудита)')
      + expect('r[2].startsWith("Жим лежа — лёгкий день")', 'пятница начинается с лёгкого дня жима')
      + expect('document.getElementById("view").textContent.includes("Подтягивания") && !!document.getElementById("po-grow")', 'подтягивания в программе, есть переключатель «Остальные базовые»')
      + expect('![...document.querySelectorAll("#view .pday")].some(g => g.textContent.includes("undefined"))', 'в днях программы нет «undefined»')],
    /* в заметке «Новое …: лёгкий день» стоит «undefined × 8–12» — ошибка текста, которая есть и в артефакте (эталонный вывод test_prog); новых таких строк правило о базовых не добавляет */
    ['что изменилось и почему', click('#prog-why > summary') + settle + expect('document.getElementById("prog-why").textContent.includes("Базовые — первыми в своих днях: Жим лежа (день 1)") && !document.getElementById("prog-why").textContent.includes("Жим ногами (день 2)")', 'заметка о базовых: по проценту — только жим лежа, остальные базовые — как подсобка (вывод 5 аудита)')
      + expect('!document.getElementById("prog-why").textContent.includes("undefined")', 'в заметках нет «undefined»: строки артефакта «лёгкий день — undefined × 8–12» в приложении нет')],
    ['принять программу', click('#prog-accept') + settle + expect('document.getElementById("toast").textContent.startsWith("Программа принята")', 'сообщение «Программа принята»')
      + 'const d = JSON.parse(' + stored + ');' + expect('d.length === 1 && d[0][0] === "config/main" && Object.keys(d[0][1].ex).length === 64 && d[0][1].program.focus === "bench" && d[0][1].ex.bench.goal === "auto" && d[0][1].gear.g_pullup.step === 1',
        'в хранилище одна запись: настройка со справочником, лёгким днём, снарядом «Подтягивания» и программой вокруг жима лежа')],
    ['обзор: первая тренировка по программе', go('overview') + settle + expect('document.getElementById("view").textContent.includes("Первая тренировка")', 'карточка «Первая тренировка»')],
    ['известный максимум жима ногами', go('setup') + settle + type('#kw-max-leg_press', 200) + settle + expect('document.getElementById("kw-out-leg_press").textContent.includes("(от максимума 200)")', 'стартовый вес считается от названного максимума: жим ногами в «Гибриде» — как подсобка, по повторам (вывод 5 аудита)')],
    ['план', go('workout') + settle + expect('document.getElementById("view").textContent.includes("Начать тренировку")', 'план первой тренировки')],
    ['старт', press('Начать тренировку')],
    ['подходы', clickAll('.cyc-sets button') + typeAll('input[id^="w-"]', 20) + typeAll('input[id^="r-"]', 10)],
    ['завершить', FINISH],
    ['журнал: одна запись', go('journal') + settle + journal(1)],
    ...APP_TABS.filter(v => v !== 'journal').map(v => opens(v, 'после первой тренировки')),
    ['после перезагрузки записи на месте', RELOAD],
    ['журнал после перезагрузки', go('journal') + settle + journal(1)],
    ['справочник после перезагрузки тот же', go('setup') + settle + expect(chips + ' === 63', '63 упражнения на снарядах') + expect(looseN + ' === "0"', '«без снаряда» пусто')]
  ] },

  { name: 'мышцы', steps: [
    ['мышцы', go('muscles')],
    ['на теле: по программе', click('#bm-plan')],
    ['на теле: по факту', click('#bm-fact')],
    /* с днями «День N» фигура — одна карточка, которая переворачивается (просьба владельца, 26 ноября 2026); у эталона двух фигур кнопки нет */
    ['фигура: вид сзади', maybe(click('.bm-flip'))],
    ['мышца на фигуре', click('path.bm', 6)],
    ['та же мышца: выбор снят', click('path.bm', 6)],
    ['мышца по подписи', click('text.bm-t', 3)],
    ['мышца с клавиатуры', key('path.bm[tabindex="0"]', 'Enter', 9)],
    ['мышца вне расчёта', click('text.bm-t', 4)],
    ['фигура: снова вид спереди', maybe(click('.bodymap.flip'))],
    ['ячейка недели', click('table.heat button.hc', 7)],
    ['другая ячейка', click('table.heat button.hc', 60)],
    ['ячейка первой недели', click('table.heat button.hc', 0)],
    ['на чём основаны оценки', click('details.card > summary')],
    ['большой экран', size(...BIG)],
    ['после перезагрузки выбор сброшен', RELOAD]
  ] },

  { name: 'программа: сборка', steps: [
    ['программа', go('program')],
    ['что изменилось и почему', maybe(click('#prog-why > summary'))],
    ['вручную', mode('manual')],
    ['равномерно', mode('even')],
    ['приоритет: первая группа', mode({ prio: 0 })],
    ['приоритет: вторая группа', mode({ prio: 1 })],
    ['пауэрбилдинг: первое базовое', mode({ lift: 0 })],
    ['остальные базовые растут', click('#po-grow')],
    ['остальные базовые на поддержании', maybe(click('#po-hold'))],   // с днями «День N» «Поддержания» в выборе нет (решение владельца, 25 ноября 2026)
    ['пауэрбилдинг: последнее базовое', mode({ lift: -1 })],
    ['лимит недели: самый малый', maybe(pickAt('#pb-budget', 0))],                     // с днями «День N» списка «Подходов в неделю» нет (просьба владельца, 25 ноября 2026)
    ['лимит недели: 70', maybe(pick('#pb-budget', 70))],
    ['равномерно при лимите 70', mode('even')],
    ['лимит недели: свой', maybe(pickAt('#pb-budget', -1))],
    ['отдых 2 минуты', maybe(pick('#prog-rest', 120))],
    ['большой экран', size(...BIG)],
    ['пауэрбилдинг на большом экране', mode({ lift: -2 })]
  ] },

  { name: 'программа: правка и принятие', steps: [
    ['программа', go('program')],
    ['прибавить подход мышце', click('button[id^="mp-"]')],
    ['убавить подход другой', click('button[id^="mn-"]', 3)],
    ['прибавить икрам: они вне расчёта', click('#mp-calves')],
    ['прибавить прессу', click('#mp-abs')],
    ['сбросить правки', click('#prog-reset')],
    /* с днями «День N» у программы, которую собрал дневник, только «Заменить» (решение владельца, 25 ноября 2026): эти кнопки есть только при сверке с эталоном и в «Вручную» */
    ['больше подходов в упражнении', maybe(click('button[aria-label^="Больше подходов"]', 1))],
    ['меньше подходов в упражнении', maybe(click('button[aria-label^="Меньше подходов"]', 2))],
    ['упражнение выше', maybe(click('button[aria-label^="Переместить выше"]', 1))],
    ['убрать из программы', maybe(click('button[aria-label^="Убрать из программы"]'))],
    ['добавить в понедельник', maybe(pickAt('#pa-mon', 0) + click('#pb-mon'))],
    /* замена: у эталона — ссылка «заменить» и список, с днями «День N» — кнопка «Заменить» и упражнения под ней; первое в списке — то же */
    ['замена: открыть список', click(SWAP)],
    ['замена: отмена', press('Отмена')],
    ['замена: открыть у другого', click(SWAP, 1)],
    ['замена: выбрать', ifAny('select[id$="-to"]', pickAt('select[id$="-to"]', 1)) + ' else { ' + click('#view .swaprow .ex-card') + ' }'],
    ['принять программу', click('#prog-accept')],
    ['обзор после принятия', go('overview')],
    ['план по новой программе', go('workout')],
    ['мышцы по новой программе', go('muscles') + settle + click('#bm-plan')],
    ['вернуть прежнюю', go('program') + settle + click('#prog-undo')],
    ['вручную: название и правка', mode('manual') + settle + type('#prog-name', 'Моя программа') + click('button[aria-label^="Больше подходов"]')],
    ['вручную: принять', click('#prog-accept')],
    ['тренировка по программе: старт', go('workout') + settle + press('Начать тренировку')],
    ['ввод', type('input[id^="r-"]', 10) + type('input[id^="r-"]', 9, 1) + type('input[id^="r-"]', 8, 2)],
    ['завершить', press('Завершить тренировку') + settle + press('Завершить')],
    ['программа после первой тренировки по ней', go('program')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'прогресс', steps: [
    ['прогресс', go('progress')],
    ['все упражнения', press('Все')],
    ['только из программы', press('В программе')],
    ['второе упражнение', click('.ex-grid button.ex-card', 1)],
    ['график: максимум', press('Максимум')],
    ['вся история', maybe(click('#ex-detail > button.btn.ghost.sm'))],
    ['свернуть историю', maybe(press('Свернуть'))],
    ['пятое упражнение', click('.ex-grid button.ex-card', 4)],
    ['график: рабочий вес', press('Рабочий вес')],
    ['подсказка на графике: указатель', point('#ex-detail svg rect[tabindex]', 'pointermove', 0, 0.3, 0.5)],
    ['подсказка: стрелка влево', key('#ex-detail svg rect[tabindex]', 'ArrowLeft')],
    ['подсказка: убрать', point('#ex-detail svg rect[tabindex]', 'pointerleave')],
    ['подсказка у столбца недели', point('.chart svg g[tabindex]', 'pointerenter', 3)],
    ['вес тела: не число', type('#bw-kg', 'abc') + press('Записать')],
    ['вес тела: записать', type('#bw-kg', '75,2') + press('Записать')],
    ['вес тела: неделю назад', typeDay('#bw-date', -7) + type('#bw-kg', '74.8') + press('Записать')],
    ['вес тела: две недели назад', typeDay('#bw-date', -14) + type('#bw-kg', '74.5') + press('Записать')],
    ['вес тела: удалить запись', click('button[aria-label^="Удалить запись"]', 1)],
    ['советы с весом тела', maybe(tab('coach'))],
    ['большой экран', size(...BIG)],
    ['прогресс на большом экране', fromCoach(go('progress'))],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'настройка: упражнения и снаряды', steps: [
    ['настройка', go('setup')],
    ['новое упражнение: форма', click('#ex-new')],
    ['без названия', click('#nx-save')],
    ['знакомое название', type('#nx-n', 'Тяга к лицу на блоке') + click('#nx-save')],
    ['то же название ещё раз', click('#ex-new') + settle + type('#nx-n', 'тяга к лицу на блоке') + click('#nx-save')],
    ['незнакомое название: нужны мышцы', type('#nx-n', 'Фермерская прогулка') + pickAt('#nx-gear', 1) + click('#nx-save')],
    ['мышцы не отмечены', click('#nx-save')],
    ['мышцы отмечены', pick('#nx-m-forearms', '1') + pick('#nx-m-upper_back', '0.5') + click('#nx-save')],
    ['название и клавиша Enter', click('#ex-new') + settle + type('#nx-n', 'Подъём на носки стоя') + key('#nx-n', 'Enter')],
    ['форма: открыть снова', click('#ex-new')],
    ['форма: отмена', press('Отмена')],
    /* кнопки «+ Снаряд» в приложении нет (решение владельца, 23 ноября 2026): шаг меняется у снарядов, которые есть, а свой снаряд есть только в записях неделей позже */
    ['шаг второго снаряда', type('input[id^="gear-step-"]', '4', 1)],
    ['шаг: ноль не годится', type('input[id^="gear-step-"]', '0')],
    ['шаг первого снаряда', type('input[id^="gear-step-"]', '1,25')],
    ['упражнение на другой снаряд', pickAt('select[id^="gear-add-"]', 0, 1) + click('button[id^="gear-btn-"]', 1)],
    ['убрать упражнение со снаряда', click('button[aria-label^="Убрать со снаряда"]')],
    ['упражнение без снаряда — на снаряд', maybe(pickAt('select.chip-sel', 1))],
    ['свой снаряд: название', maybe(type('input.gear-n', 'Пояс'))],
    ['убрать свой снаряд', maybe(click('button[id^="gear-del-"]'))],
    ['известные веса: рабочий вес', type('input[id^="kw-work-"]', '40')],
    ['известные веса: повторы', type('input[id^="kw-workR-"]', '10')],
    ['известные веса: максимум у другого', type('input[id^="kw-max-"]', '62,5', 1)],
    ['известные веса: не число', type('input[id^="kw-max-"]', 'abc')],
    ['известные веса: убрать', type('input[id^="kw-work-"]', '')],
    ['остальные упражнения', maybe(click('#known details > summary'))],
    ['план после настройки', go('workout')],
    ['программа после настройки', go('program')],
    ['после перезагрузки то же', RELOAD]
  ] },

  { name: 'настройка: остальное', steps: [
    ['настройка', go('setup')],
    ['раскрыть остальные настройки', click('#setup-more > summary')],
    ['имя профиля', type('#pr-n-p2', 'Гость')],
    ['новый профиль без имени', click('#pr-add')],
    ['новый профиль с упражнениями', type('#pr-new', 'Гость') + click('#pr-add')],
    ['обзор нового профиля', go('overview')],
    ['настройка нового профиля', go('setup')],
    ['открыть свой дневник кнопкой', press('Открыть')],
    ['справочник: изменить', press('Изменить', 2)],
    ['справочник: без названия', type('input[id^="xf-"][id$="-n"]', '') + press('Сохранить упражнение')],
    ['справочник: сохранить', type('input[id^="xf-"][id$="-n"]', 'Новое имя') + pickAt('select[id$="-mode"]', 1) + pickAt('select[id$="-pat"]', 2) + pickAt('select[id$="-gear"]', 2) + type('input[id$="-lo"]', 6) + type('input[id$="-hi"]', 10)
      + click('input[id$="-uni"]') + pickAt('select[id$="-m-chest"]', 2) + press('Сохранить упражнение')],
    ['справочник: открыть другое', press('Изменить', 4)],
    ['справочник: отмена', press('Отмена')],
    ['данные: скачать таблицу', press('Скачать CSV')],
    ['данные: скопировать таблицу', press('Скопировать CSV')],
    ['данные: резервная копия', click('#backup-all')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* свои лимиты и методика, сохранённые в настройке профиля: границы зон 5 / 9 / 18, лимиты 9 и 60, отдых 2,5 минуты, запас 2, вес тела «просто записываю»,
     предплечья вне расчёта, икры в расчёте, волна 75% × 5 подходов с прибавкой 2,5%, счёт недель с 1 сентября.
     На экране приложения их больше не задать, но в записях они остаются настройкой профиля: каждая вкладка считает по ним так же, как эталон */
  { name: 'свои лимиты и методика из записей', data: 'tuned', steps: [
    ...tabs('со своими лимитами'),
    ['программа: пауэрбилдинг при своих лимитах', go('program') + settle + mode({ lift: -1 })],
    ['лимит недели: самый малый', maybe(pickAt('#pb-budget', 0))],
    ['равномерно', mode('even')],
    ['план понедельника', go('workout') + settle + press('Понедельник')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* запас, вписанный в старую запись: журнал, план того же дня и объём по мышцам считают его (подход с запасом от 3 — за половину) */
  { name: 'журнал: запас в старой записи', steps: [
    ['журнал', go('journal')],
    ['правка записи', press('Изменить')],
    ['запас в базовом', maybe(typeAll('input[id^="cq-"]', 3))],
    ['запас в подсобке', type('input[id^="q-"]', 3) + type('input[id^="q-"]', 0, 2) + type('input[id^="q-"]', 0, 4) + type('input[id^="q-"]', 4, 5)],
    ['сохранить', press('Сохранить изменения')],
    ['план понедельника', go('workout') + settle + press('Понедельник')],
    ['план среды', press('Среда')],
    ['план пятницы', press('Пятница')],
    ['объём по мышцам', go('muscles')],
    ['ячейка последней недели', click('table.heat tr:nth-child(2) button.hc', -1)],
    ['ячейка предпоследней недели', click('table.heat tr:nth-child(2) button.hc', -2)],
    ['советы', maybe(tab('coach'))],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* пауэрбилдинг: программа вокруг жима лежа, три недели по ней. Запас в подходах базовых решает вес следующей недели:
     2 и больше — плюс шаг, 1 — тот же вес, 0 — минус 5%; потом неделя с недобором повторов */
  { name: 'пауэрбилдинг: недели по программе', steps: [
    ['программа', 'sessionStorage.clear();' + go('program')],
    ['пауэрбилдинг: жим лежа', mode('l:bench')],
    ['принять', click('#prog-accept')],
    ['обзор', go('overview')],
    ...week(1, 2),
    ['программа после первой недели', go('program')],
    ...week(2, 1, null, mark('запас 2 в последнем подходе: плюс шаг', 'up')),
    ['неделя 2: вес повышен после запаса 2', go('overview') + settle + seenW('up', 'bench', 'на второй неделе карточка базового говорит «запас 2 в последнем подходе: плюс шаг»')],
    ...week(3, 0, null, mark('запас 1 в последнем подходе: вес тот же', 'hold')),
    ['неделя 3: вес тот же после запаса 1', go('progress') + settle + seenW('hold', 'bench', 'на третьей неделе карточка базового говорит «запас 1 в последнем подходе: вес тот же»')],
    ...week(4, null, 2, mark('подход шёл в отказ: вес −', 'fail')),
    ['неделя 4: вес снижен после запаса 0', go('overview') + settle + seenW('fail', 'bench', 'на четвёртой неделе карточка базового говорит «подход шёл в отказ: вес −5%»')],
    ...week(5, 2, null, mark('подходы не закрыты: вес −', 'short')),
    ['неделя 5: вес снижен после недобора', go('overview') + settle + seenW('short', 'bench', 'на пятой неделе карточка базового говорит «подходы не закрыты: вес −5%»')],
    ['прогресс жима', click('button.ex-card')],
    ['мышцы', go('muscles')],
    ['советы', maybe(tab('coach'))],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* только в приложении: «Сила: пауэрлифтерская тройка» (решение владельца, 24 ноября 2026, пункт 8): приседания, жим лежа и становая тяга — каждое два дня
     в неделю, тяжёлый день 3 × 4 по запасу и лёгкий 3 × 8 на 75% («Новая схема», 24 ноября 2026), в каждом дне один тяжёлый и один лёгкий; движения, которого нет в справочнике, сборка
     берёт из встроенного; остальные базовые — обычные упражнения, подсобка ниже рабочей зоны. Сборка, заметки, принятие, две недели по программе:
     вес движения, которого ещё нет в журнале, атлет вводит сам */
  { name: 'сила: пауэрлифтерская тройка — сборка и недели по программе', app: true, steps: [
    ['среди целей есть «Сила»', 'sessionStorage.clear();' + go('program') + settle
      + expect(goals + ' === "Масса,Сила,Гибрид,Вручную"', 'цель «Сила» стоит между массой и гибридом')],
    ['сила: пауэрлифтерская тройка', mode('p') + settle + expect(noPicks + ' && ' + capOf + ' === 80', 'списков «Подходов в неделю» и отдыха нет, лимит недели — 80')
      + expect(goalIs('force') + ' && ' + listIs('ps', 'p') + ' && document.getElementById("ps").selectedOptions[0].textContent === "Пауэрлифтерская тройка"', 'цель «Сила», в уточняющем списке выбрана тройка')
      + expect(progTitle + ' === "Сила: пауэрлифтерская тройка"', 'название новой программы') + 'const r = ' + draftRows + ';'
      + expect(TRIAD_DAYS, 'каждое движение тройки — один тяжёлый день по запасу и один лёгкий; день начинается тяжёлым днём одного движения, за ним — лёгкий день другого')
      + expect('!r.flat().some(t => t.includes("поддержание") || (t.includes("сила по запасу") && !/^(Приседания со штангой|Жим лежа|Становая тяга)/.test(t)))', 'остальные базовые — обычные упражнения: ни поддержания, ни силы по запасу')
      + expect('!document.getElementById("po-grow")', 'переключателя «Остальные базовые» нет')],
    ['что изменилось и почему', click('#prog-why > summary') + settle + 'const t = document.getElementById("prog-why").textContent;'
      + expect('t.includes("Тройка: Приседания со штангой, Жим лежа и Становая тяга — каждое два раза в неделю") && t.includes("Тяжёлый день — 3 × 4 одним весом") && t.includes("Лёгкий день — 3 × 8 на 75%") && t.includes("Всего 6 подходов движения в неделю")', 'заметка о тройке: тяжёлый день 3 × 4, лёгкий 3 × 8, шесть подходов движения')
      + expect('t.includes("Становая тяга — в программу в день") && t.includes("В программе этого движения не было. Оно в тройке")', 'становой в справочнике нет: сборка поставила её сама и сказала об этом')
      + expect('t.includes("Подсобка — ") && t.includes("в 8 подходов в неделю вместо 10") && t.includes("Точные повторы — правило дневника")', 'заметка о подсобке и честное «правило дневника»: точные повторы — не вывод исследования')
      + expect('!t.includes("undefined")', 'в заметках нет «undefined»')],
    ['прибавить подход мышце под «Силой»', click('#mp-biceps') + settle + expect('document.getElementById("toast").textContent.length > 0', 'дневник ответил, что сделал или почему не может')],
    ['сбросить правки', maybe(click('#prog-reset'))],
    ['принять программу', click('#prog-accept') + settle + expect('document.getElementById("toast").textContent.startsWith("Программа принята")', 'сообщение «Программа принята»')
      + 'const c = JSON.parse(' + stored + ').find(x => x[0] === "config/main")[1];'
      + expect('c.program.strength === true && c.program.lean === true && c.program.budget === 80 && !c.program.focus && JSON.stringify(c.program.triad) === \'["squat","bench","deadlift"]\'', 'в записи программы: тройка, скромные поправки, лимит 80, без приоритета')
      + expect('["squat", "bench", "deadlift"].every(id => c.ex[id] && c.ex[id].goal === "auto" && c.ex[id + "_light"] && c.ex[id + "_light"].of === id) && c.ex.deadlift.gear === "barbell"', 'становая — в справочнике, на штанге; у каждого движения тройки — сила по запасу и свой лёгкий день')
      + expect('c.ex.leg_press.mode === "cycle" && c.ex.pullup.mode === "cycle"', 'справочник не переписан: роль базового — в программе, жим ногами и подтягивания в нём по-прежнему базовые')],
    ['действует сейчас: сказано про тройку', expect('document.querySelector("#view section.card").textContent.includes("Сила в тройке: приседания со штангой, жим лежа и становая тяга — каждое два раза в неделю, остальные базовые — обычные упражнения")', 'строка о тройке в «Действует сейчас»')
      + expect(goalIs('force') + ' && ' + listIs('ps', 'p'), 'выбрана цель «Сила», тройка')],
    ['обзор', go('overview')],
    ...week(1, 2, null, NEW_W),
    ['программа после первой недели', go('program') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 'p'), 'цель по-прежнему «Сила», тройка')],
    ...week(2, 1, null, NEW_W + mark('запас 2 в последнем подходе: плюс шаг', 'up')),
    ['неделя 2: вес повышен после запаса 2', go('overview') + settle + seenW('up', 'bench', 'на второй неделе карточка движения говорит «запас 2 в последнем подходе: плюс шаг»')],
    ['мышцы: сила и масса', go('muscles') + settle + expect('[...document.querySelectorAll("[id^=mavg-]")].some(e => /масса [\\d.,]+ · сила [\\d.,]+/.test(e.textContent))', 'у среднего объёма мышцы видна разбивка «масса … · сила …»')],
    ['после перезагрузки то же', RELOAD],
    ['программа после перезагрузки', go('program') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 'p') + ' && document.querySelector("#view section.card").textContent.includes("Сила в тройке")', 'тройка на месте после перезагрузки')]
  ] },

  /* только в приложении: «Сила» в одном движении (решения владельца, 19 и 24 ноября 2026, пункт 8) — оно идёт три дня в неделю: тяжёлый день 3 × 4 по запасу,
     за ним лёгкий 3 × 8 и средний 3 × 6 — первыми в остальных тренировках («Новая схема», 24 ноября 2026); мышцам цели — в полтора раза больше подходов;
     остальные базовые — обычные упражнения, переключателя «Остальные базовые» нет, дня «на массу» нет, подсобка ниже рабочей зоны. У изоляции дня два:
     3 × 6 и лёгкий 3 × 10. Сборка, заметки, принятие, две недели по программе */
  { name: 'сила в одном движении: сборка и недели по программе', app: true, steps: [
    ['сила: жим лежа', 'sessionStorage.clear();' + go('program') + settle + mode('s:bench') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench') + ' && ' + capOf + ' === 80', 'цель «Сила», в списке — жим лежа, лимит недели 80')
      + expect(progTitle + ' === "Сила: жим лежа"', 'название новой программы') + 'const r = ' + draftRows + ';'
      + expect('r[0][0].startsWith("Жим лежа") && !r[0][0].startsWith("Жим лежа — лёгкий день") && r[0][0].includes("сила по запасу")', 'день 1 начинается с жима лежа на силу по запасу')
      + expect('r[2][0].startsWith("Жим лежа — лёгкий день") && !r[1][0].startsWith("Жим лежа")', 'день 3 начинается с лёгкого дня жима, в дне 2 жима нет: два дня, тяжёлый и лёгкий (выводы аудита)')
      + expect('r.flat().filter(t => t.includes("лёгкий день")).length === 1 && !r.flat().some(t => t.includes("средний день")) && !r.flat().some(t => t.includes("поддержание") || (t.includes("сила по запасу") && !t.startsWith("Жим лежа")))', 'лёгкий день — один, среднего нет; остальные базовые — обычные упражнения')
      + expect('!document.getElementById("po-grow")', 'переключателя «Остальные базовые» под «Силой» нет')],
    ['что изменилось и почему', click('#prog-why > summary') + settle + 'const t = document.getElementById("prog-why").textContent;'
      + expect('t.includes("Сила: Жим лежа — два раза в неделю") && t.includes("Тяжёлый день — в день 1: 3 × 4") && t.includes("Лёгкий день — в день 3: 3 × 8 на 75%.") && t.includes("Всего 6 подходов движения в неделю")', 'заметка о трёх днях: тяжёлый, лёгкий и средний')
      + expect('t.includes("по исследованиям прибавка силы от подходов самого движения быстро затухает") && t.includes("Точные повторы — правило дневника") && t.includes("Дня «на массу», как в «Гибриде», здесь нет")', 'честно сказано, что из исследований, а что правило дневника')
      + expect('t.includes("Мышцы цели (грудь) получают примерно в полтора раза больше остальных") && t.includes("в 8 подходов в неделю вместо 10")', 'мышцам цели — в полтора раза больше, подсобка — ниже рабочей зоны')
      + expect('/(Жим ногами|Подтягивания)[^.]* — по двойной прогрессии/.test(t) && t.includes("Под «Силой» по проценту идёт только цель")', 'сказано, что остальные базовые — обычные многосуставные')
      + expect('!t.includes("undefined")', 'в заметках нет «undefined»')],
    ['изоляция: бицепс со штангой — два дня, 3 × 6', mode('s:barbell_curl') + settle + 'const r = ' + draftRows + ';'
      + expect('r.flat().filter(t => t.startsWith("Бицепс со штангой стоя — лёгкий день")).length === 1 && r.flat().filter(t => t.startsWith("Бицепс со штангой стоя") && t.includes("сила по запасу")).length === 1', 'у изоляции дня два: тяжёлый по запасу и лёгкий')
      + expect(progNote + '.startsWith("Сила в одном движении. Оно идёт два дня из трёх: тяжёлый день 3 × 6 с весом по запасу и лёгкий день.")', 'пояснение режима: два дня из трёх, 3 × 6')],
    ['снова жим лежа', mode('s:bench') + settle + expect(listIs('ps', 's:bench') + ' && ' + progTitle + ' === "Сила: жим лежа"', 'выбран жим лежа')],
    ['принять программу', click('#prog-accept') + settle + expect('document.getElementById("toast").textContent.startsWith("Программа принята")', 'сообщение «Программа принята»')
      + 'const c = JSON.parse(' + stored + ').find(x => x[0] === "config/main")[1];'
      + expect('c.program.strength === true && c.program.lean === true && c.program.budget === 80 && c.program.focus === "bench" && !c.program.triad', 'в записи программы: сила, цель — жим лежа, скромные поправки, лимит 80')
      + expect('c.ex.bench.goal === "auto" && c.ex.bench_light && c.ex.bench_light.of === "bench" && !c.ex.bench_mid && c.ex.leg_press.mode === "cycle" && c.ex.pullup.mode === "cycle"', 'жим — на силе по запасу, с лёгким днём, среднего нет; остальные базовые в справочнике — как были')
      + expect('["mon", "wed", "fri"].map(d => c.program.slots[d].filter(e => e.ex === "bench_light").length + ":" + c.program.slots[d].filter(e => e.ex === "bench_mid").length).join() === "0:0,0:0,1:0" && !["mon", "wed", "fri"].some(d => c.program.slots[d].some(e => e.ex === "leg_press_light" || e.ex === "pullup_light"))', 'лёгкий день записан в третий день, среднего нет; у остальных базовых таких дней в программе нет')],
    ['действует сейчас: сказано про силу в одном движении', expect('document.querySelector("#view section.card").textContent.includes("Сила: «Жим лежа». Оно идёт два дня из трёх — тяжёлый день и лёгкий; остальные базовые — обычные упражнения")', 'строка о режиме в «Действует сейчас»')
      + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench'), 'выбрана цель «Сила», жим лежа')],
    ['обзор', go('overview')],
    ...week(1, 2),
    ['программа после первой недели', go('program') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench'), 'цель по-прежнему «Сила», жим лежа')],
    ['журнал: за неделю — тяжёлый и лёгкий день жима', go('journal') + settle + expect('[...document.querySelectorAll(".wo")].slice(0, 3).map(w => (w.textContent.includes("Жим лежа — лёгкий день") ? "л" : "") + (w.textContent.includes("Жим лежа — средний день") ? "с" : "")).sort().join() === ",,л"', 'в трёх последних тренировках — один лёгкий день жима, среднего нет (выводы аудита)')],
    ...week(2, 1, null, mark('запас 2 в последнем подходе: плюс шаг', 'up')),
    ['неделя 2: вес повышен после запаса 2', go('overview') + settle + seenW('up', 'bench', 'на второй неделе карточка базового говорит «запас 2 в последнем подходе: плюс шаг»')],
    ['мышцы: сила и масса', go('muscles') + settle + expect('[...document.querySelectorAll("[id^=mavg-]")].some(e => /масса [\\d.,]+ · сила [\\d.,]+/.test(e.textContent))', 'у среднего объёма мышцы видна разбивка «масса … · сила …»')],
    ['после перезагрузки то же', RELOAD],
    ['программа после перезагрузки', go('program') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench') + ' && document.querySelector("#view section.card").textContent.includes("Сила: «Жим лежа»")', 'режим на месте после перезагрузки')]
  ] },

  /* только в приложении: «Сила» → «Становая тяга» (решение владельца, 24 ноября 2026, пункт 8). Становой в справочнике нет: сборка берёт её из встроенного
     вместе со снарядом и ставит тяжёлый день первым в день без другого базового, лёгкий и средний — первыми в остальные; мышцам цели — в полтора раза больше.
     После «Принять» становая — в справочнике, на штанге, а роль базового — в программе. Первая тренировка: вес вводит атлет; дальше лёгкий и средний день
     идут от её расчётного максимума, а вес тяжёлого дня решает запас в последнем подходе */
  { name: 'сила: становая тяга — цели нет в справочнике', data: 'seed', app: true, steps: [
    ['сила: в списке — тройка и восемь движений', go('program') + settle + click('#pg-force') + settle
      + expect(listOf('ps') + ' === "p,s:bench,s:squat,s:leg_press,s:pullup,s:deadlift,s:hip_thrust,s:ohp,s:barbell_curl" && ' + listIs('ps', 'p'), 'в списке «Силы» — тройка и восемь движений, по кнопке выбрана тройка')
      + expect('[...document.getElementById("ps").options].map(o => o.textContent).join("|") === "Пауэрлифтерская тройка|Жим лежа|Приседания со штангой|Жим ногами|Подтягивания|Становая тяга|Ягодичный мост со штангой|Жим штанги стоя|Бицепс со штангой стоя"', 'названия: того, чего в справочнике нет, — по встроенному')],
    ['выбрать становую тягу', pick('#ps', 's:deadlift') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:deadlift') + ' && ' + capOf + ' === 80 && ' + progTitle + ' === "Сила: становая тяга"', 'цель «Сила», становая тяга, лимит 80')
      + 'const r = ' + draftRows + ';'
      + expect('r[1][0].startsWith("Становая тяга") && r[1][0].includes("сила по запасу") && r[0][0].startsWith("Становая тяга — лёгкий день") && !r.flat().some(t => t.includes("средний день"))', 'тяжёлый день — первым в день 2, лёгкий — первым в день 1, среднего нет (выводы аудита)')
      + expect('!r.flat().some(t => t.includes("поддержание")) && !document.getElementById("po-grow")', 'остальные базовые — обычные упражнения, переключателя нет')
      + expect(progNote + '.startsWith("Сила в одном движении. Оно идёт два дня из трёх: тяжёлый день 3 × 4 с весом по запасу и лёгкий день.")', 'пояснение режима')],
    ['что изменилось и почему', click('#prog-why > summary') + settle + 'const t = document.getElementById("prog-why").textContent;'
      + expect('t.includes("Становая тяга — в программу в день 2") && t.includes("В программе этого упражнения не было. Оно — цель программы")', 'становой не было: сборка поставила её первой в день без другого базового')
      + expect('t.includes("Сила: Становая тяга — два раза в неделю") && t.includes("Мышцы цели — от 12 до 13, остальные — от 8 до 10 подходов в неделю") && t.includes("Мышцы цели (бицепс бедра и ягодицы)")', 'мышцам цели — в полтора раза больше остальных')
      + expect('t.includes("Жим лежа, Жим ногами и Подтягивания — по двойной прогрессии")', 'остальные базовые — обычные многосуставные')
      + expect('!t.includes("undefined")', 'в заметках нет «undefined»')],
    ['принять программу', click('#prog-accept') + settle + accepted + 'const c = ' + cfgMain + ';'
      + expect('c.ex.deadlift && c.ex.deadlift.n === "Становая тяга" && c.ex.deadlift.gear === "barbell" && c.ex.deadlift.goal === "auto" && !c.ex.deadlift.mode && c.ex.deadlift_light && c.ex.deadlift_light.of === "deadlift" && !c.ex.deadlift_mid', 'становая — в справочнике, на штанге, с силой по запасу и лёгким днём; среднего дня нет (выводы аудита); роль базового — в программе, а не в справочнике')
      + expect('c.program.strength === true && c.program.focus === "deadlift" && c.program.budget === 80 && !c.program.triad', 'в записи программы: сила, цель — становая, лимит 80')
      + expect('c.ex.bench.mode === "cycle" && c.ex.leg_press.mode === "cycle" && c.ex.pullup.mode === "cycle"', 'остальные базовые в справочнике — как были')
      + expect('document.querySelector("#view section.card").textContent.includes("Сила: «Становая тяга». Оно идёт два дня из трёх — тяжёлый день и лёгкий")', 'строка о программе в «Действует сейчас»')],
    ['день 2: план — становая первой, веса ещё нет', go('workout') + settle + press('Среда') + settle + typeDay('#np-date', 0) + settle
      + expect('document.querySelector("#view").innerText.includes("Становая тяга") && document.querySelector("#view").innerText.includes("Основа — программа «Сила: становая тяга»")', 'план дня 2 — по принятой программе, со становой')],
    ['день 2: старт', press('Начать тренировку') + settle + expect('!!document.getElementById("cw-deadlift") && document.getElementById("cw-deadlift").value === ""', 'вес становой не задан: её нет в журнале')],
    ['день 2: вес становой и подходы', type('#cw-deadlift', 120) + settle + clickAll('.cyc-sets button') + typeAll('input[id^="cq-"]', 2) + typeAll('input[id^="r-"]', 10)],
    ['день 2: завершить', FINISH],
    ['журнал: становая записана', go('journal') + settle + journal(25) + expect('[...document.querySelectorAll(".wo")].some(w => w.textContent.includes("Становая тяга") && w.textContent.includes("120"))', 'в журнале — тренировка со становой 120 кг')],
    ['день 3: становой нет — у неё два дня, тяжёлый и лёгкий', go('workout') + settle + press('Пятница') + settle + typeDay('#np-date', 2) + settle
      + expect('!document.querySelector("#view").innerText.includes("Становая тяга") && document.querySelector("#view").innerText.includes("Основа — программа «Сила: становая тяга»")', 'в дне 3 становой нет: «Сила: <движение>» — два дня (выводы аудита, 25 ноября 2026)')],
    ['день 1: лёгкий день становой — от её максимума', press('Понедельник') + settle + typeDay('#np-date', 5) + settle
      + expect('document.querySelector("#view").innerText.includes("Становая тяга — лёгкий день") && document.querySelector("#view").innerText.includes("3 × 6 по 115 кг")', 'лёгкий день становой — 3 × 6 на 79% от 144.6 кг: 115 кг, легче тяжёлого дня, хотя легче 120 кг становую ещё не записывали')],
    ['неделя 2, день 2: вес решает запас', press('Среда') + settle + typeDay('#np-date', 7) + settle + press('Начать тренировку') + settle
      /* пояснения о прошлом разе в идущей тренировке нет (просьба владельца, 26 ноября 2026): правило видно по весу */
      + expect('document.getElementById("cw-deadlift").value === "122.5" && !document.querySelector("#view").innerText.includes("прошлый раз")', 'после запаса 2 — плюс шаг штанги: 122.5 кг, без пояснения о прошлом разе')]
  ] },

  /* только в приложении: выбор сценария сборки — кнопки цели и один уточняющий список, который зависит от цели.
     Выбор под целью запоминается; нажатие на уже выбранную цель правок не сбрасывает; лимит недели после силового режима возвращается;
     на узком и на большом экране страница не шире экрана; у профиля без базовых целей «Сила» и «Гибрид» нет */
  { name: 'программа: цель и уточняющий список', data: 'seed', app: true, steps: [
    ['программа: масса, всем поровну', go('program') + settle + expect(goals + ' === "Масса,Сила,Гибрид,Вручную"', 'четыре кнопки цели')
      + expect(goalIs('mass') + ' && ' + listIs('pm', 'even') + ' && !document.querySelector("#pl, #ps")', 'по умолчанию — масса, всем поровну; уточняющий список один')
      + expect(listOf('pm') + ' === "even,m:legs,m:glutes,m:upper,m:back,m:chest,m:delts,m:arms"', 'в списке мышц — «всем поровну» и семь групп')
      + expect('[...document.getElementById("pm").options].map(o => o.textContent).join("|") === "Всем поровну|Ноги и ягодицы|Ягодицы|Верх тела|Спина|Грудь и плечи|Плечи|Руки"', 'названия пунктов')
      + expect('!document.getElementById("pf")', 'прежнего списка «Как собрать» нет') + expect(progTitle + ' === "Равномерно на всё тело"', 'название программы')],
    ['масса: плечи в приоритете', pick('#pm', 'm:delts') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:delts'), 'в списке — плечи')
      + expect(progTitle + ' === "Приоритет: плечи"', 'название программы')],
    ['масса: спина в приоритете', pick('#pm', 'm:back') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:back'), 'цель та же, в списке — спина')
      + expect(progTitle + ' === "Приоритет: спина"', 'название программы')],
    ['лимит недели — сам', expect(noPicks + ' && ' + capOf + ' === 100', 'списка «Подходов в неделю» нет: лимит недели — 100, потолок методики')],
    ['гибрид: первая цель', click('#pg-mix') + settle + expect(goalIs('mix') + ' && ' + listOf('pl') + ' === "l:bench,l:squat,l:leg_press,l:pullup,l:deadlift,l:hip_thrust,l:ohp,l:barbell_curl" && ' + listIs('pl', 'l:bench') + ' && !document.querySelector("#pm, #ps")', 'цель «Гибрид»: в списке восемь движений, выбрано первое')
      + expect('[...document.getElementById("pl").options].map(o => o.textContent).join("|") === "Жим лежа|Приседания со штангой|Жим ногами|Подтягивания|Становая тяга|Ягодичный мост со штангой|Жим штанги стоя|Бицепс со штангой стоя"', 'в списке — названия; того, чего в справочнике нет, — по встроенному')
      + expect('!!document.getElementById("po-grow") && ' + capOf + ' === 100', 'есть переключатель «Остальные базовые», лимит прежний')
      + expect(progTitle + ' === "Пауэрбилдинг: жим лежа"', 'название программы')],
    ['гибрид: остальные базовые — как подсобка или растут', expect('document.getElementById("po-plain").getAttribute("aria-pressed") === "true"', 'по умолчанию остальные базовые — «Как подсобка» (вывод 5 аудита)')
      + expect('!document.getElementById("po-hold") && [...document.getElementById("po-plain").parentNode.children].map(b => b.textContent).join() === "Как подсобка,Растут как раньше"', 'вариантов два, «Поддержания» нет (решение владельца, 25 ноября 2026)') + click('#po-grow') + settle
      + expect('document.getElementById("po-grow").getAttribute("aria-pressed") === "true"', 'выбрано «Растут как раньше»')],
    ['гибрид: остальные базовые снова как подсобка', click('#po-plain') + settle + expect('document.getElementById("po-plain").getAttribute("aria-pressed") === "true"', 'снова «Как подсобка»')],
    ['гибрид: другая цель', pick('#pl', 'l:leg_press') + settle + expect(goalIs('mix') + ' && ' + listIs('pl', 'l:leg_press'), 'в списке — жим ногами') + expect(progTitle + ' === "Пауэрбилдинг: жим ногами"', 'название программы')],
    ['обратно к массе: спина на месте', click('#pg-mass') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:back'), 'выбор под целью «Масса» запомнен') + expect(progTitle + ' === "Приоритет: спина"', 'название программы')],
    ['обратно к гибриду: то же базовое', click('#pg-mix') + settle + expect(goalIs('mix') + ' && ' + listIs('pl', 'l:leg_press'), 'выбор под целью «Гибрид» запомнен')],
    ['сила: тройка или одно движение, свой лимит недели', click('#pg-force') + settle + expect(goalIs('force') + ' && ' + listOf('ps') + ' === "p,s:bench,s:squat,s:leg_press,s:pullup,s:deadlift,s:hip_thrust,s:ohp,s:barbell_curl" && ' + listIs('ps', 'p') + ' && !document.querySelector("#pm, #pl") && !document.getElementById("po-grow")', 'цель «Сила»: в списке тройка и восемь движений, выбрана тройка; переключателя остальных базовых нет')
      + expect('[...document.getElementById("ps").options].map(o => o.textContent).join("|") === "Пауэрлифтерская тройка|Жим лежа|Приседания со штангой|Жим ногами|Подтягивания|Становая тяга|Ягодичный мост со штангой|Жим штанги стоя|Бицепс со штангой стоя"', 'названия пунктов')
      + expect(capOf + ' === 80', 'лимит недели — 80, число силового режима') + expect(progTitle + ' === "Сила: пауэрлифтерская тройка"', 'название программы')],
    ['сила в одном движении: жим лежа', pick('#ps', 's:bench') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench') + ' && !document.getElementById("po-grow") && ' + capOf + ' === 80', 'цель та же, в списке — жим лежа; переключателя остальных базовых нет и здесь: под «Силой» они обычные упражнения; лимит тот же')
      + expect(progTitle + ' === "Сила: жим лежа"', 'название программы')],
    ['к гибриду и обратно к силе: базовое на месте', click('#pg-mix') + settle + expect(capOf + ' === 100', 'у гибрида лимит прежний — 100') + click('#pg-force') + settle
      + expect(goalIs('force') + ' && ' + listIs('ps', 's:bench') + ' && ' + capOf + ' === 80', 'выбор под целью «Сила» запомнен, лимит снова 80')],
    ['из силы к массе: лимит недели вернулся', click('#pg-mass') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:back') + ' && ' + capOf + ' === 100', 'лимит снова 100 — лимит профиля')],
    ['правка мышцы', click('#mn-chest') + settle + expect('!!document.getElementById("prog-reset")', 'правка принята: есть «Сбросить правки»')],
    ['нажатие на выбранную цель правку не сбрасывает', click('#pg-mass') + settle + expect('!!document.getElementById("prog-reset") && ' + goalIs('mass') + ' && ' + listIs('pm', 'm:back'), 'черновик с правкой на месте')],
    ['вручную: списка и лимита нет, есть название', click('#pg-hand') + settle + expect(goalIs('hand') + ' && !document.querySelector("#pm, #pl, #ps, #pb-budget") && !!document.getElementById("prog-name")', 'цель «Вручную»: без уточняющего списка и лимита, с полем названия')],
    ['снова масса: спина и лимит на месте', click('#pg-mass') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:back') + ' && ' + capOf + ' === 100', 'выбор и лимит те же')],
    ['узкий телефон: 360', size(360, 740)],
    ['гибрид на узком телефоне', click('#pg-mix') + settle + expect(goalIs('mix') + ' && !!document.getElementById("po-grow")', 'гибрид с переключателем остальных базовых')],
    ['большой экран', size(...BIG)],
    ['сила на большом экране', click('#pg-force') + settle + expect(goalIs('force'), 'цель «Сила»')],
    ['телефон', size(390, 844)],
    ['второй профиль: базовых в справочнике нет, а цели «Силы» и «Гибрида» есть', pick('#prof', 'p2') + settle + go('program') + settle + expect(goals + ' === "Масса,Сила,Гибрид,Вручную"', 'роль базового задаёт цель: «Сила» и «Гибрид» есть и без базовых в справочнике')
      + expect(goalIs('mass') + ' && ' + listOf('pm') + ' === "even,m:legs,m:glutes,m:upper,m:back,m:chest,m:delts,m:arms"', 'масса со списком мышц')],
    ['программа второго профиля: ягодицы в приоритете', mode('m:glutes') + settle + expect(goalIs('mass') + ' && ' + listIs('pm', 'm:glutes'), 'в списке — ягодицы') + expect(progTitle + ' === "Приоритет: ягодицы"', 'название программы')],
    ['программа второго профиля: вручную и обратно', mode('manual') + settle + expect(goalIs('hand'), 'вручную') + click('#pg-mass') + settle + expect(listIs('pm', 'm:glutes'), 'ягодицы на месте')]
  ] },

  /* только в приложении: цель, которой нет в справочнике, — из встроенного (решение владельца, 24 ноября 2026, пункт 8). Упражнение, вокруг которого выбран
     «Гибрид» или «Сила», убрано из справочника, — выбор остаётся, а сборка ставит его сама; без базовых в справочнике цели «Сила» и «Гибрид» остаются;
     после «Принять» цель возвращается в справочник со своим снарядом */
  /* только в приложении: онбординг пустого профиля (решение владельца, 25 ноября 2026). Цель и время — что беречь — программа — шаг веса, вес тела
     и известные веса — готовая программа. Пустые упражнения со штангой и гантелями дневник оценивает по похожим (жим лежа 100 на раз — гантели лёжа
     с 30 кг), тренажёры и блоки — нет. Больное плечо — красная пилюля у жимов, стоп-упражнение сборка не ставит; подтягиваний меньше нижней границы
     диапазона — вместо них вертикальная тяга, хватает — старт от веса тела (решения владельца, 25 ноября 2026, пункты 2 и 3) */
  { name: 'онбординг: собрать программу', data: 'empty', app: true, steps: [
    ['старт', go('overview') + settle + expect(onbAt(1, 6) + ' && ' + tabsOff, 'онбординг, шаг 1 из 6, без вкладок')],
    ['собрать программу: цель и время', click('#onb-build') + settle + expect(onbAt(2, 6), 'шаг 2 из 6') + expect(goalIs('mass') + ' && ' + listIs('pm', 'even'), 'цель «Масса», «Всем поровну»')
      + expect(goals + ' === "Масса,Сила,Гибрид"', 'кнопки цели без «Вручную»: своя программа выбирается на старте')
      + expect('!document.getElementById("pp")', 'дней подряд на этом шаге нет: их спрашивает шаг 4, у дней программы')],
    /* дни подряд — на шаге 4, у дней программы, которую собрал дневник (просьба владельца, 25 ноября 2026) */
    ['три дня: дальше, что беречь', click('#onb-next') + settle + expect(onbAt(3, 6), 'шаг 3 из 6')],
    ['дальше: программа и дни подряд', click('#onb-next') + settle + expect(onbAt(4, 6), 'шаг 4 из 6')
      + expect('[...document.querySelectorAll("#pp button")].map(b => b.textContent).join() === "1–2,2–3,3–1" && !document.querySelector("#pp button[aria-pressed=true]")', 'дни подряд — пары соседних дней по кругу, ничего не отмечено')
      + expect('!document.querySelector("#onb > .note")', 'над днями текста нет: только «Дни подряд» и карточки дней')],
    ['дни 1 и 2 подряд', click('#pp-mon-wed') + settle + expect('JSON.stringify(' + cfgMain + '.pairs) === \'["mon-wed"]\' && document.getElementById("pp-mon-wed").getAttribute("aria-pressed") === "true" && ' + onbAt(4, 6), 'пара сохранена, мастер на том же шаге')],
    ['снять дни 1 и 2', click('#pp-mon-wed') + settle + expect('!("pairs" in ' + cfgMain + ')', 'пар нет')],
    ['назад: что беречь', click('#onb-back') + settle + expect(onbAt(3, 6), 'шаг 3 из 6')],
    ['назад: цель и время', click('#onb-back') + settle + expect(onbAt(2, 6), 'шаг 2 из 6')],
    ['гибрид вокруг жима лежа', click('#pg-mix') + settle + expect(goalIs('mix') + ' && ' + listIs('pl', 'l:bench'), 'цель «Гибрид», жим лежа')],
    ['два дня в неделю', click('#pd-2') + settle + expect('document.getElementById("pd-2").getAttribute("aria-pressed") === "true" && ' + cfgMain + '.days === 2', 'два дня, число дней в настройке профиля')],
    ['время на тренировку: полтора часа', pick('#pt', 90) + settle + expect(cfgMain + '.time === 90', 'время 90 минут в настройке профиля')
      + expect('!document.getElementById("onb-sum") && !document.querySelector("#onb > .note")', 'под выбором ни итога, ни пояснения: текст убран (просьба владельца, 25 ноября 2026)')],
    ['дальше: что беречь', click('#onb-next') + settle + expect(onbAt(3, 6), 'шаг 3 из 6') + expect('[...document.querySelectorAll("#care .picks button")].map(b => b.textContent).join() === "Плечо,Локоть,Запястье,Поясница,Тазобедренный сустав,Колено"', 'шесть мест')],
    ['болит плечо', click('#care-shoulder') + settle + expect('document.getElementById("care-shoulder").getAttribute("aria-pressed") === "true" && JSON.stringify(' + cfgMain + '.care) === \'["shoulder"]\'', 'плечо отмечено и сохранено в настройке профиля')],
    ['стоп-упражнение: приседания со штангой', pick('#stop-add', 'squat') + settle + expect(cfgMain + '.ex.squat.stop === true && document.getElementById("stop-list").textContent.startsWith("Приседания со штангой")', 'приседания — стоп-упражнение')],
    ['дальше: программа', click('#onb-next') + settle + expect(onbAt(4, 6), 'шаг 4 из 6') + 'const r = ' + draftRows + ';'
      + expect('r.length === 2 && r[0][0].startsWith("Жим лежа") && r[1][0].startsWith("Жим лежа — лёгкий день")', 'два дня: день 1 — жим лежа на силу, день 2 — его лёгкий день')
      + expect('!r.flat().some(n => n.startsWith("Приседания со штангой"))', 'стоп-упражнения в программе нет')
      + expect('!document.getElementById("pp")', 'при двух днях выбора «Дни подряд» нет')
      + expect('[...document.querySelectorAll("#view .prow .pn")].filter(p => p.textContent.startsWith("Жим лежа")).every(p => [...p.querySelectorAll(".tag.crit")].map(t => t.textContent).join() === "Плечо")', 'у жима лежа — красная пилюля «Плечо»')
      + expect('!document.getElementById("prog-free") && !document.querySelector("#view .mtab")', 'таблицы мышц и счётчика подходов в онбординге нет')
      + expect('!document.querySelector("#view .pctl, #view [id^=pa-], #view [id^=pb-]") && ![...document.querySelectorAll("#view .prow .tag")].some(t => t.textContent === "новое")', 'программу собрал дневник: без «выше», «−», «+», «убрать», «новое» и «В день»')
      + expect('[...document.querySelectorAll("#view .prow [id^=sw-]")].length > 0 && [...document.querySelectorAll("#view .prow [id^=sw-]")].every(b => b.textContent === "Заменить")', 'у упражнений — кнопка «Заменить»')
      + expect('document.querySelectorAll("#onb-days > .pslot .pday").length === 2 && ' + DOT + '(0) && ' + OPEN + '(0)', 'дни — карусель из двух карточек, открыт день 1, день 2 — край справа')],
    ['листать: точка дня 2', click('#onb-dot-wed') + settle + expect(DOT + '(1) && ' + OPEN + '(1)', 'открыт день 2, его полоса над днями вытянута, день 1 — край слева')],
    ['заменить на дне 2: день не сбросился', click('#onb-days > .pslot:nth-child(2) [id^="sw-"]') + settle
      + expect('!!document.querySelector("#onb-days > .pslot:nth-child(2) .prow.swapping") && document.querySelectorAll("#view .swaprow .ex-card").length > 0', 'под упражнением дня 2 — замены')
      + expect(DOT + '(1) && ' + OPEN + '(1)', 'после перерисовки карусель на том же дне 2')],
    ['нажать на край: день 1', click('#onb-days > .pslot:nth-child(1)') + settle + expect(DOT + '(0) && ' + OPEN + '(0)', 'нажатый край открыл день 1')],
    ['пальцем влево: день 2', SWIPE + '(-120);' + settle + expect(DOT + '(1) && ' + OPEN + '(1)', 'палец увёл карусель на день 2')],
    ['пальцем вправо: день 1', SWIPE + '(120);' + settle + expect(DOT + '(0) && ' + OPEN + '(0)', 'палец вернул день 1')],
    ['заменить упражнение: список', click('#view .prow [id^="sw-"]') + settle + expect('document.querySelectorAll("#view .swaprow .ex-card").length > 0 && document.querySelector("#view .prow.swapping [id^=sw-]").textContent === "Отмена"', 'под кнопкой — упражнения на замену, кнопка стала «Отмена»')],
    ['замены жима в тренажёре на грудь: пилюли', click('#view .prow.swapping [id^="sw-"]') + settle + 'const b = [...document.querySelectorAll("#view .prow")].find(p => p.querySelector(".pn").textContent.startsWith("Жим в тренажере на грудь"));' + '__t.click("#" + b.querySelector("[id^=sw-]").id, 0);' + settle
      + expect('[...document.querySelectorAll("#view .swaprow .ex-card .nm")].map(n => n.textContent).includes("Жим штанги под угломПлечо") && [...document.querySelectorAll("#view .swaprow .ex-card .nm")].some(n => !n.querySelector(".tag.crit"))', 'в списке замен — жим штанги под углом с пилюлей «Плечо», остальные без неё')],
    ['заменить упражнение', click('#view .swaprow .ex-card') + settle + expect('document.getElementById("toast").textContent.includes("→")', 'сообщение о замене')
      + expect('!document.querySelector("#view .swaprow") && [...document.querySelectorAll("#view .prow.changed .sub")].some(e => e.textContent.includes("вместо «"))', 'список закрыт, у замены — «вместо «…»»')],
    ['принять программу', click('#onb-accept') + settle + accepted + expect(onbAt(5, 6), 'шаг 5 из 6: веса') + expect(cfgMain + '.program.focus === "bench"', 'программа вокруг жима лежа в хранилище')
      + expect('!!document.getElementById("bw-reps-pullup") && !document.getElementById("kw-work-pullup")', 'у подтягиваний — «сколько раз подряд», а не рабочий вес')],
    ['дальше без шага веса', click('#onb-next') + settle + expect('document.getElementById("toast").textContent.startsWith("Укажи шаг веса: ")', 'сообщение «Укажи шаг веса»') + expect(onbAt(5, 6), 'остались на шаге 5')],
    ['шаг штанги — свой', type('#onb-step-barbell', '2,5') + settle + expect('document.getElementById("onb-step-barbell").value === "2.5" && !document.getElementById("onb-step-usual-barbell")', 'шаг штанги 2.5, подсказки «обычно» больше нет')],
    ['шаг остальных — обычный', clickAll('[id^="onb-step-usual-"]') + settle + expect('!document.querySelector("[id^=onb-step-usual-]") && [...document.querySelectorAll("#onb-gear input")].every(e => e.value)', 'у всех снарядов программы шаг введён')],
    ['вес тела 80', type('#onb-bw-kg', 80) + settle + expect('document.getElementById("onb-bw-kg").value === "80" && document.getElementById("bw-out-pullup").textContent === "сколько раз подряд получается сейчас"', 'вес тела записан, у подтягиваний — подсказка')],
    ['подтягиваний 4: вместо них тяга', type('#bw-reps-pullup', 4) + settle + 'const c = ' + cfgMain + ', all = Object.values(c.program.slots).flat().map(e => e.ex);'
      + expect('!all.includes("pullup") && all.includes("lat_pulldown")', 'в программе вместо подтягиваний вертикальная тяга')
      + expect('document.getElementById("bw-out-pullup").textContent === "меньше 6 — пока вместо них «Вертикальная тяга в тренажере»"', 'строка «меньше 6 — пока вместо них …»')],
    ['подтягиваний 8: они вернулись', type('#bw-reps-pullup', 8) + settle + 'const c = ' + cfgMain + ', all = Object.values(c.program.slots).flat().map(e => e.ex);'
      + expect('all.includes("pullup") && !all.includes("lat_pulldown")', 'подтягивания снова в программе')
      + expect('c.ex.pullup.work === 80 && c.ex.pullup.workR === 8 && document.getElementById("bw-out-pullup").textContent.startsWith("старт: 80 кг")', 'старт подтягиваний — вес тела на 8 повторов')],
    ['жим лежа 100 на раз', type('#kw-max-bench', 100) + settle + expect('document.getElementById("kw-out-bench").textContent.includes("% от максимума 100")', 'старт жима — от максимума 100')
      + expect('[...document.querySelectorAll("#known .kw-out")].some(e => e.textContent.includes("— оценка по «Жим лежа»"))', 'у похожего упражнения с гантелями — оценка по жиму лежа')
      + expect('[...document.querySelectorAll("#known .kw-out")].filter(e => /в тренажере|на блоке|блока/.test(e.parentNode.querySelector(".kw-n").textContent)).every(e => e.textContent === "вес подберёшь на первой тренировке")', 'тренажёры и блоки не оцениваются')],
    ['дальше: программа готова', click('#onb-next') + settle + expect(onbAt(6, 6), 'шаг 6 из 6') + expect('document.getElementById("view").textContent.includes("старт ≈ ")', 'в программе есть старт по оценке')
      + expect('document.querySelectorAll("#onb-days > .pslot .pday").length === 2 && ' + DOT + '(0) && ' + OPEN + '(0)', 'дни — та же карусель, открыт день 1')
      + expect('!!document.querySelector("#onb-body-map svg") && document.querySelector("#onb-body-map .eyebrow").textContent.startsWith("Нагрузка мышц за неделю: ")', 'фигура с нагрузкой мышц за неделю')],
    ['открыть первую тренировку', click('#onb-go') + settle + expect('location.hash === "#workout" && !(' + tabsOff + ')', 'вкладка «Тренировка», вкладки на месте')
      + expect('document.getElementById("view").textContent.includes("Начать тренировку")', 'план первой тренировки')],
    ['обзор: первая тренировка', go('overview') + settle + expect('!document.getElementById("onb") && document.getElementById("view").textContent.includes("Первая тренировка")', 'обычный обзор: карточка «Первая тренировка»')],
    ['после перезагрузки онбординга нет', RELOAD],
    ['обзор после перезагрузки', go('overview') + settle + expect('!document.getElementById("onb") && document.getElementById("view").textContent.includes("Первая тренировка")', 'карточка «Первая тренировка»')
      + 'const c = ' + cfgMain + ';' + expect('c.ex.bench.max === 100 && c.gear.barbell.step === 2.5 && c.days === 2 && c.program.focus === "bench" && c.ex.squat.stop === true && c.care.join() === "shoulder"', 'в настройке профиля: максимум жима, шаг штанги, два дня, программа, стоп-упражнение и больное плечо')]
  ] },

  /* только в приложении: с днями «День N» у программы, которую собрал дневник, на «Программе» — то же, что в онбординге (решение владельца, 25 ноября 2026):
     у упражнения только «Заменить» с упражнениями на замену под кнопкой; стрелок, «−/+», «убрать», пометок «новое», «перенос», «+N подходов» и строки «В день» нет,
     полоса слева — только у замены, «было N» в заголовке дня нет. Подходы мышце по-прежнему прибавляются кнопками у мышцы, а в «Вручную» — все кнопки, как были */
  { name: 'программа: у собранной только «Заменить»', app: true, steps: [
    ['программа: собрал дневник', go('program') + settle + 'const d = ' + DRAFT + ';'
      + expect('!d.querySelector(".pday .pctl, .pday .linkbtn, .pday select, [id^=pa-], [id^=pb-]")', 'в днях новой программы нет «выше», «−», «+», «убрать», «В день» и списка замены')
      + expect('[...d.querySelectorAll(".pday button[id^=sw-]")].length > 0 && [...d.querySelectorAll(".pday button[id^=sw-]")].every(b => b.textContent === "Заменить")', 'у упражнений — кнопка «Заменить»')
      + expect(NO_TAGS, 'пометок «новое», «перенос» и «+N подходов» нет') + expect('!!d.querySelector("button[id^=mp-]") && !!d.querySelector("button[id^=mn-]")', 'кнопки «+» и «−» у мышц на месте')],
    ['прибавить подход мышце', click('button[id^="mp-"]') + settle + 'const d = ' + DRAFT + ';'
      + expect('!!document.getElementById("prog-reset") && !d.querySelector(".pday .prow.changed")', 'правка есть, а полосы слева нет: она только у замены, как в онбординге') + expect(NO_TAGS, 'пометки «+N подходов» нет')
      + expect('![...d.querySelectorAll(".pday-h")].some(e => e.textContent.includes("было"))', 'в заголовках дней нет «было N»')],
    ['заменить упражнение: список', click(SWAP) + settle + expect('document.querySelectorAll("#view .swaprow .ex-card").length > 0 && document.querySelector("#view .prow.swapping button[id^=sw-]").textContent === "Отмена"', 'под кнопкой — упражнения на замену, кнопка стала «Отмена»')
      + expect('document.activeElement && document.activeElement.classList.contains("ex-card")', 'фокус — на первом упражнении списка')],
    ['заменить упражнение', click('#view .swaprow .ex-card') + settle + expect('document.getElementById("toast").textContent.includes("→")', 'сообщение о замене')
      + expect('!document.querySelector("#view .swaprow") && document.querySelectorAll("#view .pday .prow.changed").length === 1 && document.querySelector("#view .pday .prow.changed .sub").textContent.includes("вместо «")', 'список закрыт, полоса слева — только у замены, с «вместо «…»»')],
    ['вручную: все кнопки', mode('manual') + settle + 'const d = ' + DRAFT + ';'
      + expect('!!d.querySelector(".pday .pctl") && !!document.getElementById("pa-mon") && !!document.getElementById("pb-mon") && !!d.querySelector(".linkbtn[id^=sw-]")', 'в «Вручную» — «выше», «−/+», «убрать», «В день» и ссылка «заменить»')]
  ] },

  /* только в приложении: дни подряд на «Программе» и что беречь в «Настройке» (решения владельца, 25 ноября 2026, пункты 6 и 2): пара дней сохраняется
     в настройке профиля, сборка пишет заметку «Дни подряд»; все дни подряд не бывают; больное колено — красные пилюли у упражнений, которые его нагружают */
  { name: 'программа: дни подряд и что беречь', app: true, steps: [
    ['программа: дни подряд', go('program') + settle + expect('[...document.querySelectorAll("#pp button")].map(b => b.textContent).join() === "1–2,2–3,3–1" && !document.querySelector("#pp button[aria-pressed=true]")', 'три пары соседних дней, ничего не отмечено')],
    ['дни 1 и 2 подряд', click('#pp-mon-wed') + settle + expect('JSON.stringify(' + cfgMain + '.pairs) === \'["mon-wed"]\' && document.getElementById("pp-mon-wed").getAttribute("aria-pressed") === "true"', 'пара сохранена в настройке профиля')
      + expect('[...document.querySelectorAll("#prog-why .why b")].some(b => b.textContent.startsWith("Дни подряд: 1–2"))', 'в «Что изменилось и почему» — заметка «Дни подряд: 1–2»')],
    ['и дни 2 и 3', click('#pp-wed-fri') + settle + expect('JSON.stringify(' + cfgMain + '.pairs) === \'["mon-wed","wed-fri"]\'', 'две пары')],
    ['все три подряд нельзя', click('#pp-fri-mon') + settle + expect(toastIs('Все дни подряд не бывают: между последним и первым днём недели есть отдых'), 'сообщение') + expect('document.getElementById("pp-fri-mon").getAttribute("aria-pressed") === "false"', 'третья пара не отмечена')],
    ['снять дни 2 и 3', click('#pp-wed-fri') + settle + expect('JSON.stringify(' + cfgMain + '.pairs) === \'["mon-wed"]\'', 'одна пара')],
    ['настройка: что беречь', go('setup') + settle + click('#setup-more > summary') + settle + expect('document.querySelector("#setup-more > summary").textContent === "Остальные настройки: что беречь, профили, справочник, данные" && !!document.getElementById("care-card")', 'в свёрнутой части — «Что беречь» первым')],
    ['болит колено', click('#care-knee') + settle + expect('JSON.stringify(' + cfgMain + '.care) === \'["knee"]\' && document.getElementById("care-knee").getAttribute("aria-pressed") === "true"', 'колено отмечено и сохранено')],
    ['программа: пилюли «Колено»', go('program') + settle + 'const d = ' + DRAFT + ';' + expect('[...d.querySelectorAll(".pday .tag.crit")].length > 0 && [...d.querySelectorAll(".pday .tag.crit")].every(t => t.textContent === "Колено")', 'у упражнений на ноги — красная пилюля «Колено»')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* только в приложении: онбординг, своя программа — дни заполняются из справочника */
  { name: 'онбординг: своя программа', data: 'empty', app: true, steps: [
    ['своя программа: что беречь', go('overview') + settle + click('#onb-own') + settle + expect(onbAt(2, 5) + ' && !!document.getElementById("care")', 'шаг 2 из 5: что беречь')],
    ['болит плечо, стоп — приседания', click('#care-shoulder') + settle + pick('#stop-add', 'squat') + settle + expect('JSON.stringify(' + cfgMain + '.care) === \'["shoulder"]\' && ' + cfgMain + '.ex.squat.stop === true', 'плечо и стоп-упражнение сохранены')],
    ['дальше: своя программа', click('#onb-next') + settle + expect(onbAt(3, 5), 'шаг 3 из 5: своя программа') + expect('!!document.getElementById("pa-mon") && document.getElementById("onb-accept").disabled', 'список упражнений в днях, «Принять» выключена')
      + expect('![...document.querySelectorAll("#pa-mon option")].some(o => o.value === "squat")', 'приседаний в списке дня нет: стоп-упражнение')],
    ['в день 1', pick('#pa-mon', 'db_bench') + click('#pb-mon') + settle + expect('!document.getElementById("onb-accept").disabled', '«Принять» включена')],
    ['в день 2', pick('#pa-wed', 'bench') + click('#pb-wed') + settle + expect('[...document.querySelectorAll(".pday .prow .tag.crit")].map(t => t.closest(".pn").firstChild.textContent + ":" + t.textContent).join() === "Жим лежа:Плечо"', 'у жима лежа — пилюля «Плечо», у жима гантелей — нет')],
    ['назад: что беречь, дни на месте', click('#onb-back') + settle + expect(onbAt(2, 5), 'шаг 2 из 5') + click('#care-knee') + settle + click('#onb-next') + settle
      + expect(onbAt(3, 5) + ' && document.querySelectorAll(".pday .prow").length === 2', 'отметка колена не стёрла дни своей программы')],
    ['принять', click('#onb-accept') + settle + accepted + expect(onbAt(4, 5), 'шаг 4 из 5: веса')],
    ['назад: программа принята, «Дальше»', click('#onb-back') + settle + expect(onbAt(3, 5) + ' && !!document.getElementById("onb-next")', 'шаг 3 из 5, кнопка «Дальше»')],
    ['снова веса', click('#onb-next') + settle + expect(onbAt(4, 5), 'шаг 4 из 5')],
    ['шаг веса', clickAll('[id^="onb-step-usual-"]') + settle],
    ['жим лежа: рабочий вес', type('#kw-work-bench', 80) + type('#kw-workR-bench', 8) + settle + outIs('db_bench', 'старт: ≈ 32 кг на 6–10 повторов — оценка по «Жим лежа»')],
    ['готово', click('#onb-next') + settle + expect(onbAt(5, 5), 'шаг 5 из 5')],
    ['в дневник', click('#onb-end') + settle + expect('!document.getElementById("onb") && document.getElementById("view").textContent.includes("Первая тренировка") && !(' + tabsOff + ')', 'обычный обзор с вкладками')
      + expect('[...document.querySelectorAll("#view .tag")].some(e => e.textContent === "оценка")', 'в плане первой тренировки пометка «оценка»')]
  ] },

  /* только в приложении: онбординг, программа текстом (решение владельца, 25 ноября 2026) — дни и упражнения из заметки, незнакомое выбирает атлет */
  { name: 'онбординг: программа текстом', data: 'empty', app: true, steps: [
    ['программа текстом', go('overview') + settle + click('#onb-paste') + settle + expect(onbAt(2, 6), 'шаг 2 из 6: программа текстом') + expect('document.getElementById("onb-next").disabled', '«Дальше» выключена, пока текст не разобран')],
    ['пусто: разбирать нечего', click('#onb-parse') + settle + expect('document.getElementById("toast").textContent.startsWith("Не нашёл упражнений")', 'сообщение «Не нашёл упражнений»')],
    ['вставить и разобрать', type('#onb-text', PASTED) + click('#onb-parse') + settle
      + expect('[...document.querySelectorAll("[id^=onb-pick-]")].map(e => e.id.slice(9) + "=" + e.value).join() === "0-0=bench,0-1=pulldown_cable,0-2=,1-0=squat,1-1=rdl"', 'узнаны жим лежа, тяга верхнего блока, приседания и румынская тяга; пуловера в справочнике нет')
      + expect('document.getElementById("onb-parsed").textContent.includes("Дней: 2.") && !document.getElementById("onb-next").disabled', 'два дня, «Дальше» включена')],
    ['пуловер — новым упражнением', pick('#onb-pick-0-2', '+new') + settle + expect('!!document.getElementById("onb-gear-0-2")', 'у нового — выбор снаряда') + pick('#onb-gear-0-2', 'dumbbell')],
    ['дальше: что беречь', click('#onb-next') + settle + expect(onbAt(3, 6) + ' && !!document.getElementById("care")', 'шаг 3 из 6: что беречь')],
    ['болит колено', click('#care-knee') + settle + expect('JSON.stringify(' + cfgMain + '.care) === \'["knee"]\'', 'колено отмечено')],
    ['дальше: дни программы', click('#onb-next') + settle + expect(onbAt(4, 6), 'шаг 4 из 6') + 'const r = ' + draftRows + ';'
      + expect('r.length === 2 && r[0].length === 3 && r[0][0].startsWith("Жим лежа") && r[0][2].startsWith("Пуловер с гантелью") && r[1][0].startsWith("Приседания со штангой")', 'два дня, как в тексте, пуловер — в первом')
      + expect('[...document.querySelectorAll(".pday .prow .tag.crit")].map(t => t.textContent).join() === "Колено"', 'у приседаний — пилюля «Колено»')],
    ['назад: разбор на месте', click('#onb-back') + settle + expect(onbAt(3, 6), 'шаг 3 из 6: что беречь') + click('#onb-back') + settle + expect(onbAt(2, 6) + ' && document.getElementById("onb-pick-0-2").value === "+new"', 'шаг 2, выбор сохранился')
      + click('#onb-next') + settle + click('#onb-next') + settle + expect(onbAt(4, 6), 'снова шаг 4')],
    ['принять', click('#onb-accept') + settle + accepted + expect(onbAt(5, 6), 'шаг 5 из 6: веса')
      + 'const c = ' + cfgMain + ', nx = Object.values(c.ex).find(e => e.n === "Пуловер с гантелью");' + expect('c.days === 2 && c.ex.bench.work === 80 && c.ex.bench.workR === 6 && c.ex.squat.work === 100 && nx && nx.gear === "dumbbell"', 'в настройке: два дня, вес из текста у жима и приседаний, пуловер на гантелях')
      + expect('document.getElementById("kw-work-bench").value === "80"', 'вес жима из текста — в поле рабочего веса')],
    ['шаг веса и дальше', clickAll('[id^="onb-step-usual-"]') + settle + click('#onb-next') + settle + expect(onbAt(6, 6), 'шаг 6 из 6')],
    ['первая тренировка', click('#onb-go') + settle + expect('location.hash === "#workout"', 'вкладка «Тренировка»')]
  ] },

  { name: 'программа: цели нет в справочнике', data: 'empty', app: true, steps: [
    ['гибрид вокруг жима лежа', go('program') + settle + mode('l:bench') + settle + expect(goalIs('mix') + ' && ' + listIs('pl', 'l:bench'), 'цель «Гибрид», жим лежа') + expect(progTitle + ' === "Пауэрбилдинг: жим лежа"', 'название программы')],
    ['убрать жим лежа из справочника', go('setup') + settle + click('#setup-more > summary') + settle + click('#ex-del-bench') + settle + expect(toastIs('Убрано из справочника: Жим лежа'), 'сообщение «Убрано из справочника»')],
    ['программа: гибрид вокруг жима на месте', go('program') + settle + expect(goalIs('mix') + ' && ' + listIs('pl', 'l:bench') + ' && ' + listOf('pl') + ' === "l:bench,l:squat,l:leg_press,l:pullup,l:deadlift,l:hip_thrust,l:ohp,l:barbell_curl"', 'выбор тот же, жим лежа в списке остался')
      + expect(progTitle + ' === "Пауэрбилдинг: жим лежа" && ' + draftRows + '[0][0].startsWith("Жим лежа")', 'жим лежа — первым в день 1: сборка взяла его из встроенного справочника')],
    ['сила в подтягиваниях со своим лимитом недели', click('#pg-force') + settle + pick('#ps', 's:pullup') + settle + expect(goalIs('force') + ' && ' + listIs('ps', 's:pullup') + ' && ' + capOf + ' === 80', 'цель «Сила», подтягивания, лимит 80') + expect(progTitle + ' === "Сила: подтягивания"', 'название программы')],
    ['убрать оставшиеся базовые', go('setup') + settle + click('#ex-del-leg_press') + settle + click('#ex-del-pullup') + settle + expect(toastIs('Убрано из справочника: Подтягивания'), 'сообщение «Убрано из справочника»')],
    ['программа: базовых в справочнике нет, а «Сила» и «Гибрид» есть', go('program') + settle + expect(goals + ' === "Масса,Сила,Гибрид,Вручную"', 'цели «Сила» и «Гибрид» на месте: их цель сборка берёт из встроенного справочника')
      + expect(goalIs('force') + ' && ' + listIs('ps', 's:pullup') + ' && ' + progTitle + ' === "Сила: подтягивания"', 'выбор тот же: «Сила», подтягивания')
      + expect(draftRows + '.flat().filter(t => t.startsWith("Подтягивания")).length === 2', 'подтягивания — в двух днях: тяжёлый и лёгкий (выводы аудита)')],
    ['принять: подтягивания вернулись в справочник со своим снарядом', click('#prog-accept') + settle + accepted + 'const c = ' + cfgMain + ';'
      + expect('c.ex.pullup && c.ex.pullup.gear === "g_pullup" && c.gear.g_pullup && c.gear.g_pullup.step === 1 && c.program.focus === "pullup" && c.program.strength === true', 'подтягивания — в справочнике, на снаряде «Подтягивания» с шагом 1 кг; программа — сила в подтягиваниях')],
    ['вернуть типовые упражнения', go('setup') + settle + click('#starter-add') + settle + expect(toastIs('Добавлено упражнений: 2'), 'жим лежа и жим ногами вернулись в справочник')],
    ['программа: та же сила в подтягиваниях', go('program') + settle + expect(goals + ' === "Масса,Сила,Гибрид,Вручную" && ' + goalIs('force') + ' && ' + listIs('ps', 's:pullup'), 'выбор тот же: «Сила», подтягивания')]
  ] },

  /* только в приложении: время на тренировку. Атлет называет время — сборка ставит в каждый день столько упражнений и подходов, сколько в него помещается
     (решение владельца, 23 ноября 2026: упражнений в дне — от времени), а лимит недели — самый большой, при котором самая длинная тренировка укладывается;
     выбор помнится в профиле. С 25 ноября 2026 (решение владельца) время заполняется подходами выше 10 на мышцу, а в тренировке не больше десяти упражнений;
     тем же днём (просьба владельца) время — до 2 ч 30 мин, отдых дневник ставит упражнению сам, а списка «Подходов в неделю» нет: подходы — от времени, дней и цели.
     Числа — те же, что в app/tests/fit.test.ts для дней «День 1…3» */
  { name: 'программа: время на тренировку', data: 'seed', app: true, steps: [
    ['программа: время не ограничено', go('program') + settle + expect(listOf('pt') + ' === "0,60,75,90,105,120,135,150" && ' + listIs('pt', '0'), 'список времени: не ограничено и от часа до двух с половиной; выбрано «не ограничено»')
      + expect('[...document.getElementById("pt").options].map(o => o.textContent).join("|") === "не ограничено|до 1 ч|до 1 ч 15 мин|до 1 ч 30 мин|до 1 ч 45 мин|до 2 ч|до 2 ч 15 мин|до 2 ч 30 мин"', 'названия пунктов')
      + expect(noPicks + ' && ' + capOf + ' === 100 && !("time" in ' + cfgMain + ')', 'списков «Подходов в неделю» и отдыха нет, лимит недели — 100, времени в настройке нет')
      + expect('document.getElementById("view").textContent.includes("отдых по упражнению: 5 мин в тяжёлом дне, 3 мин в лёгком, 2 мин 30 с в многосуставных со штангой, 2 мин в остальных")', 'под днями сказано, какой отдых дневник ставит упражнению')
      + expect(dayEx + ' === 9', 'без времени в дне девять упражнений, как в первой версии')],
    ['до полутора часов', pick('#pt', 90) + settle + expect(listIs('pt', '90') + ' && ' + capOf + ' === 100', 'лимит недели — по времени: сборка сама укладывает дни в полтора часа')
      + expect('Math.max(...' + dayMins + ') <= 90 && ' + dayMins + '.length === 3', 'ни одна тренировка не длиннее полутора часов')
      + expect(draftSets + ' === 77 && ' + dayEx + ' === 9', 'в неделе 77 подходов, в дне до девяти упражнений')
      + expect(cfgMain + '.time === 90', 'время записано в настройку профиля')],
    ['до двух часов', pick('#pt', 120) + settle + expect(capOf + ' === 100 && Math.max(...' + dayMins + ') <= 120', 'тренировки до двух часов')
      + expect(draftSets + ' === 100 && ' + dayEx + ' === 10', 'в неделе 100 подходов, в дне десять упражнений: время заполнено подходами до лимита недели')],
    ['до двух с половиной часов', pick('#pt', 150) + settle + expect(listIs('pt', '150') + ' && ' + capOf + ' === 100 && Math.max(...' + dayMins + ') <= 150 && ' + draftSets + ' === 100', 'больше 100 подходов в неделю не бывает и при двух с половиной часах')],
    ['до часа пятнадцати', pick('#pt', 75) + settle + expect(capOf + ' === 100 && Math.max(...' + dayMins + ') <= 75 && !document.getElementById("pt-note")', 'тренировки до часа пятнадцати, подсказки «не уложиться» нет')
      + expect(draftSets + ' === 61 && ' + dayEx + ' === 7', 'в неделе 61 подход, в дне до семи упражнений')],
    ['час: подходов меньше, но укладывается', pick('#pt', 60) + settle + expect(capOf + ' === 100 && Math.max(...' + dayMins + ') <= 60 && !document.getElementById("pt-note")', 'тренировки до часа')
      + expect(draftSets + ' === 46 && ' + dayEx + ' === 6', '46 подходов, до шести упражнений в дне')],
    ['узкий телефон: 360', size(360, 740)],
    ['снова полтора часа', pick('#pt', 90) + settle + expect(capOf + ' === 100 && !document.getElementById("pt-note") && ' + draftSets + ' === 77', 'снова 77 подходов, подсказки нет')],
    ['телефон', size(390, 844)],
    ['гибрид: время то же', mode('l:bench') + settle + expect(listIs('pt', '90') + ' && ' + capOf + ' === 100 && Math.max(...' + dayMins + ') <= 90', 'у гибрида при полутора часах тренировки тоже до полутора часов')],
    ['сила: лимит по времени, а не 80 по умолчанию', pick('#pt', 105) + settle + mode('p') + settle + expect(listIs('pt', '105') + ' && ' + capOf + ' === 100 && Math.max(...' + dayMins + ') <= 105', 'время на месте, лимит 100: выше своей цели подсобка всё равно не идёт')],
    ['вручную: времени и лимита нет', click('#pg-hand') + settle + expect('!document.getElementById("pt") && !document.getElementById("pb-budget")', 'в правке вручную нет ни времени, ни лимита')],
    ['масса: время на месте', click('#pg-mass') + settle + expect(listIs('pt', '105') + ' && ' + capOf + ' === 100 && Math.max(...' + dayMins + ') <= 105 && ' + draftSets + ' === 90', 'у «Равномерно» при часе сорока пяти — 90 подходов, тренировки до часа сорока пяти')],
    /* лимит, найденный по времени, не должен пережить само время: под «Силой» без времени — снова 80, у массы — 100 */
    ['сила без времени — 80, масса — 100', mode('p') + settle + pick('#pt', 0) + settle + expect(listIs('pt', '0') + ' && ' + capOf + ' === 80 && !("time" in ' + cfgMain + ')', 'под «Силой» без времени лимит — 80, времени в настройке нет')
      + click('#pg-mass') + settle + expect(capOf + ' === 100 && ' + dayEx + ' <= 9', 'у массы — лимит профиля; без времени — снова девять мест в дне')],
    ['снова по времени и принять', pick('#pt', 105) + settle + expect(capOf + ' === 100', 'при часе сорока пяти — по времени') + click('#prog-accept') + settle + accepted
      + expect(cfgMain + '.time === 105 && ' + cfgMain + '.program.budget === 100', 'в настройке — время 105 и программа с лимитом 100')
      + expect('JSON.stringify(' + cfgMain + '.program.fit) === JSON.stringify({ time: 105, rest: 120, mode: "even", days: 3 })', 'с программой записано, по чему найден лимит')
      + expect(capOf + ' === 100 && document.getElementById("prog-accept").disabled', 'сразу после «Принять» лимит тот же, и новая программа совпадает с принятой')],
    ['после перезагрузки время помнится', RELOAD],
    ['программа после перезагрузки', go('program') + settle + expect(listIs('pt', '105') + ' && ' + capOf + ' === 100 && Math.max(...' + dayMins + ') <= 105', 'время — час сорок пять, лимит по времени тот же, тренировки не длиннее')
      + expect('document.getElementById("prog-accept").disabled', 'новая программа по-прежнему совпадает с принятой')],
    ['второй профиль: своё время', pick('#prof', 'p2') + settle + go('program') + settle + expect(listIs('pt', '0'), 'у второго профиля время не ограничено')],
    ['первый профиль: не ограничено — лимит снова свой', pick('#prof', 'me') + settle + go('program') + settle + pick('#pt', 0) + settle
      + expect(listIs('pt', '0') + ' && ' + capOf + ' === 100 && !("time" in ' + cfgMain + ')', 'лимит недели — 100, времени в настройке нет')],
    ['отдых в карточке упражнения', go('workout') + settle + press('Начать тренировку') + settle + expect('[...document.querySelectorAll("#view .ex-meta .tag")].some(e => /^отдых \\d+ мин/.test(e.textContent)) && !document.getElementById("wk-rest")', 'у упражнения в тренировке — отдых, который поставил дневник; выбора отдыха нет')]
  ] },

  /* только в приложении: дни «День 1…N» без привязки к дням недели и их число — два, три или четыре. Программа пересобирается под выбранное число:
     при двух днях базовое из убранного дня переезжает, при четырёх новый день заполняется, а дни выравниваются по длине.
     Прежние записи не меняются и остаются в журнале со своим днём; новая тренировка записывается в выбранный день */
  { name: 'дни: два, три и четыре дня в неделю', data: 'seed', app: true, steps: [
    ['программа: три дня без дней недели', go('program') + settle + expect('[...document.querySelectorAll("#pd button")].map(b => b.textContent).join() === "2,3,4" && document.getElementById("pd-3").getAttribute("aria-pressed") === "true"', 'выбор числа дней: 2, 3 и 4; выбрано три')
      + expect('[...document.querySelectorAll("#view .pday-h b")].map(b => b.textContent).join() === "День 1,День 2,День 3,День 1,День 2,День 3"', 'дни названы «День 1…3» и в действующей программе, и в новой')
      + expect('!/Понедельник|Среда|Пятница/.test(document.getElementById("view").textContent)', 'дней недели на экране нет')
      + 'sessionStorage.setItem("now3", ' + nowLoad + ');' + expect('sessionStorage.getItem("now3") !== ""', 'в заголовке новой программы есть «сейчас N»')
      + 'sessionStorage.setItem("w0", JSON.stringify(JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/"))));'
      + expect('JSON.parse(sessionStorage.getItem("w0")).length === 24 && JSON.parse(sessionStorage.getItem("w0")).some(x => x[1].slot === "fri")', 'в записях 24 тренировки, среди них — тренировки третьего дня')],
    ['два дня в неделю', click('#pd-2') + settle + expect('document.getElementById("pd-2").getAttribute("aria-pressed") === "true" && ' + cfgMain + '.days === 2', 'выбрано два дня, число записано в настройку профиля')
      + expect('[...document.querySelectorAll("#view .pday-h b")].map(b => b.textContent).join() === "День 1,День 2,День 1,День 2"', 'и в действующей программе, и в новой — два дня')
      + 'const r = ' + draftRows + ';' + expect('r.length === 2 && r[0][0].startsWith("Жим лежа") && r[1][0].startsWith("Жим ногами") && r[1].some(t => t.startsWith("Разгибания ног"))', 'в днях — то базовое, что в них стояло, и оно идёт первым: в записях перед жимом ногами стоят разгибания ног, сборка ставит базовое дня вперёд')
      + expect('r[1].some(t => t.startsWith("Подтягивания")) && !r[0].some(t => t.startsWith("Подтягивания"))', 'в «Массе» базовые идут по двойной прогрессии и жертвовать ими незачем: подтягивания из третьего дня переехали во второй')
      + expect('!document.getElementById("pd-drop")', 'списка «Без базового» в «Массе» нет')
      + expect('!!document.getElementById("pd-away") && document.getElementById("pd-away").textContent.startsWith("День 3 сейчас не в неделе: Подтягивания и ещё 7 упражнений в план не попадают. Прими программу ниже — сборка разложит неделю заново, а в «Вручную» добавь их в дни сам — или верни прежнее число дней.")', 'подсказка: третий день не в неделе, подтягивания в план не попадают')
      + expect(nowLoad + ' === sessionStorage.getItem("now3")', '«сейчас» — вся нынешняя неделя вместе с третьим днём, как при трёх днях')],
    ['что изменилось и почему', click('#prog-why > summary') + settle + 'const t = document.getElementById("prog-why").textContent;'
      + expect('t.includes("Подтягивания — в день 2") && t.includes("Дней в неделе стало меньше, а это базовое стояло в дне, которого больше нет") && !t.includes("Не в программе")', 'заметка о базовом, которое переехало, и почему') + expect('!/понедельник|в среду|в пятницу|undefined/i.test(t)', 'в заметках нет дней недели и «undefined»')
      + expect('/Порядок упражнений: [^.]*день 2/.test(t)', 'заметка о порядке: во втором дне базовое встало перед разгибаниями ног')
      + expect('t.includes("Один день в неделю") && t.includes("в каждой тренировке уже по девять упражнений")', 'второй день достался не всем мышцам — и названа настоящая причина')
      + expect(progNote + '.includes("Второй день достался не всем мышцам") && !' + progNote + '.includes("Каждая мышца работает минимум")', 'пояснение режима не обещает второй день каждой мышце')],
    ['два дня и полтора часа на тренировку', pick('#pt', 90) + settle + expect(noPicks + ' && ' + capOf + ' === 100 && ' + dayMins + '.length === 2 && Math.max(...' + dayMins + ') <= 90', 'лимит по времени, обе тренировки не длиннее полутора часов')],
    ['время снова не ограничено', pick('#pt', 0) + settle + expect(capOf + ' === 100', 'лимит — лимит профиля')],
    ['вручную при дне вне недели: принять можно', click('#pg-hand') + settle + expect('!!document.getElementById("pd-away") && !document.getElementById("prog-accept").disabled', 'подсказка на месте, «Принять программу» доступна: неделя из двух дней — уже другая программа')
      + expect(draftRows + '.every(d => !d.some(t => t.startsWith("Подтягивания")))', 'в «Вручную» дневник неделю не пересобирает: подтягиваний в днях нет, пока их не добавишь')],
    /* в «Гибриде» остальные базовые по умолчанию — как подсобка (вывод 5 аудита): по проценту идёт только жим, и подтягивания переезжают, как в «Массе» */
    ['гибрид при двух днях: остальные базовые как подсобка', mode('l:bench') + settle + 'const r = ' + draftRows + ';'
      + expect('r[0][0].startsWith("Жим лежа") && r[1][0].startsWith("Жим лежа — лёгкий день")', 'тяжёлый день — первый, лёгкий — второй')
      + expect('r[1].some(t => t.startsWith("Подтягивания")) && !document.getElementById("pd-drop")', 'подтягивания из третьего дня переехали в день 2: по проценту они не идут, жертвовать нечем — списка «Без базового» нет')
      + expect('document.getElementById("prog-why").textContent.includes("Масса — вместе с лёгким днём, в день 2")', 'упражнение на массу стоит в лёгком дне, и об этом сказано')],
    ['гибрид при двух днях: остальные базовые растут — в тренировке одно базовое', click('#po-grow') + settle + 'const r = ' + draftRows + ';'
      + expect('r[0][0].startsWith("Жим лежа") && r[1][0].startsWith("Жим лежа — лёгкий день")', 'тяжёлый день — первый, лёгкий — второй')
      + expect('r.every(d => !d.some(t => t.startsWith("Подтягивания")))', 'подтягивания из третьего дня не встали: в тренировке одно базовое')
      + 'const dr = document.getElementById("pd-drop");' + expect('!!dr && dr.closest("label").textContent.startsWith("Без базового") && dr.value === "pullup" && [...dr.options].map(o => o.textContent).join() === "Жим ногами,Подтягивания"', 'список «Без базового»: без выбора — подтягивания; цели «Гибрида» в нём нет')
      + expect('document.getElementById("prog-why").textContent.includes("Не в программе: Подтягивания") && document.getElementById("prog-why").textContent.includes("Базовых три, а дней два: в тренировке одно базовое")', 'заметка о базовом, которое ушло, и почему')
      + expect('document.getElementById("prog-why").textContent.includes("Масса — вместе с лёгким днём, в день 2")', 'упражнение на массу стоит в лёгком дне, и об этом сказано')
      + expect(progNote + '.includes("Оно идёт оба дня на силу") && ' + progNote + '.includes("упражнение на массу стоит в лёгкий день")', 'пояснение режима — под два дня')],
    ['без базового: жертвуем жимом ногами', pick('#pd-drop', 'leg_press') + settle + 'const r = ' + draftRows + ';'
      + expect('r[0][0].startsWith("Жим лежа") && r[1].some(t => t.startsWith("Подтягивания")) && r.every(d => !d.some(t => t.startsWith("Жим ногами")))', 'подтягивания встали во второй день вместо жима ногами')
      + expect('document.getElementById("pd-drop").value === "leg_press" && document.getElementById("prog-why").textContent.includes("Не в программе: Жим ногами")', 'выбор виден в списке и в заметке')],
    ['снова поровну и принять программу на два дня', mode('even') + settle + click('#prog-accept') + settle + accepted
      + expect('Object.keys(' + cfgMain + '.program.slots).join() === "mon,wed" && ' + cfgMain + '.days === 2 && ' + cfgMain + '.program.prev.days === 3', 'в программе два дня; запомнено, что до этого было три')
      + 'const cp = ' + cfgMain + '.program;' + expect('!("drop" in cp) && ["bench", "leg_press", "pullup"].every(id => JSON.stringify(cp.slots).includes(\'"\' + id + \'"\'))', 'в «Массе» программа ничем не жертвует: все три базовых в ней, выбор «Без базового» из «Гибрида» на неё не влияет')
      + expect('!document.getElementById("pd-away")', 'подсказки о третьем дне больше нет: программа его заменила')],
    ['вернуть прежнюю: дней снова три', click('#prog-undo') + settle + expect('!("days" in ' + cfgMain + ') && !' + cfgMain + '.program', 'программы нет, число дней в настройке — снова три')
      + expect('document.getElementById("pd-3").getAttribute("aria-pressed") === "true" && [...document.querySelectorAll("#view .pday-h b")].map(b => b.textContent).join() === "День 1,День 2,День 3,День 1,День 2,День 3" && !document.getElementById("pd-away")', 'на экране снова три дня, третий — со своими упражнениями')],
    ['снова два дня, гибрид, и принять', click('#pd-2') + settle + mode('l:bench') + settle + click('#po-grow') + settle + click('#prog-accept') + settle + accepted
      + expect('Object.keys(' + cfgMain + '.program.slots).join() === "mon,wed" && ' + cfgMain + '.days === 2 && ' + cfgMain + '.program.focus === "bench"', 'в программе два дня, гибрид вокруг жима лежа')
      + expect('JSON.stringify(' + cfgMain + '.program.drop) === \'["pullup"]\'', 'после «Вернуть прежнюю» выбор снова по правилу: гибрид пожертвовал подтягиваниями')
      + expect('JSON.stringify(JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/"))) === sessionStorage.getItem("w0")', 'прежние записи не изменились')],
    ['тренировка: дней два', go('workout') + settle + expect('[...document.querySelector("#view .seg").querySelectorAll("button")].map(b => b.textContent).join() === "День 1,День 2"', 'в планировщике два дня')],
    ...session('день 2', 'День 2', 1, 2),
    ['журнал: новая запись — день 2, прежние — со своими днями', go('journal') + settle + journal(25) + 'const tags = [...document.querySelectorAll(".wo")].map(w => (w.querySelector(".wo-h .tag") || { textContent: "" }).textContent), fresh = [...document.querySelector("details.week").querySelectorAll(".wo")].pop();'
      + expect('fresh.querySelector(".wo-h .tag").textContent === "день 2" && tags.includes("день 3") && tags.includes("день 1") && tags.every(t => /^день [1-4]$/.test(t))', 'у новой записи «день 2», у прежних — «день 1», «день 2» и «день 3»; дней недели в метках нет')
      + expect('JSON.stringify(JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/") && JSON.parse(sessionStorage.getItem("w0")).some(y => y[0] === x[0]))) === sessionStorage.getItem("w0")', 'прежние записи по-прежнему те же')],
    ['правка прежней записи третьего дня: её день на месте', 'const card = [...document.querySelectorAll(".wo")].find(w => (w.querySelector(".wo-h .tag") || { textContent: "" }).textContent === "день 3"); [...card.querySelectorAll("button")].find(b => b.textContent.trim() === "Изменить").click();' + settle
      + expect('[...document.querySelector("#view .seg").querySelectorAll("button")].map(b => b.textContent + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join() === "День 1,День 2,День 3*"', 'среди кнопок «День программы» есть третий день, и он нажат')
      + press('День 1') + settle + expect('[...document.querySelector("#view .seg").querySelectorAll("button")].map(b => b.textContent + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join() === "День 1*,День 2,День 3"', 'после нажатия на другой день её прежний день остался среди кнопок — вернуть можно')],
    ['отмена правки', press('Отмена') + settle + journal(25)],
    ['четыре дня в неделю', go('program') + settle + click('#pd-4') + settle + expect(cfgMain + '.days === 4', 'в настройке четыре дня')
      + 'const r = ' + draftRows + ';' + expect('r.length === 4 && r.every(d => d.length > 0)', 'в новой программе четыре дня, и ни один не пуст')
      + expect('r.filter(d => d.some(t => t.startsWith("Подтягивания") && !t.includes("лёгкий"))).length === 1', 'подтягивания — в одном дне: прежняя запись третьего дня поверх программы не вернулась')
      + expect('r.every(d => d.filter(t => /^(Жим лежа|Жим ногами|Подтягивания)/.test(t) && !t.includes("лёгкий")).length <= 1) && !document.getElementById("pd-drop")', 'базовых три, дней четыре: в каждом дне не больше одного, и спрашивать, каким жертвовать, не о чем')
      + expect('!!document.querySelector("#view .grid4")', 'четыре столбца дней')
      + expect('document.querySelector("#view section.card p.sub").textContent.includes("День 3 и день 4 в ней пусты: заполнятся, когда примешь программу ниже.")', 'в строке о действующей программе сказано, что новых дней в ней нет')],
    ['что изменилось при четырёх днях', maybe(click('#prog-why:not([open]) > summary')) ],
    ['дни выровнены по длине', expect('document.getElementById("prog-why").textContent.includes("Дни выровнены по длине")', 'заметка о выравнивании дней')
      + expect('document.getElementById("prog-why").textContent.includes("Дней в неделе стало больше. Этим базовым программа жертвовала")', 'подтягивания, которыми программа на два дня пожертвовала, вернулись — и об этом сказано')
      + 'const m = ' + dayMins + ';' + expect('m.length === 4 && Math.max(...m) - Math.min(...m) <= 30', 'тренировки отличаются не больше чем на полчаса: ' )],
    ['узкий телефон: 360', size(360, 740)],
    ['большой экран', size(...BIG)],
    ['телефон', size(390, 844)],
    ['сила в одном движении при четырёх днях: два дня из четырёх', mode('s:bench') + settle + expect(draftRows + '.filter(d => d.some(t => t.startsWith("Жим лежа"))).length === 2', 'жим лежа — в двух днях из четырёх: тяжёлый и лёгкий (выводы аудита)') + expect(progNote + '.includes("Оно идёт два дня из четырёх")', 'пояснение режима — под четыре дня')],
    ['поровну и принять программу на четыре дня', mode('even') + settle + click('#prog-accept') + settle + expect('Object.keys(' + cfgMain + '.program.slots).join() === "mon,wed,fri,d4"', 'в программе четыре дня: прежние три и d4')],
    /* упражнение, которое стоит только в четвёртом дне принятой программы и которого нет в журнале: при трёх днях его нельзя убрать из справочника */
    ['типовые упражнения — в справочник', go('setup') + settle + click('#starter-add') + settle + expect('document.getElementById("toast").textContent.startsWith("Добавлено упражнений: ")', 'типовые упражнения добавлены')],
    ['вручную: упражнение только в четвёртый день', go('program') + settle + click('#pg-hand') + settle + pick('#pa-d4', 'cable_crunch') + click('#pb-d4') + settle + click('#prog-accept') + settle + accepted
      + 'const P4 = ' + cfgMain + '.program.slots;' + expect('P4.d4.some(e => e.ex === "cable_crunch") && !["mon", "wed", "fri"].some(d => P4[d].some(e => e.ex === "cable_crunch"))', '«Скручивания на блоке» — только в четвёртом дне программы')],
    ['три дня: четвёртый день вне недели', click('#pd-3') + settle + expect('!!document.getElementById("pd-away") && document.getElementById("pd-away").textContent.startsWith("День 4 сейчас не в неделе: ")', 'подсказка о четвёртом дне')],
    ['настройка: упражнение четвёртого дня не убрать', go('setup') + settle + click('#setup-more > summary') + settle + expect('!!document.getElementById("ex-del-lunge")', 'у упражнения, которого нет ни в программе, ни в журнале, «Убрать» есть')
      + expect('!document.getElementById("ex-del-cable_crunch")', 'у упражнения четвёртого дня её нет: день вернётся вместе с числом дней')],
    ['снова четыре дня', go('program') + settle + click('#pd-4') + settle + expect(cfgMain + '.days === 4 && !document.getElementById("pd-away")', 'четыре дня, подсказки нет')],
    ['тренировка: дней четыре', go('workout') + settle + expect('[...document.querySelector("#view .seg").querySelectorAll("button")].map(b => b.textContent).join() === "День 1,День 2,День 3,День 4"', 'в планировщике четыре дня')],
    /* в четвёртом дне базового нет (их три), поэтому тренировка — только подсобка */
    ['день 4: план', go('workout') + settle + press('День 4') + settle + typeDay('#np-date', 2)],
    ['день 4: старт', press('Начать тренировку') + settle + expect('!document.querySelector(".cyc-sets") && document.querySelectorAll("input[id^=\'r-\']").length > 0', 'в четвёртом дне нет базового по процентам, есть подсобка')],
    ['день 4: подходы', typeAll('input[id^="r-"]', 10)],
    ['день 4: завершить', FINISH],
    ['журнал: запись четвёртого дня', go('journal') + settle + journal(26) + expect('[...document.querySelector("details.week").querySelectorAll(".wo")].pop().querySelector(".wo-h .tag").textContent === "день 4"', 'у новой записи «день 4»')],
    ['обзор', go('overview')],
    ['мышцы', go('muscles')],
    ['после перезагрузки дней по-прежнему четыре', RELOAD],
    ['программа после перезагрузки', go('program') + settle + expect('document.getElementById("pd-4").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#view section.card")[0].querySelectorAll(".pday").length === 4', 'выбрано четыре дня, в действующей программе четыре столбца')],
    ['второй профиль: дней три', pick('#prof', 'p2') + settle + go('program') + settle + expect('document.getElementById("pd-3").getAttribute("aria-pressed") === "true" && [...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday").length === 3', 'у второго профиля своё число дней')],
    ['первый профиль: снова три дня', pick('#prof', 'me') + settle + go('program') + settle + click('#pd-3') + settle + expect('!("days" in ' + cfgMain + ') && [...document.querySelectorAll("#view section.card")].pop().querySelectorAll(".pday").length === 3', 'три дня: поля в настройке нет')
      + expect('!document.getElementById("prog-undo") && document.querySelector("#view section.card p.sub").textContent.includes("Ещё не было по ней: день 1, день 2 и день 3.")', 'по программе уже была тренировка — в четвёртом дне, которого теперь нет в неделе: «Вернуть прежнюю» не предлагается')
      + expect('JSON.stringify(JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/") && JSON.parse(sessionStorage.getItem("w0")).some(y => y[0] === x[0]))) === sessionStorage.getItem("w0")', 'прежние записи так и не изменились')]
  ] },

  /* упражнение, которое не успеваешь, и время по факту (просьба владельца, 25 ноября 2026; docs/03, раздел 20): разгибания ног два раза подряд не сделаны
     во втором дне — дневник убирает их из плана и переносит в другой день; время, названное в конце тренировки, поправляет его оценку */
  { name: 'время по факту и «Не делал два раза»', data: 'seed', app: true, steps: [
    ...[[0, 100], [7, 105]].flatMap(([d, min], i) => [
      ['день 2, неделя ' + (i + 1) + ': план', go('workout') + settle + press('День 2') + settle + typeDay('#np-date', d) + settle
        + expect('!document.getElementById("view").textContent.includes("Не делал два раза")', 'поправки ещё нет: пропусков меньше двух')],
      ['день 2, неделя ' + (i + 1) + ': старт', press('Начать тренировку') + (i ? '' : settle
        /* раскладка разминки (просьба владельца, 25 ноября 2026; docs/03, раздел 17): первое упражнение на мышцу в тренажёре — один подход на 70%,
           базовое — два, 50% и 80%; бицепс уже работал в тяге — без разминки */
        + expect('/^Разминка, кг: [\\d.]+ × 5$/.test(' + exCard('Разгибания ног') + '.querySelector(".warm").textContent)', 'перед разгибаниями ног — один разминочный подход')
        + expect('/^Разминка, кг: [\\d.]+ × 6 · [\\d.]+ × 3$/.test(' + exCard('Жим ногами') + '.querySelector(".warm").textContent)', 'перед жимом ногами — два')
        + expect('!' + exCard('Бицепс со штангой') + '.querySelector(".warm")', 'бицепс уже работал в тяге — разминки нет'))],
      ['день 2, неделя ' + (i + 1) + ': разгибания ног — «не делал», остальное сделано', exCard('Разгибания ног') + '.querySelector("button[aria-label=\'Отметить «не делал»\']").click();' + settle + typeAll('input[id^="r-"]', 10)],
      ['день 2, неделя ' + (i + 1) + ': завершить — сколько шла', press('Завершить тренировку') + settle
        + expect('!!document.getElementById("wk-min") && /^\\d+$/.test(document.getElementById("wk-min").placeholder)', 'дневник спрашивает время, в подсказке — его оценка')],
      ['день 2, неделя ' + (i + 1) + ': время и завершить', type('#wk-min', min) + press('Завершить') + settle
        + expect(savedW + '.find(w => w.date === __t.day(' + d + ')).min === ' + min, 'в записи тренировки — названные минуты')]
    ]),
    ['день 2, неделя 3: в плане поправка', go('workout') + settle + press('День 2') + settle + typeDay('#np-date', 14) + settle
      + expect('document.getElementById("view").textContent.includes("Не делал два раза") && ' + skipRow + '.textContent.includes("в День 1")', 'разгибания ног остались строкой плана: уходят в день 1')
      + expect('document.getElementById("view").textContent.includes("Оценка — по твоему темпу")', 'время плана — по темпу атлета')],
    ['снять поправку галочкой', click('#pp-leg_ext') + settle + expect('!' + skipRow + '.textContent.includes("в День 1")', 'разгибания ног снова в плане')],
    ['вернуть поправку', click('#pp-leg_ext') + settle + expect(skipRow + '.textContent.includes("в День 1")', 'поправка снова в плане')],
    ['старт: убранное — отдельным блоком', press('Начать тренировку') + settle + expect('!!document.getElementById("back-leg_ext") && !' + exCard('Разгибания ног'), 'карточки нет, в блоке «Дневник убрал из плана» — «Вернуть»')],
    ['вернуть упражнение', click('#back-leg_ext') + settle + expect('!document.getElementById("back-leg_ext") && !!' + exCard('Разгибания ног'), 'карточка на месте')],
    /* в идущей тренировке у упражнения только «не делал», крестика «убрать» нет (просьба владельца, 26 ноября 2026): передумал — тренировка начинается заново */
    ['крестика «убрать» нет', expect('!' + exCard('Разгибания ног') + '.querySelector("button[aria-label=\'Убрать упражнение\']") && !!' + exCard('Разгибания ног') + '.querySelector("button[aria-label=\'Отметить «не делал»\']")', 'у вернувшегося упражнения — только «не делал»')],
    ['передумал: отменить и начать снова', press('Отменить') + settle + press('Удалить тренировку') + settle + go('workout') + settle + press('День 2') + settle + typeDay('#np-date', 14) + settle + press('Начать тренировку') + settle
      + expect('!!document.getElementById("back-leg_ext") && !' + exCard('Разгибания ног'), 'упражнение снова в блоке «Дневник убрал из плана»')],
    ['подходы', typeAll('input[id^="r-"]', 10)],
    ['завершить без него', FINISH + settle + expect('document.getElementById("toast").textContent === "Тренировка сохранена. Программа поправлена: Разгибания ног в тренажере — в День 1"', 'сообщение называет перенос')],
    ['программа: разгибания ног в дне 1', go('program') + settle + 'const P = ' + cfgMain + '.program;'
      + expect('P.name === "Своя программа" && P.slots.mon.some(e => e.ex === "leg_ext") && !P.slots.wed.some(e => e.ex === "leg_ext")', 'перенос записан в программу')],
    ['день 1: в плане разгибания ног', go('workout') + settle + press('День 1') + settle + typeDay('#np-date', 19) + settle
      + expect('[...document.querySelectorAll("#view .plan-row")].some(r => r.textContent.startsWith("Разгибания ног в тренажере"))', 'день 1 получил упражнение')],
    ['журнал: время в законченной записи', go('journal') + settle + press('Изменить') + settle + expect('document.getElementById("wk-min").value === ""', 'у последней тренировки время не названо')],
    ['время записи', type('#wk-min', 70) + press('Сохранить изменения') + settle + expect(savedW + '.find(w => w.date === __t.day(14)).min === 70', 'время записано')]
  ] },

  /* программа короче, когда не успеваешь (просьба владельца, 25 ноября 2026; docs/03, раздел 20): программа принята под 1 ч 30 мин, а тренировки идут
     около двух часов. После двух таких тренировок дневник только считает время по темпу; после третьей сам собирает программу той же цели под то же время,
     уже с темпом, и принимает её. «Вернуть прежнюю» отменяет сокращение, и ту программу дневник больше сам не сокращает */
  { name: 'программа короче, когда не успеваешь', data: 'seed', app: true, steps: [
    ['программа под полтора часа', go('program') + settle + pick('#pt', 90) + settle + click('#prog-accept') + settle + accepted
      + expect(cfgMain + '.program.fit.time === 90 && !' + cfgMain + '.program.trim', 'программа принята под 1 ч 30 мин')],
    ...[[1, 0], [2, 2], [3, 4]].flatMap(([n, d]) => [
      ['день ' + n + ': план', go('workout') + settle + press('День ' + n) + settle + typeDay('#np-date', d)],
      ['день ' + n + ': старт и подходы', press('Начать тренировку') + settle + typeAll('input[id^="r-"]', 10)],
      ['день ' + n + ': шла 1 ч 58 мин', press('Завершить тренировку') + settle + type('#wk-min', 118) + press('Завершить') + settle
        + (n < 3 ? expect(toastIs('Тренировка сохранена') + ' && !' + cfgMain + '.program.trim', 'программа та же: долгих тренировок с ответом пока меньше трёх')
          : expect('document.getElementById("toast").textContent.startsWith("Тренировка сохранена. Программа сокращена под 1 ч 30 мин: тренировки идут ×1.3 к расчёту, подходов в неделю 77 → 53")', 'сообщение: программа сокращена, почему и насколько')
            + expect('(t => t && t.k === 1.3 && t.time === 90 && t.to < t.from)(' + cfgMain + '.program.trim) && ' + cfgMain + '.program.fit.time === 90', 'новая программа под то же время, подходов меньше'))]
    ]),
    ['план: строка о сокращении', go('workout') + settle + press('День 1') + settle + typeDay('#np-date', 7) + settle
      + expect('!!document.getElementById("trim-note") && document.getElementById("trim-note").textContent.startsWith("Дневник сократил программу под 1 ч 30 мин")', 'над планом сказано, что программу сократил дневник')
      + expect('(m => m && (+m[1] || 0) * 60 + (+m[2] || 0) <= 90)(document.getElementById("view").textContent.match(/≈ (?:(\\d+) ч)?\\s*(?:(\\d+) мин)?/))', 'план с поправками дневника укладывается в 1 ч 30 мин по темпу')],
    ['программа: кто сократил', go('program') + settle + expect('document.getElementById("view").textContent.includes("Сократил дневник: тренировки шли ×1.3 к расчёту")', 'в строке о программе — что её сократил дневник')],
    ['вернуть прежнюю', click('#prog-undo') + settle + expect(cfgMain + '.program.trimOff === true && !' + cfgMain + '.program.trim && ' + cfgMain + '.program.fit.time === 90', 'прежняя программа вернулась, дневник её больше сам не сокращает')],
    ['день 1: план', go('workout') + settle + press('День 1') + settle + typeDay('#np-date', 7) + settle + expect('!document.getElementById("trim-note")', 'строки о сокращении нет')],
    ['день 1: старт и подходы', press('Начать тренировку') + settle + typeAll('input[id^="r-"]', 10)],
    ['день 1: снова долго', press('Завершить тренировку') + settle + type('#wk-min', 118) + press('Завершить') + settle
      + expect(toastIs('Тренировка сохранена') + ' && !' + cfgMain + '.program.trim', 'программа не сокращена: атлет её вернул')]
  ] },

  /* программа второго профиля: приоритет «ягодицы» при лимите 60, известные веса, первая тренировка */
  { name: 'программа второго профиля', steps: [
    ['второй профиль', pick('#prof', 'p2')],
    ['программа', go('program')],
    ['вручную', mode('manual')],
    ['равномерно', mode('even')],
    ['приоритет: ягодицы', mode('m:glutes')],
    ['лимит недели 50', maybe(pick('#pb-budget', 50))],
    ['лимит недели 60', maybe(pick('#pb-budget', 60))],
    ['что изменилось и почему', maybe(click('#prog-why > summary'))],
    ['убавить передним дельтам', click('#mn-delt_front')],
    ['прибавить разгибателям спины', click('#mp-erectors')],
    ['известные веса: рабочий', go('setup') + settle + type('input[id^="kw-work-"]', 40)],
    ['известные веса: повторы', type('input[id^="kw-workR-"]', 8)],
    ['известные веса: максимум у другого', type('input[id^="kw-max-"]', 55, 1)],
    ['программа со стартовыми весами', go('program')],
    ['принять', click('#prog-accept')],
    ['обзор второго профиля', go('overview')],
    ['план второго профиля', go('workout')],
    ['старт', press('Начать тренировку')],
    ['подходы', typeAll('input[id^="w-"]', 30) + typeAll('input[id^="r-"]', 10)],
    ['завершить', FINISH],
    ['программа второго профиля после первой тренировки', go('program')],
    ['настройка второго профиля: известные веса ушли в журнал', go('setup')],
    ['в первый профиль', pick('#prof', 'me')],
    ['своя программа прежняя', go('program')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* только в приложении: новый профиль без копии упражнений получает встроенный справочник, а не пустой список */
  { name: 'новый профиль без копии упражнений', app: true, steps: [
    ['настройка', go('setup') + settle + click('#setup-more > summary')],
    ['профиль без копии упражнений', click('#pr-copy') + type('#pr-new', 'Новичок') + click('#pr-add') + settle
      + expect('document.getElementById("prof").selectedOptions[0].textContent === "Новичок"', 'открыт профиль «Новичок»')],
    ...APP_TABS.map(v => opens(v, 'у новичка')),
    ['у новичка встроенный справочник', go('setup') + settle + expect(chips + ' === 63', '63 упражнения на снарядах') + expect(looseN + ' === "0"', '«без снаряда» пусто')],
    ['своё упражнение сверх списка', click('#ex-new') + settle + type('#nx-n', 'Подъём гантелей перед собой') + click('#nx-save') + settle + expect(chips + ' === 64', 'упражнений стало 64')],
    ['название из списка повторить нельзя', click('#ex-new') + settle + type('#nx-n', 'жим лежа') + click('#nx-save') + settle + expect(toastIs('Такое упражнение уже есть'), 'сообщение «Такое упражнение уже есть»') + press('Отмена')],
    ['программа вручную: в понедельник', go('program') + settle + pickAt('#pa-mon', 0) + click('#pb-mon')],
    ['программа вручную: в пятницу', pickAt('#pa-fri', -1) + click('#pb-fri')],
    ['принять', click('#prog-accept') + settle + expect('document.getElementById("toast").textContent.startsWith("Программа принята")', 'сообщение «Программа принята»')],
    ['первая тренировка: план понедельника', go('workout') + settle + press('Понедельник')],
    ['старт', press('Начать тренировку')],
    ['подходы', typeAll('input[id^="w-"]', 20) + typeAll('input[id^="r-"]', 12)],
    ['завершить', FINISH],
    ['журнал новичка: одна запись', go('journal') + settle + journal(1)],
    ['после перезагрузки открыт тот же профиль', RELOAD],
    ['профиль и справочник на месте', go('setup') + settle + expect('document.getElementById("prof").selectedOptions[0].textContent === "Новичок"', 'открыт профиль «Новичок»') + expect(chips + ' === 64', '64 упражнения на снарядах')],
    ['первый профиль не изменился', 'sessionStorage.setItem("n", String(JSON.parse(' + stored + ').filter(x => x[0].startsWith("workouts/")).length));' + pick('#prof', 'me') + settle + go('journal') + settle
      + expect('document.querySelectorAll(".wo").length === +sessionStorage.getItem("n")', 'в своём журнале столько же записей, сколько в хранилище')]
  ] },

  /* только в приложении: встроенный справочник для профиля со своими упражнениями. Сам он ничего не меняет — только по кнопкам:
     разложить по снарядам то, что лежит «без снаряда», добавить упражнения списка, которых нет, убрать неиспользуемое упражнение */
  { name: 'справочник: разложить, добавить, убрать', app: true, steps: [
    ['план до раскладки', go('workout') + settle + 'sessionStorage.setItem("plan", document.getElementById("view").innerText);'],
    ['настройка: есть что разложить и добавить', go('setup') + settle + expect('!!document.getElementById("starter-sort") && !!document.getElementById("starter-add")', 'кнопки «Разложить по снарядам» и «Типовые упражнения»')
      + expect(looseN + ' !== "0"', 'есть упражнения без снаряда') + 'sessionStorage.setItem("n", String(' + chips + ')); sessionStorage.setItem("loose", ' + looseN + ');'],
    ['разложить по снарядам', click('#starter-sort') + settle + expect(looseN + ' === "0"', '«без снаряда» пусто') + expect('!document.getElementById("starter-sort")', 'кнопка «Разложить» исчезла')
      + expect('document.getElementById("toast").textContent === "Разложено по снарядам: " + sessionStorage.getItem("loose")', 'сообщение с числом разложенных') + expect(chips + ' === +sessionStorage.getItem("n")', 'упражнений столько же')],
    ['план после раскладки тот же', go('workout') + settle + expect('document.getElementById("view").innerText === sessionStorage.getItem("plan")', 'раскладка по снарядам не изменила план: шаг веса у упражнений прежний')],
    ['добавить типовые упражнения', go('setup') + settle + click('#starter-add') + settle + expect('document.getElementById("toast").textContent === "Добавлено упражнений: " + (63 - +sessionStorage.getItem("n"))', 'сообщение с числом добавленных')
      + expect(chips + ' === 63', 'упражнений стало 63') + expect(looseN + ' === "0"', '«без снаряда» пусто') + expect('!document.getElementById("starter-tools")', 'кнопок справочника больше нет')],
    ['в списке дня программы есть типовые', go('program') + settle + mode('manual') + settle + expect('[...document.querySelectorAll("#pa-mon option")].some(o => o.value === "face_pull")', 'в списке понедельника есть «Тяга к лицу на блоке»')],
    ['справочник: «Убрать» только у неиспользуемого', go('setup') + settle + click('#setup-more > summary') + settle + expect('!!document.getElementById("ex-del-cable_crunch")', 'у «Скручиваний на блоке» есть «Убрать»')
      + expect('!document.getElementById("ex-del-bench")', 'у упражнения из журнала кнопки «Убрать» нет')],
    ['убрать упражнение', click('#ex-del-cable_crunch') + settle + expect(toastIs('Убрано из справочника: Скручивания на блоке'), 'сообщение «Убрано из справочника»') + expect(chips + ' === 62', 'упражнений стало 62')
      + expect('document.getElementById("starter-add").textContent.trim() === "Типовые упражнения: 1"', 'убранное можно вернуть кнопкой «Типовые упражнения: 1»')],
    ['после перезагрузки то же', RELOAD],
    ['справочник после перезагрузки', go('setup') + settle + expect(chips + ' === 62', '62 упражнения на снарядах') + expect(looseN + ' === "0"', '«без снаряда» пусто')]
  ] },

  /* промежуточные ширины экрана: разметка от ширины зависит только в графиках, а страница нигде не должна стать шире экрана */
  { name: 'ширины экрана', steps: WIDTHS.flatMap(([w, h]) => [['ширина ' + w, size(w, h)], ...tabs('при ширине ' + w)]) },

  { name: 'советы', steps: [
    ['советы', maybe(tab('coach'))],
    ['раздел из первого замечания', maybe(click('.ins a.btn'))],
    ['советы снова', maybe(tab('coach'))],
    ['раздел из третьего замечания', maybe(click('.ins a.btn', 2))],
    ['большой экран', size(...BIG)],
    ['советы на большом экране', maybe(tab('coach'))]
  ] },

  { name: 'советы: сохранённый разбор', data: 'notes', steps: [
    ['советы', maybe(tab('coach'))],
    ['резервная копия хранит разбор', go('setup') + settle + click('#setup-more > summary') + settle + click('#backup-all')],
    ['после перезагрузки то же', RELOAD]
  ] },

  /* только в приложении: лишнего на экранах нет (решение владельца, 25 ноября 2026) — вкладки «Советы» нет, на «Обзоре» сверху две плитки
     и нет блока «Требует внимания», на «Тренировке» нет выбора «Вариант плана»: план всегда с поправками дневника, снять можно каждую галочкой */
  { name: 'лишнего на экранах нет', data: 'seed', app: true, steps: [
    ['меню: семь вкладок, «Советов» нет', go('overview') + settle + expect('[...document.querySelectorAll("#tabs a")].map(a => a.getAttribute("href")).join() === "#overview,#workout,#journal,#progress,#muscles,#program,#setup"', 'в меню семь вкладок, «Советов» среди них нет')],
    ['обзор: две плитки, без «Требует внимания»', expect('[...document.querySelectorAll("#view .tiles.two .tile .l")].map(e => e.textContent).join() === "Тренировок записано,Индекс силы" && ![...document.querySelectorAll("#view h2")].some(e => e.textContent === "Требует внимания") && !document.querySelector("#view a[href=\\"#coach\\"]")', 'сверху только «Тренировок записано» и «Индекс силы», блока «Требует внимания» и ссылки на советы нет')],
    ['адрес «Советов» открывает обзор', go('coach') + settle + expect('location.hash === "#coach" && !!document.querySelector("#view .tiles.two") && document.querySelector("#tabs a[aria-current=page]").getAttribute("href") === "#overview"', 'по адресу #coach открыт «Обзор»')],
    ['план: с поправками, выбора варианта нет', go('workout') + settle + expect('!document.querySelector("#view [aria-label=\\"Вариант плана\\"]") && !document.getElementById("view").innerText.includes("Только по моим правилам") && document.querySelectorAll("#view input[id^=\\"pp-\\"]").length > 1 && [...document.querySelectorAll("#view input[id^=\\"pp-\\"]")].every(e => e.checked) && document.querySelectorAll("#view .plan-row .tag.accent").length > 0', 'план с поправками дневника, все включены, переключателя варианта нет')],
    ['снять поправку галочкой', click('input[id^="pp-"]') + settle + expect('!document.querySelector("#view input[id^=\\"pp-\\"]").checked && [...document.querySelectorAll("#view input[id^=\\"pp-\\"]")].slice(1).every(e => e.checked) && !document.querySelector("#view [aria-label=\\"Вариант плана\\"]")', 'первая поправка снята, остальные на месте')],
    ['после перезагрузки', RELOAD],
    ['план после перезагрузки снова со всеми поправками', go('workout') + settle + expect('[...document.querySelectorAll("#view input[id^=\\"pp-\\"]")].every(e => e.checked) && !document.querySelector("#view [aria-label=\\"Вариант плана\\"]")', 'после перезагрузки все поправки снова включены')],
    /* просьбы владельца 26 ноября 2026: в шапке нет названия и «записи на устройстве»; идущая тренировка без диапазона, прошлого раза, ориентиров, стрелок, «убрать» и поправок */
    ['шапка без названия и «записи на устройстве»', expect('getComputedStyle(document.querySelector(".top .brand")).display === "none" && getComputedStyle(document.getElementById("sync")).display === "none"', 'названия приложения и статуса «записи на устройстве» не видно')],
    ['идущая тренировка: без ориентиров', press('Начать тренировку') + settle + expect('document.querySelectorAll("#view input[id^=\\"w-\\"]").length > 0 && document.querySelectorAll("#view button[aria-label=\\"Отметить «не делал»\\"]").length > 0 && !document.querySelector("#view input[id^=\\"rng-\\"], #view .set .track, #view .set .prev, #view .adj-box, #view button[aria-label=\\"Переместить выше\\"], #view button[aria-label=\\"Переместить ниже\\"], #view button[aria-label=\\"Убрать упражнение\\"]") && !document.getElementById("view").innerText.includes("прошлый раз") && [...document.querySelectorAll("#view input[id^=\\"r-\\"]")].every(e => !e.placeholder)', 'у подходов только вес, повторы и запас, у упражнения — «не делал»: без диапазона, прошлого раза, ориентиров, стрелок, «убрать» и поправок')]
  ] },

  /* только в приложении: загрузка резервной копии с экрана */
  { name: 'загрузка копии', data: 'empty', app: true, steps: [
    ['пустое приложение: есть кнопка загрузки', go('overview') + settle + expect('!!document.getElementById("onb-import")', 'в онбординге пустого дневника есть кнопка «Перенести записи из файла»')],
    ['не тот файл', loadCopy('"это не копия"') + settle + expect(box + ' && ' + box + '.textContent.includes("Копия не загружена")', 'сообщение «Копия не загружена»')],
    ['понятно', press('Понятно') + settle + expect('!' + box, 'сообщение закрыто')],
    ['чужой файл', loadCopy('JSON.stringify({ format: "other", version: 1 })') + settle + expect(box + ' && ' + box + '.textContent.includes("Копия не загружена")', 'чужой файл не принят') + press('Понятно')],
    ['копия новее приложения', loadCopy('JSON.stringify({ format: "training-diary-backup", version: 99, profiles: [] })') + settle + expect(box + ' && ' + box + '.textContent.includes("Копия не загружена")', 'копия новой версии не принята') + press('Понятно')],
    ['верная копия: видно, что внутри', loadCopy('__t.pack') + settle + expect(box + '.textContent.includes("Загрузить копию от") && ' + box + '.textContent.includes("24 тренировки") && ' + box + '.textContent.includes("Сейчас в нём записей нет")', 'состав копии и что сейчас записей нет')
      /* справочники примерных данных — неполные, как у копии первой версии: загрузка дополнит их встроенным (решение владельца, 25 ноября 2026) */
      + expect('document.getElementById("import-fill").textContent === "Справочник дополнится встроенным — «Мой дневник»: на снаряды — 6, новых упражнений — 40; «Второй профиль»: на снаряды — 5, новых упражнений — 30."', 'видно, как дополнится справочник каждого профиля')],
    ['отмена: записи не тронуты', press('Отмена') + settle + expect('!' + box + ' && ' + stored + ' === "[]"', 'после отмены в хранилище пусто')],
    ['заменить записи', loadCopy('__t.pack') + settle + click('#import-go') + settle + expect('document.getElementById("toast").textContent === "Копия загружена: 24 тренировки"', 'сообщение о загрузке 24 тренировок')
      + expect('JSON.parse(' + stored + ').length === 27', 'в хранилище 27 документов: список профилей, две настройки и 24 тренировки')
      + expect('JSON.parse(' + stored + ').filter(x => x[0].startsWith("config/") && x[1].ex).map(x => Object.keys(x[1].ex).length).join() === "63,63"', 'в справочнике каждого профиля 63 упражнения')],
    ['настройка: все упражнения на снарядах', go('setup') + settle + expect(chips + ' === 63 && ' + looseN + ' === "0" && !document.getElementById("starter-tools")', '63 упражнения на снарядах, «без снаряда» пусто, разложить и добавить нечего')],
    ['журнал: 24 записи', go('journal') + settle + expect('document.querySelectorAll(".wo").length === 24', 'в журнале 24 записи')],
    ['второй профиль на месте', expect('[...document.getElementById("prof").options].map(o => o.textContent).join() === "Мой дневник,Второй профиль"', 'в шапке два профиля')],
    ['после перезагрузки записи на месте', RELOAD],
    ['журнал после перезагрузки', expect('document.querySelectorAll(".wo").length === 24', 'в журнале 24 записи после перезагрузки')]
  ] },

  /* только в приложении: база браузера недоступна — приложение говорит об этом и не падает */
  { name: 'хранилище недоступно', data: 'empty', app: true, noStore: true, steps: [
    ['сообщение о сбое', go('overview') + settle + expect('!!document.querySelector(".banner.crit") && document.querySelector(".banner.crit").textContent.startsWith("Хранилище на этом устройстве недоступно")', 'сообщение о недоступном хранилище')
      + expect('document.getElementById("sync").textContent.trim() === "хранилище недоступно"', 'пометка в шапке «хранилище недоступно»')],
    ...TABS.slice(1).map(v => [v + ': открывается с тем же сообщением', go(v) + settle + expect('!!document.querySelector(".banner.crit")', 'сообщение о сбое на вкладке ' + v)])
  ] },

  /* справочники примерных данных неполные, а загрузка копии дополняет их встроенным: сначала они дополняются кнопками —
     полный справочник загрузка возвращает как есть, и записи после загрузки те же */
  { name: 'копия туда и обратно', app: true, steps: [
    ['полный справочник: первый профиль', go('setup') + settle + click('#starter-sort') + settle + click('#starter-add') + settle + expect('!document.getElementById("starter-tools")', 'разложить и добавить нечего')],
    ['полный справочник: второй профиль', pick('#prof', 'p2') + settle + go('setup') + settle + click('#starter-sort') + settle + click('#starter-add') + settle + expect('!document.getElementById("starter-tools")', 'разложить и добавить нечего')],
    ['настройка', pick('#prof', 'me') + settle + go('setup') + settle + click('#setup-more > summary')],
    ['сохранить копию', 'sessionStorage.setItem("keep", ' + stored + ');' + click('#backup-all') + settle + 'const s = JSON.parse((await __t.look()).saved || "null");'
      + expect('s && /^dnevnik-backup-\\d{4}-\\d\\d-\\d\\d\\.json$/.test(s.filename)', 'имя файла копии с датой') + 'sessionStorage.setItem("file", s.text);'],
    ['испортить записи: удалить тренировку', go('journal') + settle + press('Удалить') + settle + click('.wo .btn.sm.danger:not(.ghost)') + settle + expect(stored + ' !== sessionStorage.getItem("keep")', 'записи изменились')],
    ['загрузить сохранённую копию', go('setup') + settle + loadCopy('sessionStorage.getItem("file")') + settle + expect(box + ' && ' + box + '.textContent.includes("Сейчас в нём")', 'видно, сколько записей будет заменено')
      + expect('!document.getElementById("import-fill")', 'справочники полные: дополнять нечего') + click('#import-go')],
    ['записи те же, что до правки', expect(stored + ' === sessionStorage.getItem("keep")', 'после загрузки копии записи совпадают с сохранёнными')],
    ['сначала сохранить нынешние', loadCopy('sessionStorage.getItem("file")') + settle + press('Сначала сохранить нынешние') + settle + 'const s = JSON.parse((await __t.look()).saved || "null");'
      + expect('s && JSON.stringify(JSON.parse(s.text).profiles) === JSON.stringify(JSON.parse(sessionStorage.getItem("file")).profiles)', 'копия нынешних записей совпадает с загружаемой') + press('Отмена')],
    ['после перезагрузки записи те же', RELOAD],
    ['сверка после перезагрузки', expect(stored + ' === sessionStorage.getItem("keep")', 'после перезагрузки записи совпадают с сохранёнными')]
  ] }
];
