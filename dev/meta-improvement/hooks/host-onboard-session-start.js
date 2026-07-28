#!/usr/bin/env node
/**
 * host-onboard-session-start.js — env-гейт автозагрузки онбординг-пака кондуктора (DEC-DEV-0222).
 *
 * Fires ТОЛЬКО когда сессия запущена с CONDUCTOR_SESSION=1 (иначе тихий exit 0 —
 * обычные сессии не получают ни байта). Запуск владельцем:
 *   PowerShell:  $env:CONDUCTOR_SESSION = "1"; claude
 *   Git Bash:    CONDUCTOR_SESSION=1 claude
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

function emit(context) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
}

try {
  const flag = String(process.env.CONDUCTOR_SESSION || '').trim().toLowerCase();
  if (flag !== '1' && flag !== 'true' && flag !== 'yes') process.exit(0);

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
      `Сессия-кондуктор (CONDUCTOR_SESSION=1): онбординг-пак загружался на старте, после ` +
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
    'Эта сессия запущена как КОНДУКТОР (env CONDUCTOR_SESSION=1).',
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
