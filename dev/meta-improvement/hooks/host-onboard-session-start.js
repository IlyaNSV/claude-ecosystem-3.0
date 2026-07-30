#!/usr/bin/env node
/**
 * host-onboard-session-start.js — автозагрузка онбординг-пака кондуктора (DEC-DEV-0222;
 * env-гейт снят — DEC-DEV-0232, пакет 3).
 *
 * ГЕЙТ СРАБАТЫВАНИЯ (иначе тихий exit 0 — обычные сессии не получают ни байта):
 *   (а) env `CONDUCTOR_SESSION` truthy — явный ручной путь, остаётся как был:
 *         PowerShell:  $env:CONDUCTOR_SESSION = "1"; claude
 *         Git Bash:    CONDUCTOR_SESSION=1 claude
 *   (б) ДЕТЕКТ РОЛИ ПО ФАКТУ — cwd внутри worktree кондуктора (`ce3-wt-global-loop`)
 *       ИЛИ текущая ветка чекаута = `docs/global-loop-assist-ledger`.
 *
 * ПОЧЕМУ ДЕТЕКТ, А НЕ ТОЛЬКО ENV (урок M15 §5 п.1 — «детект роли по факту»):
 *   измерение показало 3 из 3: пост-хуковые кондуктор-сессии пак НЕ получили — env
 *   просто не выставлялся при запуске. Механизм, срабатывание которого зависит от
 *   человеческой памяти о переменной окружения, носителем принуждения не является:
 *   гейт был зелёный, а пак не доезжал. Роль сессии видна из фактов чекаута — их
 *   и спрашиваем; env остаётся явным ручным путём (форс из любой директории).
 *
 * Лимит вывода хука ~10k символов, полный пак ~120KB ⇒ пак пишется во временный файл,
 * в контекст инжектится сводка + императив «прочитай файл Read'ом ПЕРВЫМ действием».
 *
 * Ветвление по source (stdin JSON от харнесса):
 *   startup/clear → собрать пак в файл + инжект сводки с императивом чтения;
 *   compact       → короткое напоминание-указатель (пак уже был в контексте до компактации);
 *   resume        → тишина (контекст живой, дублировать нечего).
 *
 * Регистрация — .claude/settings.local.json → hooks.SessionStart, группа БЕЗ matcher
 * (хук сам ветвится по source):
 *   { "type": "command", "command": "node dev/meta-improvement/hooks/host-onboard-session-start.js" }
 *
 * Контракт хуков репо: non-blocking, fail-silent (любая ошибка → exit 0 без вывода).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/** Ветка-дом ассист-леджера Волны 0 и имя worktree кондуктора. */
const CONDUCTOR_BRANCH = 'docs/global-loop-assist-ledger';
const CONDUCTOR_WORKTREE = 'ce3-wt-global-loop';

function emit(context) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
}

/** Явный ручной путь: env-переменная (сохранён из DEC-DEV-0222). */
function conductorEnvSet() {
  const flag = String(process.env.CONDUCTOR_SESSION || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/**
 * Детект роли по факту чекаута. Сначала cwd (бесплатно), потом ветка (spawn git —
 * платим ~десятки мс только если по cwd не опознали). Любая ошибка = «не роль».
 */
function conductorRoleDetected() {
  const cwd = String(process.cwd() || '');
  if (cwd.includes(CONDUCTOR_WORKTREE)) return true;
  try {
    const branch = execSync('git branch --show-current', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch === CONDUCTOR_BRANCH) return true;
  } catch (_e) { /* не git-чекаут / git недоступен — роль не подтверждена */ }
  return false;
}

try {
  // Причина срабатывания называется в инжекте дословно: сессия должна знать, ЧЕМ она
  // опознана как кондуктор (env-форс vs факт чекаута) — иначе хук врёт о своём триггере.
  const trigger = conductorEnvSet()
    ? 'env CONDUCTOR_SESSION'
    : conductorRoleDetected()
      ? `детект роли по чекауту (${CONDUCTOR_WORKTREE} / ${CONDUCTOR_BRANCH})`
      : null;
  if (!trigger) process.exit(0);

  let source = 'startup';
  try {
    const raw = fs.readFileSync(0, 'utf8');
    const j = JSON.parse(raw || '{}');
    if (j.source) source = String(j.source);
  } catch (_e) { /* stdin пуст/не JSON — считаем startup */ }

  if (source === 'resume') process.exit(0);

  const { buildPack, defaultOutPath } = require(path.join(__dirname, '..', 'scripts', 'host-onboard.cjs'));
  const packFile = defaultOutPath();

  if (source === 'compact') {
    emit(
      `Сессия-кондуктор (${trigger}): онбординг-пак загружался на старте, после ` +
      `компактации детали могли усечься. При первой неуверенности в каноне/инвариантах — ` +
      `перечитай пак: Read ${packFile} (файла нет — перегенерируй: ` +
      `node dev/meta-improvement/scripts/host-onboard.cjs --out).`
    );
    process.exit(0);
  }

  // startup / clear — полный цикл: собрать свежий пак → файл → императив чтения
  const pack = buildPack({});
  fs.writeFileSync(packFile, pack.text, 'utf8');
  const lines = pack.text.split('\n').length;

  emit([
    `Эта сессия опознана как КОНДУКТОР — ${trigger}.`,
    `Онбординг-пак хост-сессии собран из живых файлов и записан: ${packFile} (~${pack.total} ток., ${lines} строк).`,
    `ОБЯЗАТЕЛЬНОЕ ПЕРВОЕ ДЕЙСТВИЕ: прочитай пак целиком инструментом Read (${lines > 2000 ? 'строк больше 2000 — дочитай offset-вызовами' : 'один вызов Read'}) ДО любой другой работы, затем кратко подтверди владельцу загрузку (секции, ~токены, warn-строки ненайденных файлов).`,
    '',
    'Состав пака:',
    pack.summary,
  ].join('\n'));
  process.exit(0);
} catch (_e) {
  process.exit(0);
}
