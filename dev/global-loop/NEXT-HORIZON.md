# NEXT-HORIZON — пост-RL-001 горизонт пилота my-first-test (3 шага владельца)

status: NOTE (шов на продолжение; заведён 2026-07-20 по запросу владельца в конце RUN-2026-07-17-A)
related: `dev/global-loop/SEAM.md` (живой шов трека) · `dev/global-loop/ASSIST_LOG.md` (RUN-A.1..A.38 — как дошли сюда) · `dev/release-dod/TRACK.md` (DoD-предикат)
scope: это горизонт работ **над пилотом** (продуктовый проект), а не над самой экосистемой. Механизмы экосистемы, если понадобятся (шаг 3), заводятся отдельно — с coverage-check по CLAUDE.md DEC-DEV-0222.

## Решения владельца 2026-07-22 (RUN-B) — развилки закрыты, вход в исполнение

- **Развилка порядка РЕШЕНА: bring-forward real в RL-001.** RL-001 остаётся `in-progress`;
  Mock→real свапы медиа-конвейера (шаг 1) возвращаются в его состав; `released` — после
  real-пайплайна. FB-013 (splice/reassembly) — bring-forward из RL-002 обратно. Owner-финал
  (impl-sync `[Y]` + ratify) сдвигается на конец шага 1.
- **Провайдеры (директива владельца — связка Translate-It, «они работали»):** транскрипция =
  OpenAI Whisper API · перевод = OpenAI `gpt-4o` (`OpenAITranslationAdapter`) · TTS =
  **Google Cloud TTS** (SA JSON из Translate-It, роль Cloud TTS User; НЕ Sber — живого
  ключа нет) · object-store кандидат = GCS, тот же SA.
- **Платежи: Mock до public launch** — real Stripe + 5-txn dry-run отдельной единицей.
- Ledger: `ASSIST_LOG.md` RUN-B.1..B.2.

## Интенция владельца — ДОСЛОВНО (2026-07-20; цитировать, не пересказывать)

> «оставь заметку или шов на продолжение по следующим шагам: 1) полная доработка до
> функционального пайплайна 2) Тестирование на готовм дизайне 3) Автоматическое визуальное
> тестирование с полной имитацией действий человека»

## Откуда стартуем (состояние на конец RUN-2026-07-17-A — верифицируй git, не этой заметкой)

- Пилот origin/main HEAD = `096e34b` (+ демо-seed в staging-БД, вне git). RL-001 доведён до
  **DoD-собран-минус-owner**: 7 FM (2 GO + 4 MANUAL_VERIFY с owner-ратифицированными
  residuals + 1 shipped, 0 NO-GO), staging DEPLOYED×READY (api+web 200, worker STARTS,
  Lighthouse 0.94). Полная хронология — `ASSIST_LOG.md`.
- **Два незакрытых owner-действия RL-001** (терминатор DoD, floor/I-2 — только владелец):
  (1) `/product:impl-sync <FM>` `[Y]` per-FM → flip `shipped`; (2) owner ratify
  `RL.status: in-progress → released`. **Развилка порядка** (решить до шага 1): закрыть
  RL-001 `released` на Mock-пайплайне и вести доработку как RL-002 — ИЛИ вернуть часть
  real-работы в RL-001 до релиза (тогда FB-013 частично bring-forward). Рекоменд.: закрыть
  RL-001 released (функциональный MVP-контракт выполнен), доработка = RL-002.
- **Что сейчас Mock** (граница real/Mock, снято recon'ом 2026-07-20): платежи
  (MockPaymentProvider) · весь медиа-конвейер — транскрипция (MockTranscription), перевод
  (MockTranslation; `OpenAITranslationAdapter` в коде есть, но never selected — Mock
  hard-wired, tasks 5.4b/DEC-A06) · TTS (MockTts) · сплайс/сборка видео (MockSplice;
  `FfmpegSpliceAdapter` в коде, но за невыставленными флагами `REGENERATION_SPLICE_FFMPEG_
  ENABLED`/`REGENERATION_REASSEMBLER_ENABLED`) · Google OAuth · email · captcha. **Real:**
  auth/сессии, glossary, localization-оркестрация, подписки-флоу, admin-enforcement.
- **CSS/presentation-слой НЕ реализован** (RUN-A.38): дизайн спроектирован (6 MK + 6 NM +
  `design-system.md`, все FM has_ui:true), но CSS под семантические className'ы
  (`app-layout`/`status-badge`/`segment-row`…) не написан; нет Tailwind/globals.css; layout
  «scaffold-only». Приложение функционально, но голый HTML.

## Шаг 1 — Полная доработка до функционального пайплайна

**Цель:** end-to-end пайплайн обрабатывает реальное видео (не заглушки): загрузка →
транскрипция → перевод → TTS → сегментная нарезка/сборка (splice/reassembly) → скачивание —
на **real-адаптерах**.

**Конкретно (Mock → real свапы, каждый = единица handoff→P3-P6):**
- **Перевод:** выбрать `OpenAITranslationAdapter` в prod translate-stage (ключ OPENAI_API_KEY
  на staging уже стоит) вместо Mock hard-wire (tasks 5.4b).
- **Транскрипция:** real-адаптер (провайдер — решение владельца: OpenAI Whisper / иной) вместо MockTranscription.
- **TTS:** real-адаптер (провайдер — решение владельца) вместо MockTts.
- **Splice/reassembly:** `FfmpegSpliceAdapter` + real object-store — это **FB-013**, осознанно
  демоушнутый в RL-002 (owner-ratify 2026-07-20, task 7.2b); выставить флаги
  `REGENERATION_SPLICE_FFMPEG_ENABLED`/`REGENERATION_REASSEMBLER_ENABLED`; живой замер
  NFR-010 (revoice p50 ≤ 2 мин) — закрывается ЗДЕСЬ.
- **Платежи (опц., launch-blocking):** real Stripe вместо MockPaymentProvider + 5-txn
  dry-run (DA-finding F4).
- **Прочее по мере нужды:** Google OAuth, email (SendGrid — dunning-шаблон, PA-029),
  captcha (Turnstile — ключ есть) — real вместо Mock.

**Как вести:** каждый свап — стандартный цикл экосистемы (handoff → P3 → P5 → P6 GO×READY →
deploy → P7), в fabric-линии если удобно. Провайдеры внешних сервисов — через `/integrator`
(секреты — floor, provision по явной директиве владельца). **Открытый вопрос владельцу:**
какие провайдеры для транскрипции/TTS (OpenAI-стек / иные).

## Шаг 2 — Тестирование на готовом дизайне

**Предусловие:** presentation-слой построен. Сначала **имплементировать CSS** под
существующие семантические классы из `design-system.md` + 6 MK (дизайн-токены → globals.css
+ per-feature стили; подключить в `layout.tsx`; пересборка + пере-деплой). Это НЕ
проектирование с нуля — дизайн готов, нужна имплементация (кандидат: через Design Module
`/design:*` или прямой CSS-слой).

**Затем:** ручное/функциональное тестирование UX на стилизованном приложении — проход по
кейсам каждого MK/NM, сверка «выглядит и ведёт себя как дизайн». Это закрывает разрыв,
который вскрыл RUN-A.38 (голый HTML при спроектированном дизайне).

**Порядок:** шаг 2 логически ПОСЛЕ или параллельно шагу 1 (стили независимы от real-адаптеров),
но ОБА — предусловие шага 3 (визуально тестировать нечего без CSS + нечего проверять по
результату без real-пайплайна).

## Шаг 3 — Автоматическое визуальное тестирование с полной имитацией действий человека

**Цель:** E2E-прогон через реальный браузер с имитацией человека (клики, ввод, навигация по
флоу), визуальные снапшоты/регрессия против MK — автоматически.

**Кандидат-механизм:** browser-automation (Playwright / Puppeteer) поверх задеплоенного
staging; сценарии по MK/NM; visual-regression (снапшот-сравнение). Возможные каналы:
`/integrator:add` внешнего инструмента · MCP браузер-сервер · проектная тест-инфраструктура
пилота.

**🔒 ПЕРЕД стройкой шага 3 — coverage-check AS IS** (CLAUDE.md DEC-DEV-0222, т.к. это
кандидат в новый механизм экосистемы): проверить, нет ли уже в экосистеме/доступного
браузер-теста, MCP-браузера, playwright-обвязки; предложить MCP/расширения доступа к данным
(feedback `propose-data-access-extensions`); только потом проектировать дельту.

**Связь с DoD (meta-feedback #5):** автовизуальный тест — прямой кандидат закрыть
DoD-visual-gap (зелёный DoD не ловил невизуализацию has_ui-фич). Если механизм строится —
рассмотреть visual-conformance-ногу в DoD-категории «фича реализована» для has_ui.

## Зависимости и порядок

```
owner-финал RL-001 (impl-sync [Y] + ratify released)  ← незакрытый хвост RUN-A
        │  (развилка порядка: released-на-Mock → RL-002, ИЛИ bring-forward real в RL-001)
        ▼
Шаг 1 (real-пайплайн)  ∥  Шаг 2a (CSS-имплементация)
        └──────────┬──────────┘
                   ▼
        Шаг 2b (тест на готовом дизайне)
                   ▼
        Шаг 3 (автовизуальный E2E)  ← coverage-check ДО стройки
```

## Связи с накопленными долгами (не потерять)

- **5 meta-feedback дефектов экосистемы** (копятся, чинить вне live-прогона):
  #1 `validate-feature-impl.mjs:76` falsy `||3` глотает rounds:0 · #2 consilium-synth
  strength только по scores{} · #3 consilium-панель без cost-линзы · #4 impl-sync collector
  матчит по литеральному FM-ID (не видит feature-slug-прогоны) · #5 DoD/P6 не гейтит
  visual-имплементацию has_ui-фич.
- **RL-002-долг** (из прогона): FB-013 (real splice/reassembly — теперь = ядро шага 1) ·
  manifest `draft→active` · substrate-graduation-gate формулировка · DA F7 threshold-mismatch
  · HYP-003 measurement-design · BullMQ-транспорт (демоушнут с ioredis-RPUSH).
- **Системные хвосты трека:** SEAM.md ветки `docs/global-loop-assist-ledger` разошёлся с main
  (нет DEC-DEV-0222-блока) — подтянуть при merge · скилл `vm-factory-ops` §2 держит устаревшее
  «12 vCPU» (факт — 4, решение владельца) · демо-seed в staging-БД (demo@demo.local /
  admin@demo.local) — вычистить когда не нужен.

## Механика доступа к пилоту (для продолжателя)

VM-стек staging задеплоен и жив; ssh-туннель хост→VM: `ssh -L 13001:localhost:3001
-L 13000:localhost:3000 -p 2222 -i ~/.ssh/vm-claude-factory cc-dev@127.0.0.1 -N`; UI —
`http://localhost:13001`. Операторские детали — скилл `vm-factory-ops`; §0-проба перед любым
разрушающим действием (VM — общий ресурс).
