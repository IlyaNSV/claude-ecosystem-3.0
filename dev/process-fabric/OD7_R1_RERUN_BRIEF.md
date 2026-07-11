# OD7 R1 re-run — пре-регистрированный бриф (аддендум к OD7_LIVE_RUN_BRIEF.md)

> **Пре-регистрация:** коммитится ДО прогона (anti-tamper, дисциплина live-run-validation).
> **Цель:** снять ЕДИНСТВЕННЫЙ оставшийся критерий **R1 «park machine-backed»** из
> `OD7_LIVE_RUN_REVIEW_HANDOFF.md` — рекомендация №2 судьи 0173: «перепрогнать целевой park
> через диспетчер `orchestrator:run --fabric`, чтобы брекет нарезался штатно». Остальные
> критерии (R2-R5, R7, R8) уже PASS и НЕ пере-грейдятся; R6 — event-gated, вне scope.
> **Класс:** B (механика по брифу). Судья: opus, только критерий R1 (+ фиксация live-проб
> новых гардов 0174 как побочных наблюдений, без влияния на вердикт R1).
> **Мандаты владельца (2026-07-11):** «Режь 1.8.1 и делай вариант (1) с DeepL»; VM-сессии
> всегда bypass; merge/операторка самостоятельно.

## Почему новый субъект (не FM-002)

Фикс DEF-OD7-1 (probe читает `.env`) честно снял ложный BLOCK FM-002 — `OPENAI_API_KEY`
лежит в `.env` пилота, probe теперь возвращает SATISFIED (`env_source: .env`), парковки не
будет. Это ПОДТВЕРЖДЕНИЕ правильности фикса (проверяется в S0), а не препятствие: для R1
нужен **реальный** дефицит.

**Одобренный сценарий (вариант 1, DeepL):** пилот my-first-test — переводческое приложение
с реальным provider-seam (DEC-DEV-0081: DeepL за Mock stand-in; RL-002 vendor wiring —
реальный roadmap-item пилота). FM «Real DeepL provider integration»: ядро фичи = живая
интеграция, mock по определению не может быть её stand-in → манифест честно объявляет
`dev_stand_in: none`; ключа `DEEPL_API_KEY` в `.env` пилота реально НЕТ → disposition
**BLOCK** — не срежиссированный дефицит.

## ⚠ Deviation note (2026-07-11, ДО прогона; правило «исполнитель отклоняется с обоснованием»)

Ground truth пилота опроверг DeepL-премису брифа: **DeepL для machine-translation отменён
ратифицированным продуктовым решением пилота** (комментарий манифеста FM-002 + PA-038,
2026-06-30: выбор = OpenAI — DeepL Free требовал карту, RU-глоссарий покрыт частично).
DeepL-фикстура противоречила бы канону = режиссура. **Честный эквивалент той же схемы
(вариант 1): реальный TTS-провайдер** — сквозной процесс пилота translate→**TTS**→download,
real-provider wiring отложен в RL-002 (mvp-scope: primary candidate ElevenLabs voice library;
FM-007 handoff подтверждает), `ELEVENLABS_API_KEY` в `.env` пилота реально ОТСУТСТВУЕТ,
mock не может быть stand-in для фичи «retire the Mock». Субъект = **FM-008 real-TTS-provider
wiring** с манифестом:
```yaml
external_capabilities:
  - { capability: text-to-speech-real-provider, secret_env: ELEVENLABS_API_KEY, provider: ElevenLabs, tier: prod, dev_stand_in: none }
```
Пин провайдера следует primary-кандидату mvp-scope; ратификация выбора — на владельце через
сам OD7-гейт (парковка это и сюрфейсит). Остальной сценарий брифа — без изменений
(FM-NNN = FM-008). Критерий R1 не зависит от того, КАКАЯ capability паркует линию.

## Fixture-prep (оператор, до executor-сессии)

1. Пилот: `/ecosystem:update` до **1.8.1** + `/ecosystem:verify` — на **main** пилота
   (реальная доставка, остаётся).
2. Sanity DEF-OD7-1 (read-only): `node .claude/orchestrator/lib/capability-probe.cjs
   --feature FM-002` → `OPENAI_API_KEY` `present:true`, `env_source: ".env"`,
   disposition SATISFIED. Фиксируется в лог.
3. **Изолированная ветка пилота** `od7-r1-rerun` (урок feedback: тест-окружение — на ветке).
   Оператор создаёт FM-файл `.product/features/FM-NNN-real-deepl-provider-integration.md`
   (канонический frontmatter по образцу существующих FM; next-free FM-NNN) с манифестом:
   ```yaml
   external_capabilities:
     - { capability: machine-translation-real-provider, secret_env: DEEPL_API_KEY, provider: DeepL, tier: prod, dev_stand_in: none }
   ```
   `.kiro/specs/<feature>/` для FM **намеренно нет**: P5 plan честно вернёт `tasks: []`
   (FB-002 note), capability-detect отработает → `capability_blocked` непуст → парковка.
   Прогон короткий по построению; `.env` и капабилити-манифест других FM не трогаются.

## Сценарий executor-сессии (verbatim-промпт, tmux, bypass)

Одна сессия на ветке `od7-r1-rerun`. Промпт (verbatim):

```text
Возьми фичу FM-NNN (real DeepL provider integration) и прогони её через
/orchestrator:run feature-to-tdd-impl --feature FM-NNN --fabric.
Scope: только машинная дорога линии до её ближайшего человеческого гейта.
Authoring/fidelity-стадии (P3/P4) вне scope — если они стоят на пути линии,
фаст-форварди их результаты аудируемым путём, который предпишет движок.
Канон экосистемы (.claude/**) не править; дефекты и странности фиксируй
письменно, не чини. Остановись, как только линия встанет на человеческий
гейт, и покажи status + последние события инстанса.
```

Ожидаемая машинная дорога: init + `evt:line.start` (диспетчер, `--fabric`) → FF P3/P4
через `ingest --force-manual "PA-NNN: fast-forward — authoring вне scope R1 re-run"`
(гард 0174 откажет FF без PA — executor обязан пройти путём, который движок предпишет
в тексте отказа; это попутная live-проба нового эскейпа) → **P5 полным брекетом
диспетчера** (run-ledger start → Workflow → finish → `ingest --run-id "$RUN_ID"`) →
парковка `awaiting_capability_impl` с payload.

## Критерий R1 (единственный грейд-предмет)

Парковочное событие `evt:impl.blocked_capability` в `events.ndjson` инстанса:
- несёт `run_id`, **присутствующий** в `.claude/orchestrator/runs/ledger.ndjson`
  (брекет нарезан штатно);
- пришло через `ingest` P5-результата (не голый tick), БЕЗ `forced-manual`-маркера
  на самом park-тике (FF-маркеры на P3/P4-событиях допустимы и ожидаемы — они не
  park-события);
- payload события = `capability_blocked` (DeepL-item), PA-запись гейта с fenced-json;
- `replay --instance <id>` exit 0.

FAIL любого пункта → R1 остаётся открытым, классификация дефекта, не подгонка.

## Клин-ап (после фиксации evidence)

Линию закрыть новым терминалом (попутная live-проба ANOM-OD7-1/2): PA-запись решения
(«R1 re-run завершён; DeepL provisioning — реальный backlog-item, вне scope прогона»)
→ `tick evt:owner.close --force-manual "PA-NNN: <решение>"` → `closed_without_runtime`;
park-PA — dismissed. Ветка пилота `od7-r1-rerun` остаётся для осмотра владельцем
(мёржить не нужно: fixture-FM без спеки — не продуктовый канон, решение о судьбе FM
за владельцем).

## Harvest для судьи

`events.ndjson` + `ledger.ndjson` + `pending-actions.md` (ветки) + транскрипт
executor-сессии + вывод sanity-проверки S0. Судья: opus, вердикт строго по критерию R1.

---

## Outcome (2026-07-11, пост-прогон; журнал DEC-DEV-0175)

**Судья (независимый opus): R1 = PASS по букве.** Построчно: (1) park-событие seq 4
`evt:impl.blocked_capability` (`implementing → awaiting_capability_impl`) несёт
`run_id: 2026-07-11-feature-to-tdd-impl-fo62o0` — диспетчерский формат, не raw-Workflow `wf_…`;
(2) тот же run_id побайтно совпадает с ledger-брекетом (`status: finished`, 01:12:00→01:13:25);
(3) `forced-manual`-маркеры только на разрешённых брифом FF-событиях P3/P4 (seq 2/3, PA-065),
park-тик чист. Replay `{ok:true, seq:4}` exit 0; payload = capability-slice (ELEVENLABS_API_KEY
BLOCK) + зеркальный fenced-json в PA-067. **Следствие судьи: OD7 live-валидирован по
совокупности** (R2-R5/R7/R8 из 0173 + этот R1); остаток — R6/`env.up` event-gated.

**Хроника:** S0 = доставка 1.8.1 в пилот (`42748ed`) + sanity DEF-OD7-1 PASS (FM-002:
`OPENAI_API_KEY present env_source=.env SATISFIED` — прежний ложный BLOCK честно исчез).
Fixture FM-008 на ветке `od7-r1-rerun`. Executor-спонтанности (обе ценные): (а) стоп на
`handoff_ready` — DoR P3 честно блокирует пустой FM-скелет (B1 proposed / B2 нет SC);
разрешено owner-решением «стартуем без обогащения, P2.A вне scope»; (б) **DEF-OD7-CLOSE**:
попытка клин-апа `evt:owner.close` из `awaiting_capability_impl` отклонена движком — у
await-гейтов charter v3 НЕ было owner-терминала (единственный выход — resume); executor
отказался фейкать состояние (вариант «pa.resolved→forced manual_verify→escalated→close» = два
семантически ложных события) и предложил honest-resting-state. Принято: линия оставлена в
правдивом `awaiting_capability_impl` на ветке, PA-067 dismissed, PA-068 = запись решения,
коммиты `888efe1`/`84a4324`/`3938849` запушены. **Фикс DEF-OD7-CLOSE — charter v4
(DEC-DEV-0175):** `evt:owner.close → closed_without_runtime` со ВСЕХ парковочных гейтов
(`awaiting_*`, `runtime_gate_retry`); resume-события не изменены (юнит-регрессор).
Среда: перед прогоном вскрыт и вылечен ресурсный клин VM (5 idle-TUI × statusline 4s →
load 25 → новые инстансы Claude виснут на старте; урок в скилл `vm-factory-ops` §4.5).
