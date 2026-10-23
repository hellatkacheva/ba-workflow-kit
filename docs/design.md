# BA Workflow Kit — design

| | |
|---|---|
| **Status** | Reviewed |
| **Reviewed by** | Olga, 2026-10-20 |
| **Version** | v1.8 · 2026-10-23 (тест A шаги 6–9: K-14…K-17 — §12; итерация 3 — `/ba-sync`, `change-impact`, агенты, watch — §13; план теста B — §8.1); v1.7 · 2026-10-22 (тест A шаги 1–5: K-12, K-13; решения BA по реализации итерации 2b — §12.3); v1.6 · 2026-10-22 (тест A шаги 3–5: K-10, K-11; итерация 2b — spec, build, deploy, jira-sync — §12.3); v1.5 · 2026-10-21 (решения BA по итерации 2a: гейт ревью как в DeskShare, проверка git status после критика — §12.2); v1.4 · 2026-10-21 (повторный прогон теста A: K-7…K-9; итерация 2a — §12); v1.3 · 2026-10-21 (исправления по итогам теста A, шаг 2 — §12); v1.2 · 2026-10-20 (v1.1 + ответы BA на Q8–Q9; v1.1: ответы на Q1–Q7, профили деплоя, правило архитектора, страница теста C) |
| **Author** | Olga Tkacheva (BA) + Claude |
| **Reference project** | `C:\Projects\deskshare\deskshare` (read-only, commit `215a051`) |
| **Test source** | Confluence `hellatkacheva.atlassian.net` · space `DSSRC` · page `65670` (v2) — тесты A/B; page `294916` (v1, GearLoan) — тест C |
| **Test Jira** | project `KAN` (DeskShare Kit Test, team-managed) |
| **MCP server** | `atlassian-olga` (`https://mcp.atlassian.com/v1/mcp`) |

## 0. Цель и границы

| | |
|---|---|
| Что делает кит | Аналитик даёт ссылку на страницу Confluence → Claude проходит шаги ingest → requirements → conflicts → stories → review → spec → build → deploy → jira-sync, останавливаясь на решениях BA. После этого отслеживает новые версии страницы и делает анализ влияния. |
| Форма | Плагин Claude Code: commands + skills + agents + шаблоны + GitHub Action. Без своего сервера. |
| Состояние проекта | Только файлы в git проекта: `ba-project.yaml` + `docs/…`. Плагин без состояния. |
| Не входит в v1 | Запись в Confluence, несколько исходных страниц на один проект, мультиязычные исходники, свой UI. |

---

## 1. Структура плагина

### 1.1 Раскладка файлов

| Путь в плагине | Назначение |
|---|---|
| `.claude-plugin/plugin.json` | Манифест: имя `ba-workflow-kit`, версия (0.4.0), описание |
| `commands/ba-new.md` · `ba-status.md` · `ba-continue.md` · `ba-sync.md` | 4 команды для пользователя |
| `skills/<step>/SKILL.md` | 9 skills по шагам + `change-impact` + `ba-rules` |
| `skills/<step>/templates/*.md` | Шаблоны артефактов (requirements, analysis-log, story, spec-файлы, CHG) |
| `agents/*.md` | 3 субагента |
| `skills/ba-rules/templates/project/` | Заготовки для `/ba-new` (R2): `CLAUDE.md`, `ba-project.yaml`, `docs/**/README.md`, `.github/workflows/confluence-watch.yml`, `scripts/confluence-watch.mjs` |
| `skills/change-impact/scripts/blockdiff.mjs` | Детерминированный блочный diff снимков и поиск цитат-источников в артефактах (§5.1, §13) |
| `hooks/hooks.json` | v1: пусто. Кандидат на v2 — PreToolUse-guard для запрещённых действий (§7.3) |

MCP-сервер **не** входит в плагин: он настраивается в `.mcp.json` проекта, а его имя хранится в `ba-project.yaml` (`atlassian.mcp_server`). Skills вызывают инструменты `mcp__<mcp_server>__*`.

### 1.2 Commands

| Команда | Аргументы | Что делает | Пишет | Останавливается |
|---|---|---|---|---|
| `/ba-new` | `<confluence-url>` `[--jira KEY]` | Проверяет MCP и авторизацию, по URL находит cloudId и page id, создаёт `ba-project.yaml` и скелет `docs/`. Читает типы задач и статусы Jira-проекта по ID. Запускает шаг 1 (ingest). | `ba-project.yaml`, `CLAUDE.md`, `docs/00-source/**`, `.github/workflows/confluence-watch.yml` | Подтверждение BA: проект/пространство/страница/Jira key/стек — перед записью yaml |
| `/ba-status` | — | Только чтение: таблица шагов (статус, утверждение, дата), версия источника — локальная и в Confluence, открытые CON/GAP, stale-артефакты, открытые CHG. | ничего | — |
| `/ba-continue` | `[step]` | Берёт первый шаг, у которого `status ≠ approved/reviewed` и предыдущий шаг ≥ `reviewed`, и запускает его skill. Идёт **до ближайшей HITL-точки** (решение BA, Q7): шаги без HITL выполняются подряд, на HITL — стоп (для build — после каждой истории). | через skill шага | На каждой HITL-точке (§7). Не переходит к следующему шагу, пока BA не перевёл текущий в `reviewed` (исключения: ingest → requirements; stories → review, §12.2 B-1; deploy — после spec `reviewed` и принятых BA историй Core demo; jira — после review `reviewed`, §12.3) |
| `/ba-sync` | `[setup-watch]` | Без аргумента — skill `change-impact`: текущие версии страницы и детей через MCP, снимок `v<new>`, блочный diff, отчёт CHG, после OK — переделка только затронутого. `setup-watch` — ставит шаблон Action и перечисляет шаги BA (§6). `--version N` убран: MCP отдаёт только текущую версию (§13 I3-1) | `docs/00-source/confluence/**`, `docs/07-changes/CHG-xxx.md` + `CHG-xxx/*.json`, затем затронутые артефакты | После отчёта CHG (H9, OK построчно); далее — HITL-точки перезапускаемых шагов (H10 на каждый новый CON) |

### 1.3 Skills

Все skills сначала загружают `ba-rules` (бывшие golden rules и decision rules из DeskShare `CLAUDE.md`).

| Skill | Шаг | Источник в DeskShare | Вход | Выход | HITL |
|---|---|---|---|---|---|
| `ba-rules` | — | `CLAUDE.md` §Golden rules, §Decision rules, §Language | `ba-project.yaml` | — (правила) | — |
| `ingest` | 1 | `/ingest` | URL / page id из yaml; `docs/00-source/inbox/` (ручные файлы) | `docs/00-source/confluence/<page>/v<N>/…`, `docs/00-source/NN-*.md`, README | Нет (BA только смотрит отчёт) |
| `extract-requirements` | 2 | `/extract-requirements` | `docs/00-source/*.md` | `docs/01-requirements/requirements.md` | BA review → `reviewed` |
| `analyze-conflicts` | 3 | `/analyze-conflicts` | requirements (≥ reviewed), sources | `docs/02-analysis/analysis-log.md`, + REQ `Proposed` | **BA решает каждый CON и GAP** |
| `write-stories` | 4 | `/write-stories` | requirements, analysis-log (0 `Open` CON) | `docs/03-backlog/backlog.md`, `stories/US-xxx.md` (`Draft`) | BA отвечает на OQ; review бэклога — после критика (шаг 5) |
| `review-backlog` | 5 | `/review-backlog` | backlog в статусе `Draft` | `docs/03-backlog/review.md`, правки историй | **BA принимает/отклоняет замечания**, затем backlog → `reviewed` |
| `spec` | 6 | `/spec` | backlog (≥ reviewed), requirements, analysis-log, `stack` из yaml | `docs/04-spec/*.md` (architecture, data-model, api или storage для `static`, ui, config, test-plan, demo-data), `stack.constraints` | BA + tech review; вопросы OQ-S → стоп; **правило архитектора (§3.2): новый CON только для потребностей, не покрытых DEC шага 3 → стоп** |
| `build` | 7 | `/build` | spec (≥ reviewed), история | `app/` (стек по профилю, §12.3), `build-status.md`, `test-plan.md` | BA принимает каждую историю; следующая — только после принятия |
| `deploy` | 8 | `/deploy` | `app/`, `stack.deploy.profile` (§3.1) | `static` → GitHub Pages (`templates/pages.yml`); `local` → инструкция запуска; `cloudflare` → Worker + D1; smoke-тест, `build-status.md`, `stack.deploy.url` | **Явное OK на каждую публичную выкладку в текущем разговоре**; секреты и логины вводит только BA |
| `jira-sync` | 9 | `/jira-sync` | backlog (≥ reviewed), analysis-log §open questions, build-status, `jira` и `atlassian` из yaml | Jira-задачи, `docs/05-jira/jira-map.md`, `jira.statuses`, `jira.sprint` | **OK на план перед любой записью** — одобренный план разрешает именно эти записи (K-15); спринт BA создаёт и запускает до создания задач (K-16) |
| `change-impact` | sync | новое | старый и новый снимок, `changes.json` (скрипт), артефакты 01–05 | `docs/07-changes/CHG-xxx.md`, затем scoped-перезапуск шагов (`ba-rules` §4 «Scoped mode») | **OK на план переделки построчно** (H9); новый CON — H10 |

### 1.4 Agents

| Агент | Роль | Инструменты | Вход | Выход | Кто вызывает |
|---|---|---|---|---|---|
| `backlog-reviewer` | Скептичный QA lead / senior BA, который не писал этот бэклог (как в DeskShare) | Read, Grep, Glob, Write (только `review.md`) | `CLAUDE.md`, `docs/00-source/`, requirements, analysis-log, backlog | `docs/03-backlog/review.md`: таблица # · severity · файл · finding · evidence · fix + вердикт | `review-backlog`; после работы агента `review-backlog` проверяет `git status`: изменён только `review.md`, иначе стоп и сообщение BA (§12.2) |
| `impact-analyst` | Независимый аналитик изменений: классифицирует diff C0–C6 и прослеживает влияние, ничего не правит | Read, Grep, Glob (только чтение, §13 I3-3) | `changes.json`, `quotes-before.json`, `ba-project.yaml`, артефакты шагов 2–9, `ba-rules` | Текст отчёта (разделы §5.4 1–6); `change-impact` проверяет его и пишет `CHG-xxx.md` | `change-impact` (фаза A4) |
| `trace-auditor` | Проверяет целостность трассировки после переделки: цитаты активных элементов есть в новом снимке, у REQ есть источник, цепочки `Superseded` целы, у историй — живые REQ/DEC, у AC — тесты, config и Jira-map актуальны, изменения только в одобренных строках плана | Read, Grep, Glob (только чтение) | `quotes-after.json`, CHG, артефакты 01–05, `ba-rules` | Текст: таблица нарушений T1–T10 + вердикт | `change-impact` (фаза B4); по просьбе BA |

Субагенту выдаём только Read, Grep, Glob (критику — ещё Write в `review.md`). MCP и Bash у них нет: всё, что идёт в Confluence/Jira или Git, делает основной поток, который видит BA.

---

## 2. Что берём из DeskShare

### 2.1 Как есть

| Элемент | Откуда | Куда в ките |
|---|---|---|
| Golden rules 1–8 (read-only sources, трассировка с цитатой, никаких выдуманных фактов, HITL на конфликтах, PoC, `Superseded by`, стабильные ID, статус на артефакте) | `CLAUDE.md` | `skills/ba-rules` + шаблон `CLAUDE.md` |
| Decision rules: (a) Decided · (b) Prototype both (A/B) · (c) Deferred — sponsor decision | `CLAUDE.md` | `ba-rules` |
| Префиксы ID: REQ, NFR, CST, OOS, DEC, CON, GAP, ASM, RSK, EP, US | `CLAUDE.md` | `ba-rules`; + новый `CHG` |
| Структура requirements.md (8 разделов), analysis-log (Part A / Part B), story template, review-таблица | команды шагов 2–5 | шаблоны skills |
| Независимый критик бэклога | `agents/backlog-reviewer.md` | `agents/backlog-reviewer.md` (без «28 Oct» и DeskShare-специфики) |
| Tests first из Gherkin, одна история за запуск, config-модуль без магических чисел | `/build` | `skills/build` |
| Идемпотентный jira-sync: поиск по `summary ~ "US-xxx"` перед созданием, типы по ID, priority через edit после create, план → OK → запись, никаких удалений | `/jira-sync` | `skills/jira-sync` |
| `run-log.md` (дата, шаг, длительность, что поменял BA) | `workflow/run-log.md` | `docs/run-log.md` |
| Коммит после шага: `step N: <what>` | `CLAUDE.md` §Git | `ba-rules` |
| Язык: артефакты EN, общение RU, резюме в конце шага | `CLAUDE.md` §Language | `ba-rules`, значения — в yaml |

### 2.2 Обобщаем → настройки проекта

| Жёстко в DeskShare | Где | Становится |
|---|---|---|
| Jira `BAWT3`, сайт `anarbilmazhinova.atlassian.net` | `CLAUDE.md`, `/jira-sync` | `jira.project_key`, `atlassian.site` |
| MCP-сервер `atlassian` | `/jira-sync` | `atlassian.mcp_server` (тест: `atlassian-olga`) |
| Issue type ID `10014/10015/10017`, статусы `10007/10008/10009` | `/jira-sync` | `jira.issue_types.*`, `jira.statuses.*` — заполняет `/ba-new` из метаданных проекта |
| «Priority не на create-экране» | `/jira-sync` | `jira.priority_on_create: false` (проверяется при `/ba-new`) |
| Ссылка на историю `github.com/hellatkacheva/deskshare/blob/main/…` | `/jira-sync` | `repo.url` + `repo.branch` |
| Cloudflare Worker + D1, wrangler, `npx wrangler login` | `/spec`, `/deploy` | `stack.deploy.profile` (§3.1): `static` по умолчанию, `cloudflare` — один из профилей |
| «Fixed technical decisions (DEC-009, DEC-022…024, NFR-005)» | `/spec` | `stack.constraints[]` + ссылки на DEC проекта; skill берёт их из yaml, а не из текста |
| Значения конфигурации (10:00, UTC+5, F1/F2…) в тексте `/spec` | `/spec` | Убираем; spec выводит их из ASM/DEC проекта |
| Ключи источников `BR/HO/CTX/W1/W2/W3` | requirements.md | Генерируются при ingest из заголовков страницы → `docs/00-source/README.md` § Source keys |
| Стейкхолдеры (Priya, Sam, Dana), «Decided by: Olga (BA, proxy for Priya)» | `CLAUDE.md` | `people.ba`, `people.sponsor`, `decisions.proxy_for_sponsor` |
| Дедлайн «28 Oct», лимит A/B «1–2» | `CLAUDE.md`, `/analyze-conflicts` | `project.deadline`, `decisions.max_ab` |
| Эпики EP-1…EP-5, лейбл `deskshare-poc`, полосы cut line | `/jira-sync` | `jira.labels.project`; эпики берутся из `backlog.md` |
| Ingest «из `inbox/` руками» | `/ingest` | Ingest из Confluence через MCP (§4) + `inbox/` как запасной путь |

### 2.3 Выкидываем

| Что | Почему |
|---|---|
| Контекст DeskShare в `CLAUDE.md` (Northwind, команда, workshop) | Специфика проекта; в шаблоне остаются плейсхолдеры, которые заполняет `/ba-new` |
| Тексты и тест-кейсы с DeskShare-значениями (UTC+5, этажи, сид) | Это код проекта, а не кита |
| Шаг 10 (demo script) и `docs/06-demo/` | В цели кита его нет. Кандидат в v2 |
| `app/` целиком, `.wrangler/`, `test-results/` | Результат проекта, а не кита; пресет стека описывает только каркас |
| Ссылки на `workflow/README.md` как «основу для презентации» | Это метрики workshop; `run-log` остаётся, презентация — нет |
| Ручной перенос `01-workshop-brief.md` из PDF | Заменяется ingest из Confluence; PDF — через `inbox/` |

---

## 3. `ba-project.yaml`

Лежит в корне проекта. Создаёт его `/ba-new`, обновляют skills; поля из `approvals` меняет только BA или skill по явному «OK» BA.

| Поле | Тип | Пример (тест A) | Кто пишет | Зачем |
|---|---|---|---|---|
| `kit_version` | str | `0.1.0` | `/ba-new` | Совместимость с плагином |
| `project.name` | str | `DeskShare (kit replay)` | BA | Заголовки артефактов |
| `project.deadline` | date | `2026-10-28` | BA | PoC-дисциплина, review |
| `people.ba` | str | `Olga Tkacheva` | BA | `Decided by` |
| `people.sponsor` | str | `Priya Nandakumar` | step 2 → BA | Decision rules |
| `decisions.proxy_for_sponsor` | bool | `true` | BA | Формулировка «proxy for …» |
| `decisions.max_ab` | int | `2` | BA | Предупреждение при > N A/B |
| `language.artifacts` / `language.chat` | str | `en` / `ru` | BA | Язык |
| `atlassian.site` | str | `hellatkacheva.atlassian.net` | `/ba-new` | URL, REST в Action |
| `atlassian.cloud_id` | uuid | `ca7c4adf-0992-45e1-8315-6ffd43c1f4b0` | `/ba-new` | Параметр MCP-вызовов |
| `atlassian.mcp_server` | str | `atlassian-olga` | `/ba-new` (из `.mcp.json`) | Префикс `mcp__<name>__*` |
| `source.space_key` | str | `DSSRC` | `/ba-new` | Отчёты, Action |
| `source.page_id` | str | `65670` | `/ba-new` | Главный источник |
| `source.include_children` | bool | `true` | BA | Брать ли дочерние страницы |
| `source.include_attachments` | bool | `true` | BA | Брать ли вложения (§4.3) |
| `source.version` | int | `2` | ingest / sync | Версия, на которой основаны артефакты |
| `source.snapshot_at` | datetime | `2026-10-20T10:46:47Z` | ingest / sync | Время версии в Confluence |
| `source.children[]` | list `{id, title, version}` | `[]` | ingest / sync | Отслеживание дочерних страниц |
| `source.attachments[]` | list `{id, title, version, media_type}` | `[]` | ingest / sync | Отслеживание вложений |
| `steps.<step>.status` | enum | `not_started` · `draft` · `reviewed` · `approved` · `stale` | skill шага; `stale` — `/ba-sync` | Гейт `/ba-continue` |
| `steps.<step>.source_version` | int | `2` | skill шага | На какой версии источника сделан шаг |
| `steps.<step>.updated` | date | `2026-10-21` | skill шага | `/ba-status` |
| `approvals[]` | list `{step, status, by, date, note}` | `{step: requirements, status: reviewed, by: Olga, date: …}` | только по «OK» BA | Аудит HITL |
| `jira.project_key` | str | `KAN` | `/ba-new` | jira-sync |
| `jira.style` | enum | `team-managed` | `/ba-new` | Связь эпик → история через `parent` |
| `jira.issue_types.{epic,story,task}` | str (ID) | заполняет `/ba-new` | `/ba-new` | Типы по ID, не по имени |
| `jira.statuses.{todo,in_progress,done}` | str (ID) | заполняет `/ba-new` | `/ba-new` | Переходы |
| `jira.sprint.{field,id,name,board_id}` | str / int | `customfield_10020`, `1`, `DeskShare Kit Test PoC`, `1` | jira-sync (из поля спринта задачи, K-16) | Спринт на задачах, ссылка на доску |
| `jira.priority_on_create` | bool | проверяется | `/ba-new` | Priority через edit |
| `jira.priority_map` | map | `{Must: High, Should: Medium, Could: Low}` | BA | |
| `jira.labels.project` | str | `deskshare-kit-test` | BA | Лейбл на всех задачах, область поиска |
| `jira.labels.moscow` | map | `{Must: must-have, Should: should-have, Could: could-have}` | BA | Метка MoSCoW на истории (§12.3) |
| `repo.url` / `repo.branch` | str | `https://github.com/hellatkacheva/deskshare-kit-test` (public) / `main` | `/ba-new` | Ссылки из Jira на файлы; GitHub Pages |
| `repo.visibility` | enum | `public` | `/ba-new` | `static` на GitHub Pages бесплатного аккаунта требует public |
| `stack.deploy.profile` | enum | `static` (default) · `local` · `cloudflare` · `none` | BA | §3.1; spec / build / deploy |
| `stack.deploy.url` | str | `https://hellatkacheva.github.io/deskshare-kit-test/` | deploy | Ссылка в README, Jira, build-status |
| `stack.constraints[]` | list str | `["no backend", "no shared data"]` (выводятся из профиля) + DEC проекта | spec → BA | Бывшие «Fixed technical decisions» |
| `stack.deploy.prod_requires_ok` | bool | `true` (не отключается) | — | §7 |
| `watch.enabled` / `watch.issue_label` | bool / str | `true` / `ba-sync` | `/ba-new` | GitHub Action |

### 3.1 Профили деплоя

| Профиль | Что получается | Общие данные между устройствами/пользователями | Хранение | Выкладка (шаг 8) | Секреты | Когда выбирать |
|---|---|---|---|---|---|---|
| `static` **(default)** | Статический сайт (HTML/CSS/JS) | **Нет** — у каждого браузера свои данные | `localStorage` в браузере | GitHub Pages из `repo` (public); Actions-workflow `pages.yml` публикует `app/public/` (§12.3 I2b-5) | Нет | Кликабельный PoC «показать идею», один демонстратор |
| `local` | Node-сервер + SQLite на ноутбуке BA / разработчика | **Да, но только в пределах ноутбука / его Wi-Fi** (другие устройства открывают `http://<ip-ноутбука>:<port>`) | SQLite-файл на ноутбуке | Нет публичного URL; `npm start` + инструкция в README (как открыть с телефона в той же сети) | Нет | Демо в одной комнате с несколькими устройствами, без облака |
| `cloudflare` | Worker + D1 (+ static assets), как в DeskShare | **Да** | D1 | `wrangler deploy` в prod-env; БД и миграции | Да — вводит только BA (`wrangler login`, `wrangler secret put`) | Нужны общие данные и публичный URL |
| `none` | Только документы и Jira, без кода | — | — | Шаги 7–8 пропускаются, статус `skipped` | Нет | Чистый BA-анализ |

Общие правила: профиль задаёт `stack.constraints[]` для `spec`. Смена профиля — это решение BA (`DEC-xxx`), после него spec и build получают статус `stale`. `localStorage` используется только в `static` (решение BA, Q8): иначе `local` дублировал бы `static`.

### 3.2 Правило архитектора: общие данные против профиля

| | |
|---|---|
| **Когда срабатывает** | Впервые — skill `analyze-conflicts` (шаг 3, Part A: кандидат в CON, решается в Part B вместе с остальными, §12.1); повторно — `spec` перед записью spec (только для потребностей, не покрытых DEC) и `change-impact` при C2/C3/C4. Проверка: `stack.deploy.profile ∈ {static, local}` **и** есть хотя бы один REQ/NFR/DEC, который требует общего состояния между устройствами или пользователями. Для `static` общих данных нет вообще; для `local` они есть только в пределах ноутбука/Wi-Fi — CON описывает именно эту границу (удалённые и гибридные пользователи, публичный URL) |
| **Признаки «нужны общие данные»** | Лимит или ёмкость на всех (capacity, «не больше N»); общая бронь или выдача одного ресурса («кто взял», «свободно ли»); общий склад или журнал; роль, подтверждающая действие другого пользователя («только Ken отмечает возврат»); история или аудит за период; видимость чужих действий в реальном времени |
| **Что делает Claude** | 1) Создаёт `CON-xxx` в `analysis-log.md`: позиция A — требование (цитата, источник), позиция B — профиль деплоя (`ba-project.yaml`, DEC выбора профиля, ограничения стейкхолдеров вроде «no servers»). 2) Даёт 2–3 опции с плюсами и минусами (см. ниже) и `Claude's recommendation`. 3) **Останавливается**: spec не пишется, пока BA не выберет исход по decision rules (a/b/c). |
| **Типовые опции** | Всегда сравниваются три профиля — `static` / `local` / `cloudflare` — с плюсами, минусами и `Claude's recommendation`: (1) `cloudflare` — общие данные везде, но нужен облачный аккаунт и секреты; (2) `local` — общие данные в одной комнате/Wi-Fi, без облака; (3) `static` с явно суженным требованием для PoC: «демо на одном устройстве, общие данные имитируются seed-данными», баннер в UI, `ASM` — `ASSUMPTION — not validated`. Дополнительно возможен исход (c) Deferred — sponsor decision |
| **Запрещено** | Молча выбрать профиль, молча урезать требование, или сделать «общие данные» через сторонний сервис (Firebase, Sheets API и т. п.) без DEC |
| **Фиксация** | `DEC-xxx` с `Outcome`, `Decided by`, дата; при смене профиля — правка `stack.deploy.profile` только после OK BA и строка в `approvals` |
| **Ожидаем в тестах** | A — да (общий лимит этажа, бронь стола между сотрудниками); C — да (кто взял какой предмет, только Ken отмечает возврат, история для аудита, «Ken: no servers») — см. §8. Исход заранее не фиксируется (Q9): критерий — кит сам поднял CON и остановился, решение BA записано как DEC |

---

## 4. Ingest из Confluence через Atlassian MCP

### 4.1 Вызовы

| Что | MCP-инструмент (`mcp__<mcp_server>__…`) | Параметры | Что сохраняем |
|---|---|---|---|
| Сайт и cloudId | `getAccessibleAtlassianResources` | — | `atlassian.cloud_id`; проверяем scopes `read:page:confluence`, `read:jira-work` |
| Страница | `getConfluencePage` | `pageId`, `contentFormat: html` | `page.html` (round-trip-формат, нужен для точного diff) |
| Страница (для анализа) | `getConfluencePage` | `contentFormat: markdown` | `page.md` |
| Метаданные | ответ `getConfluencePage` | — | `version.number`, `version.createdAt`, `version.message`, `title`, `spaceId`, `parentId` → `meta.json` |
| Дочерние страницы | `getConfluencePageDescendants` | `pageId` | для каждой: `getConfluencePage` → своя папка `confluence/<childId>/v<M>/page.{html,md}` (K-7) |
| Вложения | **в списке инструментов MCP нет** (на 2026-10-20 у `atlassian-olga` 32 инструмента, ни одного для вложений) | — | см. §4.3 |

### 4.2 Снимок

| Путь в проекте | Содержимое | Меняется? |
|---|---|---|
| `docs/00-source/confluence/<pageId>/v<N>/page.html` | Тело страницы как есть | Никогда (append-only) |
| `docs/00-source/confluence/<pageId>/v<N>/page.md` | Markdown из MCP | Никогда |
| `docs/00-source/confluence/<pageId>/v<N>/meta.json` | id, title, version, createdAt, version message, автор, sha256 тела; у главной страницы — список детей (id, версия) на момент снимка | Никогда |
| `docs/00-source/confluence/<childId>/v<M>/…` | То же для каждой дочерней страницы — своя папка и своя версия (K-7), не внутри папки родителя | Никогда |
| `docs/00-source/confluence/<pageId>/v<N>/attachments/<file>` | Файлы вложений (если получены) | Никогда |
| `docs/00-source/NN-<short-name>.md` | Рабочий источник для шагов 2+: verbatim, правятся только переносы и списки (правило DeskShare `/ingest`), заголовок `Source: Confluence <pageId> v<N>` | Пересоздаётся при `/ba-sync` после OK |
| `docs/00-source/README.md` | Таблица источников + **Source keys** (`HO`, `CTX`, `W1`… выводятся из заголовков H2) + Known missing inputs | При ingest / sync |

Почему храним снимок сами: инструменты MCP отдают только **текущую** версию страницы. Старую версию через MCP не получить, поэтому diff всегда идёт между локальным снимком `v<old>` и свежим `v<new>`.

### 4.3 Вложения — варианты (решение BA 2026-10-20: **A**)

| Вариант | Как | Плюсы | Минусы |
|---|---|---|---|
| A. Список из REST, файлы руками | Action / `/ba-sync` видят вложения через REST (`/wiki/api/v2/pages/{id}/attachments`) и пишут «скачай в `inbox/`» | Без новых секретов у Claude | Ручной шаг |
| B. Локальный REST с токеном BA | Скрипт читает токен из env BA, Claude токен не видит | Полностью автоматически | Токен на машине BA, нужна инструкция |
| C. Ждать инструмент в MCP | — | Чисто | Неизвестно когда |

Выбрано **A**: принцип «Claude не трогает секреты» сохраняется, а `include_attachments` всё равно отслеживает изменения вложений.

---

## 5. `/ba-sync` — анализ влияния

### 5.1 Поток

| # | Действие | Кто | Результат |
|---|---|---|---|
| A0 | Гейт: `steps.ingest` ≥ draft; открытый CHG → продолжить его; `git status` чистый, иначе предложить коммит | `change-impact` | — |
| A1 | Текущие версии страницы и детей (MCP `getConfluencePage`, при отсутствии версии — `fetch` по ARI; `getConfluencePageDescendants`). Вложения через MCP не видны — только из issue watch | основной поток, MCP | Версии = yaml → «изменений нет», стоп, ничего не пишется |
| A2 | Снимок `v<new>` каждой изменённой / новой страницы (`ingest-confluence` §1–2); старые `v<N>` не трогаются. `<new>` — версия из Confluence (обычно N+1; при нескольких правках подряд — кумулятивный diff) | основной поток | §4.2 |
| A3 | Блочный diff `v<old>` ↔ `v<new>` и поиск цитат: блок = заголовок / абзац / пункт списка / строка таблицы; абзац из одного жирного текста = подзаголовок (`**Capacity limits**`); путь блока = заголовки + жирная метка (`Current state:`). Цитаты артефактов (строки с `[KEY · Section]`) ищутся в блоках старого снимка → `hits` у изменения, `still_in_new` | `scripts/blockdiff.mjs diff / quotes` | `CHG-xxx/changes.json` (`op`: cosmetic / modified / added / removed / moved; `hint` C0 / C1?), `CHG-xxx/quotes-before.json` |
| A4 | Классы C1–C6 и цепочка REQ → DEC → US → AC/тесты → config → Jira → build; «Not affected» с причиной | `impact-analyst` (только чтение) | текст отчёта; `change-impact` проверяет: у каждого D-n есть класс, ID существуют, Jira-ключи из `jira-map.md` |
| A5 | `docs/07-changes/CHG-xxx.md` (§5.4), `Status: Draft` | основной поток | — |
| A6 | Показать BA (RU): Summary, Changes, Plan; OK построчно; предложить коммит `sync: CHG-xxx snapshot v<old>→v<new>` | основной поток | **стоп — H9** |
| B0 | OK BA → колонка `BA OK`, `Approved by`; `approvals`: `{step: sync, status: plan-ok}` | основной поток | — |
| B1 | Затронутые шаги → `stale`; рабочие источники изменённых страниц пересоздаются (`ingest-confluence` §3), новый ребёнок → новый ключ | основной поток | — |
| B2 | Переделка только одобренных строк, по шагам, в scoped mode (`ba-rules` §4); C4 → новый CON → **стоп H10** | skills шагов | `Revised: CHG-xxx` / `Superseded by …`; шаг → `draft` |
| B3 | Jira-строки одобренного плана = план `jira-sync` (scoped mode, без второго OK); ничего сверх, без удалений | `jira-sync` | `jira-map.md` § Changes from CHG-xxx |
| B4 | `blockdiff.mjs quotes` на новом снимке → проверка трассировки | `trace-auditor` (только чтение) | находки T1–T10, вердикт |
| B5 | `source.version/snapshot_at/children` = новые; непеределанные шаги из «Not affected» → `source_version: new`; Log в CHG; коммит `sync: CHG-xxx v<old>→v<new>` по OK BA | основной поток | — |

### 5.2 Цепочка трассировки

| Звено | Где записано сейчас (DeskShare) | Ключ связи | Что добавляет кит |
|---|---|---|---|
| Блок источника → REQ/NFR/CST/OOS | requirements.md: `[W2 · Capacity limits]` + verbatim-цитата | ключ источника + раздел + цитата | Цитата ищется в блоках снимка → `block_path`; в trace-index хранится `{item, source_key, block_path, quote, version}` |
| Блок источника → DEC/CON/GAP/ASM | analysis-log: цитаты и ссылки на REQ | цитата + `Traces/links` | То же |
| REQ/DEC → US | story: `Traces to: REQ-…, DEC-…` | ID | Парсер строки `Traces to` |
| US → AC → тест | `test-plan.md`: scenario → test file | ID сценария `US-xxx-Snn` | Парсер таблицы test-plan |
| US/EP/Q → Jira | `jira-map.md`: Backlog ID → Jira key | ID | Парсер jira-map |
| US → build | `build-status.md`: story → status → commit | ID | Парсер build-status |

`trace-index.json` не храним (§13 I3-2): индекс «цитата → блок» каждый раз строит `blockdiff.mjs` из артефактов и снимка. Цитата, которой нет в старом снимке, попадает в `quotes-before.json`: `change-impact` показывает настоящие разрывы BA, и BA решает — сначала исправить или продолжить, записав их в CHG (§5.4 п. 6). Ложные срабатывания (текст UI, цитаты других артефактов) отмечаются, но не блокируют.

### 5.3 Классы изменений

| Класс | Признак | Пример | Действие по умолчанию |
|---|---|---|---|
| `C0 cosmetic` | Текст блока после нормализации (пробелы, переносы, разметка) не изменился | v1→v2 страницы 65670: `\n` → `<br>` | Только новый снимок, `source.version` += ; артефакты не трогаем |
| `C1 editorial` | Слова поменялись, смысл и значения те же | опечатка, перефраз | Обновить цитаты в затронутых элементах; без пересмотра |
| `C2 value change` | Изменилось число / дата / время / имя / роль в блоке, на который есть трасса | Floor 1 capacity 30 → 35 | REQ → новая версия (`Superseded by`); истории, AC, тесты, config, Jira — пересчёт |
| `C3 new information` | Новый блок без трассы | новый пункт в Decisions | Шаг 2 в scoped mode → новые REQ; дальше по цепочке |
| `C4 reversal` | Блок противоречит существующему DEC / CST / OOS | «waitlist is now in scope» | Новый CON → **HITL** (шаг 3), затем по цепочке |
| `C5 removal` | Удалён блок, на который есть трасса | пропал пункт out of scope | Элемент → `Superseded by CHG-xxx` (не удаляется); BA решает судьбу историй |
| `C6 structure` | Новая / удалённая дочерняя страница или раздел; изменение вложения | новая страница «Workshop 4» | Ingest детей + классификация их блоков как C3 |

Блок может получить несколько классов; итоговый — самый «тяжёлый». C0 и C1 различает детерминированный скрипт; C2–C6 размечает `impact-analyst`, а BA их подтверждает.

### 5.4 Отчёт `docs/07-changes/CHG-xxx.md`

| Раздел | Содержание |
|---|---|
| Header | Generated by `/ba-sync`, дата, page id, `v<old> → v<new>`, version message из Confluence, `Status: Draft → Approved` |
| 1. Summary | Число блоков по классам; затронутые шаги |
| 2. Changes | `#` · класс · раздел (block_path) · было (цитата) · стало (цитата) |
| 3. Impact | `#` · изменение → REQ/NFR/… → DEC/CON → US → AC/тесты → Jira key → build status |
| 4. Plan | `#` · действие (обновить цитату / новая версия REQ / новый CON / переписать AC / перегенерировать тест / обновить Jira) · шаг · HITL? · OK BA (да/нет/правка) |
| 5. Not affected | Шаги и элементы, которые проверены и не меняются (явно — чтобы BA видел границу) |
| 6. Trace issues before sync | Из `quotes-before.json`: настоящий разрыв или ложное срабатывание |
| 7. Log | Что сделано после OK, коммиты, итог `trace-auditor` |

### 5.5 Правила переделки

| Правило | |
|---|---|
| Только после OK | До OK пишутся только снимок и CHG. Ни один артефакт шагов 2–9 не меняется |
| Только затронутое | Skill шага получает список ID (`scope: [REQ-012, US-006]`) и не трогает остальное |
| Без перезаписи | Изменённый REQ / NFR / CST / OOS / DEC / CON → новый ID + `Superseded by …` (golden rule 6), а не правка на месте. Исключение: C1 (обновление цитаты + `Revised CHG-xxx (C1)`). **Истории** (§13 I3-4): если смысл истории тот же, а поменялись значение / правило / AC — правка на месте со строкой `Revised: CHG-xxx — <что>` (тот же Jira-ключ); если история больше не верна — `Superseded by US-xxx / CHG-xxx`, Jira — метка `superseded` + комментарий |
| Статусы | Затронутые шаги → `stale`, затем `draft`; BA снова ставит `reviewed` |
| Jira | Только update найденных задач и create новых — ровно Jira-строки одобренного плана CHG (`jira-sync` scoped mode). `Superseded`-истории получают лейбл `superseded` и комментарий, а не удаление |
| Build/deploy | Тесты перегенерируются по изменённым AC; код — через `/ba-continue build US-xxx`. Деплой — по общему правилу §7 |

---

## 6. Ежедневная проверка — GitHub Action без ИИ

| Элемент | Значение |
|---|---|
| Файл | `.github/workflows/confluence-watch.yml` + `scripts/confluence-watch.mjs` (Node 22, без зависимостей); ставит `/ba-new` (в существующий проект — `/ba-sync setup-watch`), включает BA: `watch.enabled: true` + секреты. При `watch.enabled: false` скрипт ничего не проверяет |
| Триггеры | `schedule: cron "0 5 * * 1-5"` (ежедневно в рабочие дни, 05:00 UTC) + `workflow_dispatch` |
| Читает | `ba-project.yaml` через `yq -o=json` (есть на `ubuntu-latest`): `atlassian.site`, `atlassian.cloud_id`, `source.page_id`, `source.version`, `include_children`, `include_attachments`, `children[]`, `attachments[]`, `watch.*` |
| Запросы (Confluence REST v2, Basic auth email + token) | База: `https://api.atlassian.com/ex/confluence/<cloud_id>/wiki` (scoped-токен; по умолчанию) или `https://<site>/wiki` (классический токен, переменная репозитория `CONFLUENCE_API=site`). `GET /api/v2/pages/{id}` → `version.number`, `version.message`; `GET /api/v2/pages/{id}/descendants` + `GET /api/v2/pages/{childId}` для версии (если `include_children`); `GET /api/v2/pages/{id}/attachments` (если `include_attachments`); пагинация по `_links.next` |
| Сравнение | Версия страницы, набор детей с версиями, набор вложений с версиями — с yaml |
| Если есть изменения | Если нет открытого issue с лейблом `watch.issue_label` → создать issue «Confluence page 65670 changed: v2 → v3 — run /ba-sync» (тело: таблица изменений, ссылка на страницу, version message, скрытая метка состояния `<!-- ba-watch state: … -->`). Если открытый есть → комментарий, **только если состояние отличается** от последней метки (иначе ежедневные дубли) |
| Если изменений нет | Ничего (лог в job summary) |
| Секреты (GitHub Secrets) | `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN` — API token только на чтение: `read:page:confluence`, `read:hierarchical-content:confluence` (дети), `read:attachment:confluence` (вложения) — имена scope проверяются в тесте B (B7). Заводит BA сам (`! gh secret set …`), Claude значения не видит |
| Права job | `permissions: { contents: read, issues: write }`; используется `GITHUB_TOKEN` |
| Без ИИ | Никаких вызовов LLM и MCP. Action не пишет в репозиторий и в Confluence |
| Ошибки | 401/403 → issue «watch: auth failed …», 404 → «watch: page not found» — одно открытое issue с лейблом `ba-watch-error` (дедупликация); job завершается успешно, сигнал — issue. Нет секретов → job падает с сообщением |

---

## 7. Human-in-the-loop

### 7.1 HITL-точки

| # | Где | Что решает BA | Как фиксируется |
|---|---|---|---|
| H0 | `/ba-new` | Страница, Jira-проект, стек, включить ли watch | `ba-project.yaml` + `approvals` |
| H1 | после шага 2 | Requirements → `reviewed` | `approvals`, header артефакта |
| H2 | шаг 3, Part B | Сначала сводная таблица CON/GAP/ASM/RSK (K-10), затем каждый CON: опция + исход (a/b/c); каждый GAP | `DEC-xxx` с `Decided by`, датой |
| H3 | шаг 4 | Ответы на OQ (backlog остаётся `Draft` — его ревьюит критик на шаге 5, как в DeskShare) | `DEC` в `analysis-log.md` |
| H4 | шаг 5 | Какие замечания критика принять; после разбора — backlog → `reviewed` | `review.md`: `BA outcome`, `Rejected by BA — …`; `approvals` (`stories`, `review`) |
| H5 | шаг 6 | Вопросы по spec (`OQ-Sn`) по одному, tech review | DEC, `approvals` |
| H5a | шаг 6 / `/ba-sync` | **Правило архитектора** (§3.2): общие данные против профиля `static`/`local` — сменить профиль, сузить требование или отложить | `CON-xxx` → `DEC-xxx`; `stack.deploy.profile` |
| H6 | шаг 7 | Каждая история после build (принять / вернуть); любая неоднозначность → стоп (`B-n`, при trade-off — DEC) | `build-status.md` (колонка BA) |
| H7 | шаг 8 | **Публичная выкладка** (GitHub Pages для `static`, prod-env для `cloudflare`) — отдельное «OK, выкладываем» в этом же разговоре; ввод секретов | `run-log`, `approvals` |
| H8 | шаг 9 | Спринт создан и запущен BA в UI Jira (K-16); план Jira (таблица) до любой записи — OK разрешает ровно эти задачи (K-15) | `jira-map.md` § Plan, `approvals` |
| H9 | `/ba-sync` | Классы изменений и план переделки построчно (Jira-строки плана = план `jira-sync`) | CHG `BA OK`, `Approved by`; `approvals` `{step: sync, status: plan-ok}` |
| H10 | `/ba-sync` → C4 | Каждый новый CON из-за изменения источника | как H2 |

### 7.2 Чего Claude никогда не делает сам

| Действие | Почему | Что вместо |
|---|---|---|
| Публичная выкладка (GitHub Pages, Cloudflare prod) без явного OK в текущем разговоре | Внешнее, публичное (репо public) | Показать команду и ждать OK. Одобрение прошлого раза не переносится |
| Выбирать или менять профиль деплоя, когда требования ему противоречат | §3.2, golden rule 4 | `CON-xxx` → стоп → решение BA |
| Просить, читать, писать, коммитить секреты (API-токены, `wrangler secret`, `.dev.vars`, GitHub Secrets) | Безопасность | BA вводит сам: `! npx wrangler secret put …`, `! gh secret set …` |
| Удалять задачи в Jira (и что-либо вне `jira.project_key`) | Необратимо | Лейбл `superseded` + комментарий |
| Писать в исходную страницу Confluence | Источник read-only (golden rule 1) | Вопросы — в CHG / analysis-log |
| Решать конфликт между стейкхолдерами | Golden rule 4 | Опции + рекомендация → BA |
| Ставить статус `approved` | Только BA (golden rule 8) | Предложить `reviewed` |
| Переписывать артефакты при `/ba-sync` до OK | §5.5 | Только снимок + CHG |
| `git push --force`, переписывание истории, push без запроса BA | Общая история проекта | Коммит — да, push — по запросу |
| Включать Action / писать секреты в GitHub без BA | Внешний сервис | `/ba-new` кладёт файл, включает BA |

### 7.3 Как обеспечиваем

| Уровень | v1 | v2 |
|---|---|---|
| Инструкции | `ba-rules` + шаги skills | — |
| Права | `settings.json` шаблона: `deny` для `mcp__<mcp_server>__updateConfluencePage` / `createConfluencePage` / комментариев (кит в Confluence не пишет вообще — правила прав не фильтруют по space); инструмента удаления задач у MCP нет, запрет — в `ba-rules` §6; `allow` для `createJiraIssue`, `editJiraIssue`, `transitionJiraIssue`, `addCommentToJiraIssue` — проверка — одобренный план (K-15); `wrangler deploy`, `wrangler d1 migrations apply`, `gh api`, `gh workflow run`, `gh secret`, `git push` → `ask` | — |
| Проверка после субагента | `review-backlog`: чистое дерево до критика, после — `git status --porcelain` содержит только `docs/03-backlog/review.md`, иначе стоп (§12.2) | — |
| Hook | — | PreToolUse-guard: блок записи в `docs/00-source/confluence/**` и вызовов Jira вне project key |

---

## 8. План тестов

| | A. Повтор DeskShare | B. Изменение страницы | C. Другая страница |
|---|---|---|---|
| **Цель** | Кит на том же источнике даёт сопоставимый результат без ручных правок промптов | `/ba-sync` правильно классифицирует изменения и переделывает только затронутое | Ничего DeskShare-специфичного не зашито |
| **Источник** | `65670` v2 | `65670` v2 → v3 и далее, по версии на сценарий (правит BA руками в Confluence) | `294916` v1 — «GearLoan — Requirements Gathering (TEST CASE)», DSSRC; создана 2026-10-20 дословно из `tests/fixtures/test-c-gearloan-handoff.md` |
| **Jira** | `KAN` | `KAN` | `KAN` (лейбл `gearloan-kit-test`) |
| **Репозиторий** | новый **public** `hellatkacheva/deskshare-kit-test` (не DeskShare) | тот же, что A | новый public `hellatkacheva/gearloan-kit-test` |
| **Профиль деплоя** | `static` (default) | — | `static` (default) |
| **Шаги** | `/ba-new <url> --jira KAN` → `/ba-continue` до шага 9; в конце — реальная выкладка на GitHub Pages (H7) | после A: правки по таблице §8.1 — по одной версии страницы на сценарий → `/ba-sync` (B7 — через Action) | `/ba-new <url> --jira KAN` → шаги 1–6 (+ 9 по желанию) |
| **Ожидаемо** | Ключи источников `HO/CTX/W1–W3` выведены сами; CON по C1/C3 из W3 найдены; **CON правила архитектора (§3.2)** на шаге 6: общий лимит этажа и бронь стола между сотрудниками против `static` — кит сам поднимает CON с опциями `static`/`local`/`cloudflare` и рекомендацией, останавливается, решение BA записано как `DEC` (исход заранее не фиксирован, Q9); число REQ/CON/US сопоставимо с DeskShare (±30 %); 0 строк без цитаты; Jira: эпики + истории + вопросы, повторный `jira-sync` создаёт 0 дублей; рабочий URL на GitHub Pages | См. таблицу B | Ни одного упоминания DeskShare/BAWT3/Cloudflare вне yaml; ключи источников `HO/CTX/W1/W2` из заголовков; CON шага 3: 14 дней vs «месяцами» (Ken/Marta), бронь vs FCFS, история ≥ 1 год vs минимум данных (Lena/Priyanka), email-напоминания vs «no email»; GAP: число предметов, выходные, дата демо, повреждённые предметы; **CON правила архитектора**: «кто взял что», возврат отмечает только Ken, журнал для аудита против `static` + «Ken: no servers» → стоп, решение BA |
| **Известное отличие** | В DeskShare был ещё `01-workshop-brief.md` из PDF (ключ `BR`). С v1.3 он есть в Confluence как дочерняя страница `458755` «Workshop brief (source copy)» у `65670` (§12 K-6), источник по-прежнему только Confluence (Q4). Если дочерняя страница не взята в ingest, темы с источником `BR` в golden считаются `n/a`. Если по CON архитектора BA выберет `static` с ограничением «одно устройство», это отмечается в отчёте как **осознанное отличие от DeskShare** (там `cloudflare`) | — | — |
| **Метрики** | Время на шаг, число правок BA (`run-log`), совпадение с DeskShare по ключевым DEC | Precision/recall классов по таблице B, число лишне затронутых элементов = 0 | То же, что A |
| **Golden после шага 2** | После `requirements` (draft, до review BA) сравнить покрытие тем с `tests/golden/deskshare-step2.md` (REQ-001…014, NFR-001…009, наблюдения O-01…O-16) по инструкции в файле. **Критерий: все темы `Must` покрыты.** Результат — таблица в отчёте теста | — | — |

### 8.1 Сценарии B

Старт: проект `deskshare-kit-test` после теста A — все шаги `reviewed`, `65670` v2, ребёнок `458755` v1, KAN-1…36. Каждая правка — **отдельная версия страницы** (одно сохранение в Confluence) и отдельный `/ba-sync` → свой CHG; следующую правку BA делает только после закрытия предыдущего CHG (коммит). Номера версий ниже — если BA сохраняет страницу ровно один раз на сценарий.

**Подготовка (до B0):** (1) тег `test-b-start` в тестовом репо — точка отката; (2) в `.claude/settings.json` тестового проекта — права по K-15 (`/ba-new` уже не перезапускается, BA правит вручную или по просьбе); (3) плагин 0.4.0 перезагружен; (4) `/ba-status` показывает «Confluence = локально, v2».

| # | Правка на странице `65670` (раздел → было → стало) | Ожидаемый класс | Что кит должен найти (Impact) | Что должно измениться после OK | Что **не** должно меняться |
|---|---|---|---|---|---|
| B-neg | Ничего не править, `/ba-sync` | — | «изменений нет» | ничего (ни снимка, ни CHG, `git status` чистый) | всё |
| B0 → v3 | W2 · Booking a desk, первый пункт: выделить курсивом *no approval step* (текст не меняется) | C0 (`op: cosmetic`) | 1 изменение, 0 затронутых элементов | снимок `65670/v3`, CHG-001 (один пункт плана), `source.version: 3`, `source_version` шагов → 3 | все артефакты 01–05, Jira |
| B1 → v4 | CTX · **Current state:** «forget to release a booking when plans change» → «forget to release a booking when **their** plans change» | C1 | цитата в REQ-014 и в §2 requirements (строка «Problem — the spreadsheet fails») больше не дословна; REQ-023, CON-005, CON-006 цитируют тот же блок, но их цитаты остались в новом тексте → Not affected | REQ-014 и строка §2: цитата обновлена на месте + `Revised CHG-002 (C1)`; `steps.requirements` stale → draft | истории, spec, код, Jira; новые ID не появляются |
| B2 → v5 | W2 · Booking a desk: «Floor 1 (capacity 30)» → «Floor 1 (capacity **35**)» | C2 | REQ-004 (значение 30); CON-006 (цитата); истории с 30 / F1-30: US-002, US-003, US-004, US-006, US-013; `config.md` `FLOORS` (F1 desks 30); `demo-data.md`, `ui.md`, `test-plan.md`; тесты этих историй; Jira KAN-7, KAN-9, KAN-10, KAN-13, KAN-22 (описания с 30); build-status. REQ-003, REQ-005 (F2 = 25) → Not affected | новый REQ-0xx «Floor 1: 35», REQ-004 → `Superseded by REQ-0xx (CHG-003)`; истории — `Revised: CHG-003` (правила / AC 30 → 35, `Traces to` с новым REQ); `FLOORS` 35, seed; тесты сначала красные, затем зелёные (build по одной истории, приёмка BA); деплой — только по OK; Jira — update описаний ровно этих ключей | Floor 2 (25), истории без ёмкости (US-005, US-007…US-012, US-014…US-017), задачи-вопросы |
| B3 → v6 | W2 · **Decisions:** добавить первый пункт «Bookings can be made at most 14 days ahead.» | C3 | новый блок без трассы; он отвечает на GAP-004 и закрывает ASM-010 (окно «today + 6 days»); `BOOKING_WINDOW_DAYS = 6` в `config.md`; истории с окном: US-002, US-003, US-005; Jira Q7 (KAN-29) и истории KAN-7, KAN-9, KAN-11 | новый REQ-0xx (`Proposed`, цитата из v6); ASM-010 → `Superseded by REQ-0xx (CHG-004)`; GAP-004 отвечен; `BOOKING_WINDOW_DAYS` 14; истории `Revised`; тесты; Jira: update историй, комментарий в KAN-29 + переход в Done — только если эта строка одобрена BA | остальные ASM / GAP, ёмкость, Floor 2 |
| B4 → v7 | W2 · Capacity limits: «Agreed: no waitlist in this PoC — if a floor is full, the employee is told to pick another day or floor. Waitlisting was parked as a future-phase idea, not built now.» → «Agreed: a waitlist is in scope for this PoC — if a floor is full, the employee can join a waitlist for that day and floor.» | C4 | разворот DEC-005 «No waitlist» и OOS-006; затронуты REQ-012 (сообщение «pick another day or floor»), US-006 (правило 4 «No waitlist», сообщение о полном этаже), `ui.md`, `test-plan.md`; **правило архитектора**: лист ожидания между сотрудниками = общие данные против `static` (DEC-014) — анализ должен сказать, покрывает ли DEC-014 | **стоп H10**: новый CON-0xx (позиция A — новый текст W2, позиция B — DEC-005 / OOS-006 и профиль `static`), опции + рекомендация; дальше — только после решения BA (DEC-0xx; DEC-005, OOS-006 → `Superseded`; при «в объёме» — новый REQ, новая история US-018, Jira create; при Deferred — только DEC и вопрос спонсору) | ничего ниже шага 3 до решения BA |
| B5 → v8 | W2 · Out of scope, explicitly confirmed: удалить пункт «No mobile app — responsive browser use is enough for the demo.» | C5 | OOS-004 «Mobile app» (единственный источник удалён); NFR-001 (одна из двух ссылок — `[W2 · Out of scope…]`, цитата пропала; `[W1 · Decisions]` осталась); US-015 (цитата); `architecture.md`, `ui.md` | OOS-004 → `Superseded by CHG-006 — removed from the source`; NFR-001 — источник и цитата заменены на оставшийся `[W1 · Decisions]` (новый ID или `Revised` — по классу, который BA утвердит); вопрос BA: удаление строки ≠ «мобильное приложение теперь в объёме» → GAP к Priya, а не новая история; US-015 — `Traces to` | код, тесты, Jira (кроме KAN-8, если его описание цитирует удалённую строку) |
| B6 | Создать дочернюю страницу «Workshop 4 minutes» под `65670`: H2 «Decisions» с пунктом «Employees can add a short note (up to 50 characters) to a booking, e.g. "need a monitor".» | C6 → C3 | новая страница (`458755` не изменилась → `458755:1:1`); новый ключ источника `W4`; новая информация без трассы; правило архитектора — нет новой потребности в общих данных (заметка в своей брони) | снимок `confluence/<newId>/v1/`, `03-workshop-4-minutes.md`, ключ `W4` в README, `source.children` +1; новый REQ-0xx, новая история US-0xx (Draft → критик в scoped mode), test-plan, build по OK, Jira create (история в спринт) | существующие REQ / US / Jira-задачи |
| B7 | Watch: `/ba-sync setup-watch`; BA — секреты и `watch.enabled: true`, push. Затем: правка C0 → `gh workflow run confluence-watch` → ещё правка → снова запуск → запуск без правок | — | — | 1-й запуск: одно issue «Confluence page 65670 changed: v<N> → v<N+1> — run /ba-sync» с таблицей; 2-й: комментарий в том же issue; 3-й: ничего нового («already reports this state») | второго issue нет; репозиторий и Confluence не меняются |
| B7-err | Временно испорченный `CONFLUENCE_API_TOKEN` → запуск → вернуть токен | — | — | одно issue `ba-watch-error` «watch: auth failed …»; повторный запуск — без второго issue | — |

**Метрики:** класс каждого изменения = ожидаемому (precision / recall по классам); затронутые элементы = колонке «найти» (лишние и пропущенные — отдельно); лишне изменённых файлов = 0 (`git diff --stat` после переделки ⊆ строкам плана); `trace-auditor` — «Trace intact»; Jira: 0 дублей, 0 удалений, изменены только ключи из плана; время на CHG.

**Ограничение:** вложения через MCP не видны — сценарий с вложением проверяется только через Action (`include_attachments`), `/ba-sync` берёт файл из `inbox/`.

## 9. Решения BA по вопросам (2026-10-20)

| # | Вопрос | Решение | Где отражено |
|---|---|---|---|
| Q1 | Вложения | **A** — список через REST, файлы BA кладёт в `inbox/` | §4.3 |
| Q2 | Страница для теста C | Вымышленный кейс GearLoan: `tests/fixtures/test-c-gearloan-handoff.md` → Confluence page `294916` (DSSRC) | §8 |
| Q3 | Тестовый репозиторий | Да, **public** (GitHub Pages на бесплатном аккаунте — только public) | §3 `repo.*`, §8 |
| Q4 | PDF brief в тесте A | Только Confluence, разницу фиксируем | §8 A |
| Q5 | Деплой | `stack.deploy.profile` по умолчанию `static` (GitHub Pages, без общих данных); в тесте A — реальная выкладка на GitHub Pages в конце | §3.1, §8 |
| Q6 | Язык | Skills — EN, отчёты в чате — RU, этот документ — RU | §2.1 |
| Q7 | `/ba-continue` | До ближайшей HITL-точки | §1.2 |

| Q8 | Хранилище профиля `local` | Node + SQLite на ноутбуке (общие данные в пределах ноутбука/Wi-Fi); `localStorage` — только у `static`, иначе `local` дублирует `static` | §3.1, §3.2 |
| Q9 | Исход CON правила архитектора в тесте A | Заранее не фиксируем. Критерий: кит сам поднял CON (`static`/`local`/`cloudflare` + рекомендация) и остановился; решение логируется DEC. Если BA выберет `static` «одно устройство» — в отчёте теста это осознанное отличие от DeskShare (`cloudflare`) | §3.2, §8 A |

Открытых вопросов нет.

## 11. Changes after review

Принято BA 2026-10-20 по итогам итерации 1 сборки. Статус документа остаётся Reviewed.

| # | Было в дизайне | Стало | Причина | Затронутые разделы |
|---|---|---|---|---|
| R1 | Skills шагов 1–2: `ingest`, `extract-requirements` | `ingest-confluence`, `requirements` | Имена из задания на итерацию 1; `ingest-confluence` прямо говорит об источнике (ручные файлы из `inbox/` — часть того же skill) | §1.3, §2.1, §4 |
| R2 | Шаблоны проекта в `templates/project/` в корне плагина | `skills/ba-rules/templates/project/` | Skill находит свои файлы через собственную папку (её путь Claude Code сообщает при загрузке skill). Для произвольной папки в корне плагина надёжного пути из command/skill нет. `ba-rules` загружается первым в каждой команде, поэтому шаблоны всегда доступны | §1.1, `/ba-new` |
| R3 | `jira.statuses.{todo,in_progress,done}` заполняет `/ba-new` | `/ba-new` оставляет `null`; заполняет `jira-sync` при первом запуске | Через Atlassian MCP ID статусов читаются только из переходов существующей задачи (`getTransitionsForJiraIssue`), а при `/ba-new` в проекте может не быть задач. ID типов задач и `priority_on_create` `/ba-new` по-прежнему читает из метаданных проекта | §3, §1.3 `jira-sync` |

## 12. Changes after test A

Принято BA 2026-10-21 и 2026-10-22. K-1…K-6 — по итогам теста A, шаг 2 (`requirements` на `65670` v2), версия v1.3. K-7…K-9 — по итогам повторного прогона теста A (golden: 27/27 Must), версия v1.4. K-10, K-11 — по итогам теста A, шаги 3–5 (отчёт `deskshare-kit-test/docs/test-reports/test-a-steps1-5.md`), версия v1.6. K-12, K-13 — из того же отчёта (§4 «Other observations»), приняты BA 2026-10-22, версия v1.7; в skills / агент ещё не внесены. K-14…K-17 — по итогам теста A, шаги 6–9 (отчёт `deskshare-kit-test/docs/test-reports/test-a-steps6-7.md` и прогон шагов 8–9, `run-log.md` 2026-10-23), версия v1.8, внесены в skills. Статус документа остаётся Reviewed.

| # | Что найдено в тесте | Изменение в ките | Затронутые файлы / разделы |
|---|---|---|---|
| K-1 | На Windows git (autocrlf) меняет переводы строк в снимках Confluence — снимок перестаёт совпадать с ответом MCP, diff в `/ba-sync` даёт ложные изменения | Шаблон проекта: `.gitattributes` с `docs/00-source/confluence/** -text`; `/ba-new` копирует его вместе с `.gitignore` | `skills/ba-rules/templates/project/.gitattributes`, `commands/ba-new.md`, §4.2 |
| K-2 | `/ba-continue` был заглушкой — BA вызывал skills вручную | Минимальный маршрутизатор: по `ba-project.yaml` выбирает шаг (или берёт аргумент), проверяет gate, запускает реализованный skill (`ingest-confluence`, `requirements`) и останавливается на ближайшей HITL-точке; шаг в `draft` ждёт review BA и не перезапускается; для нереализованных шагов честно отвечает «итерация 2» и ничего не пишет | `commands/ba-continue.md`, §1.2 |
| K-3 | Составные REQ (два правила в одной строке); у действий не было записано, что меняется в состоянии | Правило атомарности: одно проверяемое правило = один REQ. Для каждого действия — отдельный REQ об эффекте на состояние (счётчики, статусы, доступность); если источник молчит — наблюдение, не выдумка | `skills/requirements/SKILL.md` (Row rules, Quality bar) |
| K-4 | §8 «Наблюдения» беднее, чем в DeskShare: не было противоречий между протоколами, качества данных, NFR-пробелов, роста scope | Обязательный чек-лист §8: противоречия и ссылки на то, чего нет в другом протоколе; качество и полнота присланных данных; данные, которых не хватает для требования; двойственные статусы; NFR-категории (доступность, браузеры, одновременные пользователи, миграция, хранение, логи); рост scope против fixed scope; общие данные (вход правила архитектора). Пункт без находки всё равно пишется одной строкой | `skills/requirements/SKILL.md` (§8 checklist), `templates/requirements.md` §8 |
| K-5 | Сравнение с DeskShare делалось на глаз | Golden-тест `tests/golden/deskshare-step2.md`: темы слоя шага 2 DeskShare (commit `e8f3d88`: REQ-001…014, NFR-001…009, наблюдения O-01…O-16) с весом Must/Should. В плане тестов (§8 A): после `requirements` сравнить покрытие, критерий — все темы `Must` покрыты | `tests/golden/deskshare-step2.md`, §8 |
| K-6 | В Confluence не было workshop brief (`BR`) — REQ/CST из брифа (сроки, Cloudflare, «one screen») выпадали | Создана дочерняя страница `458755` «Workshop brief (source copy)» у `65670` в DSSRC — дословно `docs/00-source/01-workshop-brief.md` DeskShare. Тест A берёт её через `include child pages` | Confluence DSSRC, §8 A «Известное отличие» |
| K-7 | Снимки дочерних страниц лежали внутри папки родителя (`v<N>/children/`): новая версия ребёнка (напр. бриф `458755`) потребовала бы менять неизменяемый снимок родителя или делать новую версию родителя без изменений в нём | Отдельная папка на каждую страницу: `confluence/<pageId>/v<N>/` — и для главной, и для каждой дочерней, у каждой своя версия. Снимок родителя не меняется, когда меняется только ребёнок. В `meta.json` родителя — список дочерних `{id, title, version}` на момент снимка; текущий список — `source.children` | `skills/ingest-confluence/SKILL.md` §1–2, §4.1–4.2 |
| K-8 | Ключ на каждый H2 дробил дочернюю страницу на много ключей (в DeskShare бриф — один ключ: `[BR · Stakeholders]`); unescape `\~` давал цитаты, которых нет в `page.md` | Дочерняя страница получает **один ключ на всю страницу** (по названию, напр. `BR`); раздел — её заголовок H2: `[BR · <H2>]`. Главная страница — как раньше: ключ на H2. Unescape `\~` (и других `\`-артефактов) **не делаем** — рабочий источник совпадает с `page.md` символ в символ | `skills/ingest-confluence/SKILL.md` §3 |
| K-9 | Выведенные требования (эффекты на состояние, следствия из definition of done) — не прямая цитата, но по статусу не отличались от `Confirmed` | Статус **`Derived — needs BA confirmation`**: в колонке Quote — исходные дословные фрагменты + `Rationale:`. Подтверждает только BA в review → `Confirmed (derived, BA <date>)`, отклонённые → `Removed in BA review` (ID не переиспользуется). Неподтверждённый `Derived` не идёт в истории и попадает в GAP шага 3. Если источник ничего не подразумевает — это наблюдение, не `Derived` | `skills/requirements/SKILL.md`, `templates/requirements.md`, `skills/ba-rules/SKILL.md` §4 |
| K-10 | `analyze-conflicts` записал Part A и сразу задал вопрос по первому CON. BA остановил его и попросил сначала сводку: решения связаны между собой (CON-006 «стол vs этаж» поменял вариант B у CON-001, ASM зависят от CON), а без общей картины не видно пропущенных CON | Part B, шаг 0: **одна таблица** всех CON / GAP / ASM / RSK (ID · суть в одну строку · варианты · `Claude's recommendation`) + список наблюдений и противоположных позиций, которые **не** стали CON, и куда они записаны; вопрос «Начинаем решать?» (по одному или одним ответом). CON, добавленный BA по сводке, сначала дописывается в Part A. При возобновлении сводка показывается снова с отметкой решённого. Quality bar: сводка показана до первого решения | `skills/analyze-conflicts/SKILL.md` (Part B, Quality bar), §7.1 H2 |
| K-11 | Две противоположные позиции названных людей записаны как GAP: «стол vs этаж» (Priya vs Sam) → GAP-007, «отменить *свою* бронь» без идентификации (Dana vs нет логина) → GAP-006 → ASM. В DeskShare обе — CON; в тесте A CON-006 BA поднял вручную | Правило Part A: если открытый вопрос можно ответить двумя способами, и каждый совпадает с цитируемой позицией названного стейкхолдера (или требование vs записанное решение / ограничение / OOS), — это **CON** с обеими позициями и вариантами, а не GAP и не молчаливое ASM. GAP — только недостающий факт. Quality bar: «ни один GAP / ASM не прячет две цитируемые позиции». Ожидание в повторе теста A: «стол vs этаж» и «своя бронь» выходят CON | `skills/analyze-conflicts/SKILL.md` (Part A §1, §3, Quality bar), §8 A |
| K-12 | Файлы и наборы данных, на которые ссылается источник, но которых нет, стали только RSK / SI: выборка с no-show «roughly 1 in 5» и таблица ёмкостей (Priya), fire-drill use case (Dana), пиковый спрос по anchor days. В DeskShare по каждому — вопрос владельцу (ref GAP-009, GAP-010, GAP-012) | Каждый файл или набор данных, на который ссылается источник, но которого нет в `docs/00-source/`, — **GAP к его владельцу** (как назван в источнике): что это, где упомянуто (`[KEY · Section]`), что от него зависит. `ingest-confluence` записывает его в README → Known missing inputs с владельцем; `requirements` — в §8 п. 2 с владельцем; `analyze-conflicts` переносит каждый пункт в GAP (а не только в RSK / SI). Quality bar: каждая строка Known missing inputs — GAP с владельцем или BA явно закрыл её | `skills/ingest-confluence/SKILL.md`, `templates/README.md` (00-source); `skills/requirements/SKILL.md` (§8 п. 2); `skills/analyze-conflicts/SKILL.md` (Part A §3, Quality bar) |
| K-13 | Критик не нашёл утечку присутствия через сообщение валидации: в варианте A без имён сообщение «This name already has a booking for that day» сообщает, что названный коллега в этот день в офисе (DeskShare ref DEC-028) | `backlog-reviewer` проверяет **утечки приватных данных через сообщения валидации и ошибки**: для каждого сообщения об отказе / ошибке — что оно раскрывает о других людях (присутствие, существование записи, чужое имя) сверх того, что показывает экран, и противоречит ли это privacy-NFR / DEC (например, вариант без имён). Находка — `Major`, при trade-off — `BA decision` | `agents/backlog-reviewer.md` (чек-лист), `skills/review-backlog/SKILL.md` |
| K-14 | BA сказал «сделай все стори и закомить их» — H6 (приёмка каждой истории) снят для US-005…US-013. В `approvals` это попало только через день, по просьбе BA; в `build-status.md` — заметка «BA check pending» | **Снятый гейт пишется сам:** когда BA отменяет точку решения («собери все истории сразу», «не останавливайся»), skill шага сразу добавляет в `approvals` `{step, status: gate-waived, by, date, note: "<гейт> waived — '<слова BA>'; scope: …"}`, помечает сделанное «без проверки BA — pending» и в конце запуска просит отложенную проверку. Отмена действует только на названный объём и не распространяется на §7.2 | `skills/ba-rules/SKILL.md` §4, `skills/build/SKILL.md` (Rules) |
| K-15 | `jira-sync` (36 задач): после OK BA на план каждый `createJiraIssue` / `editJiraIssue` / `transitionJiraIssue` всё равно спрашивал подтверждение (`ask` в шаблоне прав) — десятки одинаковых вопросов | **Одобренный план = разрешение на ровно эти записи.** Шаблон `.claude/settings.json`: Jira create / edit / transition / comment → `allow`; `deny` на запись в Confluence остаётся; удаления задач нет (`ba-rules` §6). Проверку делает skill: план сохраняется в `jira-map.md` § Plan, каждая запись соответствует строке `#`; запись вне плана → стоп, дополнение плана, OK BA | `skills/jira-sync/SKILL.md` §1, §2; `templates/project/.claude/settings.json`; §7.3 |
| K-16 | Спринт создан BA, но не запущен (`future`); ссылка на доску из кита не открывалась (пустая доска без активного спринта); эпики в спринт не встали (team-managed — по дизайну Jira) — выяснилось ошибкой; Done-задачи не видны в бэклоге — BA искал их | **Спринт до создания задач:** `jira-sync` просит BA создать **и запустить** спринт (если Jira не даёт запустить пустой — сначала одна история, BA перетаскивает её в спринт и запускает); id / state / board читаются из поля спринта задачи → `jira.sprint`, id не угадывается. Ссылка на доску — **только при активном спринте**, иначе — ссылка на бэклог и просьба запустить. В плане заранее: эпики team-managed в спринт не ставятся. В плане и в отчёте: Done-задачи не видны в Backlog — смотреть на Доске (колонка Done) или в Списке (`/list`) | `skills/jira-sync/SKILL.md` §0, §0a, §1, §3, §4; `ba-project.yaml` `jira.sprint`; §3, H8 |
| K-17 | Тест A, B-4: в пакетной сборке код US-005 написан раньше тестов — тесты ни разу не были красными | **build: код раньше теста → стоп.** Если код истории появился до того, как её тесты были увидены красными (написан раньше в этом запуске, остался от пакета, или новые тесты сразу зелёные, хотя история требует нового поведения), — не продолжать и не коммитить; сообщить BA (история, файлы, как вышло) с вариантами: (a) убрать код, увидеть красные тесты, вернуть код (`Claude's recommendation`); (b) оставить и записать отклонение `B-n`. Проверочная история без нового поведения — не отклонение | `skills/build/SKILL.md` (шаг 2) |

### 12.1 Итерация 2a — шаги 3–5

Реализованы skills `analyze-conflicts`, `write-stories`, `review-backlog` и агент `backlog-reviewer` — порт DeskShare `.claude/commands/{analyze-conflicts,write-stories,review-backlog}.md` и `.claude/agents/backlog-reviewer.md` без специфики проекта (имена, Jira, Cloudflare, даты — из `ba-project.yaml`). `/ba-continue` маршрутизирует на них; `spec`, `build`, `deploy`, `jira-sync` — «итерация 2b».

| # | Решение при реализации | Было | Причина |
|---|---|---|---|
| I2a-1 | **Правило архитектора срабатывает уже в `analyze-conflicts`** (Part A, CON с тегом `Architect rule`, решается в Part B вместе с остальными CON). `spec` перепроверяет и поднимает новый CON только для потребностей в общих данных, не покрытых DEC | §3.2: только `spec` и `change-impact` | Задание на итерацию 2a. Решение о профиле нужно до историй: иначе `write-stories` пишет истории под профиль, который потом сменится |
| I2a-2 | Каждое наблюдение §8 из requirements обязано попасть в CON / GAP / SI / RSK / ASM или в список «Observations not carried forward» с причиной | — | Трассировка K-4 → шаг 3 |
| I2a-3 | Шаги 3 и 5 возобновляемые: `/ba-continue` на `draft` с открытыми CON/GAP (шаг 3) или с находками без решения BA (шаг 5) продолжает решения с первого открытого пункта | K-2: `draft` = ждёт review | HITL-решения в этих шагах длинные, BA может прерваться |
| I2a-4 | ~~Гейт шага 5: backlog `reviewed` (H3)~~ — **заменено решением BA §12.2 (B-1)**: критик ревьюит `Draft`-бэклог, как в DeskShare | DeskShare | — |
| I2a-5 | `backlog-reviewer` дополнительно проверяет соответствие историй профилю деплоя и DEC правила архитектора (несоответствие — Blocker, `BA decision`) и полноту A/B-групп | DeskShare: 8 проверок | Профиль деплоя в ките — переменная, а не данность |

### 12.2 Решения BA по итерации 2a (2026-10-21)

| # | Решение BA | Что изменено | Затронутые файлы / разделы |
|---|---|---|---|
| B-1 | **Гейт ревью — как в DeskShare.** `backlog-reviewer` ревьюит бэклог в статусе `Draft`; BA разбирает замечания и только потом переводит бэклог в `Reviewed`. Заменяет I2a-4 | Гейт `review`: `stories` ≥ `draft` (исключение в `ba-rules` §4). `write-stories` оставляет бэклог `Draft` и не просит review. `/ba-continue`: `stories` в `draft` → шаг `review`; после ответов на OQ шаг 4 переходит в шаг 5 в том же запуске. По «reviewed» BA после разбора замечаний: `backlog.md` и `review.md` → `Reviewed`, `steps.stories` и `steps.review` → `reviewed`, две строки в `approvals`. H3 — только ответы на OQ, H4 — замечания + перевод бэклога в `reviewed` | §1.3, §7.1 (H3, H4), `ba-rules` §4, `write-stories`, `review-backlog`, `/ba-continue` |
| B-2 | **Минимум инструментов у критика + проверка `git status`.** У `backlog-reviewer` только Read, Grep, Glob, Write | `review-backlog`: до вызова агента дерево должно быть чистым (иначе предложить коммит `step 4: backlog v1` и ждать); после — `git status --porcelain` содержит только `docs/03-backlog/review.md`, иначе стоп, список путей BA, отчёт не используется, ничего не откатывается без BA | §1.4, §7.3, `review-backlog`, `agents/backlog-reviewer.md` |
| B-3 | Принято: каждое наблюдение §8 из requirements попадает в CON / GAP / SI / RSK / ASM или в «Observations not carried forward» с причиной | без изменений (I2a-2) | `analyze-conflicts` |
| B-4 | Принято: критик проверяет совместимость историй с профилем деплоя и DEC правила архитектора, и полноту A/B-групп | без изменений (I2a-5) | `agents/backlog-reviewer.md` |

### 12.3 Итерация 2b — шаги 6–9 (2026-10-22)

Реализованы skills `spec`, `build`, `deploy`, `jira-sync` — порт DeskShare `.claude/commands/{spec,build,deploy,jira-sync}.md` (DeskShare только читался) без специфики проекта: сайт, MCP-сервер, Jira key, ID типов, метки, профиль деплоя, репозиторий — из `ba-project.yaml`. `/ba-continue` маршрутизирует на шаги 6–9. Версия кита 0.3.0.

| # | Решение | Было (DeskShare / дизайн) | Причина |
|---|---|---|---|
| I2b-1 | **spec**: architecture, data-model, api (`local`/`cloudflare`) или storage (`static`), ui, config, test-plan, demo-data — по таблице стека профиля. Правило архитектора перепроверяется до записи; новый CON — только для потребностей в общих данных, не покрытых DEC шага 3 (или более позднего) → стоп. Вопросы `OQ-Sn` по одному → DEC; интерпретации `I-n` — на review BA. `stack.constraints` пишет spec | DeskShare: «Fixed technical decisions» Cloudflare в тексте команды | §2.2, §3.2, I2a-1 |
| I2b-2 | **Стек по профилю.** `static`: HTML/CSS/JS без фреймворка и сборки в `app/public/` + `localStorage` за одним модулем хранения (версионный ключ, try/catch); `local`: Node ≥ 22 (`node:http`) + SQLite через встроенный `node:sqlite`; `cloudflare`: TypeScript Worker + D1 + static assets, Vitest с `@cloudflare/vitest-plugin`, `wrangler dev --local`, как в DeskShare. Везде: один config-модуль, один clock с тестовым override, Vitest + Playwright (десктоп и 375×667) | §3.1: только названия профилей | `node:sqlite` — без нативных модулей (на Windows без build tools `better-sqlite3` не ставится); `app/public/` — то, что публикуется |
| I2b-3 | **Тестовые хуки выключены в выложенной сборке**: `static` — только на `localhost`; `local`/`cloudflare` — переменная окружения, в проде off. Из URL выложенного приложения нельзя ничего стереть, кроме защищённого demo-reset, если он есть в истории | DeskShare: `TEST_HOOKS=off` в `env.production` | Тест A, review #10: `?reset-demo` в URL стирал демо |
| I2b-4 | **build**: одна история за запуск, сначала тесты (должны упасть), потом минимум кода, весь набор зелёный; BA принимает каждую историю (колонка `BA` в `build-status.md`); следующая история — только после принятия или «continue». Вопросы → `B-n`, trade-off → DEC в `analysis-log.md` | DeskShare `/build` | — |
| I2b-5 | **deploy**: `static` → GitHub Pages через Actions-workflow из шаблона `skills/deploy/templates/pages.yml` (публикует `app/public/`); `local` → инструкция запуска в `app/README.md` (как открыть с телефона в той же Wi-Fi), публичного URL нет; `cloudflare` → D1 + миграции + `wrangler deploy --env production`, как в DeskShare. После каждой выкладки — smoke-тест на результате. Каждая публичная выкладка — после явного OK BA в текущем разговоре; логины и секреты вводит BA (`! …`); если проверка прав Claude Code блокирует команду — BA запускает её сам | §3.1: «Action `pages` из ветки/папки» | Pages из ветки умеет только `/` или `/docs`, а `docs/` занят артефактами |
| I2b-6 | **Гейт deploy**: spec `reviewed` + все истории Core demo приняты BA; build может быть ещё `draft` (дальше — передеплой по одной истории, как в DeskShare). **Гейт jira**: только review `reviewed` | §1.2: предыдущий шаг ≥ `reviewed` | DeskShare выкладывал Core demo до конца build; Jira нужна и до кода |
| I2b-7 | **jira-sync**: MCP-сервер, cloudId, ключ, ID типов, `priority_map`, метки `jira.labels.project` и **`jira.labels.moscow`** — из yaml; план → OK BA (`approvals`) → создание без дублей (поиск JQL по метке проекта и `summary ~ "US-xxx"`; найдено — update); удаления нет, устаревшее — метка `superseded`. `jira.statuses` заполняются на первом запуске из переходов первой созданной задачи (по категории статуса). После создания одна история читается обратно — таблицы при конвертации могли потеряться. **Спринт создаёт BA в UI Jira** (у MCP нет инструментов спринта); добавить задачи в спринт правкой поля — только по просьбе BA | DeskShare: BAWT3, ID и сайт в тексте команды | §2.2, R3; DeskShare: потеря таблицы в BAWT3-8, спринт вручную |
| I2b-8 | Профиль `none`: `spec`, `build`, `deploy` → `skipped` по OK BA; `/ba-continue` переходит к `jira` | §3.1 | — |
| I2b-9 | Права шаблона проекта: `ask` дополнительно для `npx wrangler d1 migrations apply`, `gh api`, `gh workflow run`; `.gitignore` — `app/data/` (SQLite профиля `local`) | §7.3 | Публикующие команды проходят через подтверждение |

Приняты BA 2026-10-22 (после реализации): метки по умолчанию (`jira.labels`, I2b-7), `node:sqlite` для профиля `local` (I2b-2), публикация `static` через Actions-workflow (I2b-5).

## 13. Итерация 3 — `/ba-sync`, `change-impact`, агенты, watch (2026-10-23)

Реализованы команда `/ba-sync` (+ `setup-watch`), skill `change-impact` со скриптом `scripts/blockdiff.mjs`, агенты `impact-analyst` и `trace-auditor`, шаблон Action `confluence-watch` (`.github/workflows/confluence-watch.yml` + `scripts/confluence-watch.mjs` в `skills/ba-rules/templates/project/`). Scoped mode шагов — `ba-rules` §4, режим «только снимок» — `ingest-confluence`, scoped mode Jira — `jira-sync`. Версия кита 0.4.0. Скрипт diff проверен на копии снимков теста A (не в тестовом проекте): 164 / 166 цитат найдены (2 — не цитаты источника), правки B1–B5 на копии v3 дали ожидаемые изменения и затронутые элементы (§8.1), `<br>` / переносы → `cosmetic`.

| # | Решение | Было (дизайн) | Причина |
|---|---|---|---|
| I3-1 | `/ba-sync` без `--version N`; снимок — текущая версия из Confluence (обычно `v<N+1>`, при нескольких правках — кумулятивный CHG) | §1.2: `[--version N]` | MCP отдаёт только текущую версию (§4.2) |
| I3-2 | `trace-index.json` не храним: связь «цитата → блок» строит детерминированный скрипт `blockdiff.mjs` (`diff` → `hits` у каждого изменения, `quotes` → цитаты, которых нет в снимке). Разрывы трассировки до sync не блокируют автоматически — BA решает, исправить или продолжить | §5.1 п. 4, §5.2: `trace-auditor` строит индекс, разрыв блокирует | Индекс устаревал бы после каждой правки артефактов; скрипт воспроизводим. В тесте A есть ложные срабатывания (текст UI в строке со ссылкой) — блок по ним остановил бы sync без причины |
| I3-3 | Оба агента **только читают** (Read, Grep, Glob) и возвращают текст; файлы пишет основной поток после проверки (у каждого D-n класс, ID существуют, Jira-ключи из `jira-map.md`) | §1.4: Write в `docs/07-changes/` / `docs/.ba/` | Задание на итерацию 3; как у критика (B-2) — запись только там, где её видит BA |
| I3-4 | Истории при C2 / C3 правятся на месте со строкой `Revised: CHG-xxx — <что>` (тот же Jira-ключ); `Superseded` — только для истории, которая больше не верна. REQ / NFR / CST / OOS / DEC / CON — по-прежнему новый ID + `Superseded by` | §5.5: любой изменённый элемент → новый ID | Новый ID истории ради одного числа плодил бы дубли в Jira и терял историю задачи; трасса сохраняется через `Revised` и новый REQ |
| I3-5 | Jira-строки одобренного плана CHG = план `jira-sync` (scoped mode, без второго OK); любая Jira-запись сверх них → новый план → OK | §5.5 | Как K-15: одно одобрение на один набор записей |
| I3-6 | `trace-auditor` запускается после переделки (фаза B4) и по просьбе BA; проверки T1–T10, включая «изменения только в одобренных строках» | §1.4: конец шагов 2–5, начало `/ba-sync`, `/ba-status` | Задание на итерацию 3; до sync трассу проверяет скрипт (`quotes-before.json`) |
| I3-7 | Перед sync дерево git чистое (иначе коммит); снимок + CHG предлагается закоммитить до переделки (`sync: CHG-xxx snapshot …`), переделку — отдельно | — | Переделка видна как отдельный diff; проверка «ничего лишнего» по `git diff` |
| I3-8 | Watch: `yq` раннера читает yaml; база REST — шлюз `api.atlassian.com/ex/confluence/<cloud_id>` (scoped-токен) или сайт (классический, `CONFLUENCE_API=site`); скрытая метка состояния в issue — комментарий только при новом состоянии; ошибки — одно issue `ba-watch-error`, job не падает; `watch.enabled: false` → ничего не проверяется. `/ba-new` кладёт файлы выключенными; в существующий проект — `/ba-sync setup-watch` | §6 | Ежедневные дубли комментариев; scoped-токены не работают с URL сайта; включение — решение BA (§7.2) |
| I3-9 | Порядок тяжести классов для блока: C4 > C5 > C2 > C3 > C6 > C1 > C0; `hint: C1?` от скрипта — только кандидат (C1 лишь если не поменялись числа, даты, имена, роли, слова объёма «no / only / must / not») | §5.3: «C0 и C1 различает скрипт» | Скрипт не понимает смысл; перефраз с «no» → «a» — разворот (B4), а не редактура |
| I3-10 | `/ba-continue` на `stale`-шаге не перезапускает шаг целиком, а отправляет в `/ba-sync` (открытый CHG и его незакрытые строки) | §1.2 | Полный перезапуск переписал бы незатронутое |
