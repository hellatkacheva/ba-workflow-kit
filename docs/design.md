# BA Workflow Kit — design

| | |
|---|---|
| **Status** | Draft |
| **Version** | v1.1 · 2026-10-20 (v1 + ответы BA на Q1–Q7, профили деплоя, правило архитектора, страница теста C) |
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
| `.claude-plugin/plugin.json` | Манифест: имя `ba-workflow-kit`, версия, описание |
| `commands/ba-new.md` · `ba-status.md` · `ba-continue.md` · `ba-sync.md` | 4 команды для пользователя |
| `skills/<step>/SKILL.md` | 9 skills по шагам + `change-impact` + `ba-rules` |
| `skills/<step>/templates/*.md` | Шаблоны артефактов (requirements, analysis-log, story, spec-файлы, CHG) |
| `agents/*.md` | 3 субагента |
| `templates/project/` | Заготовки для `/ba-new`: `CLAUDE.md`, `ba-project.yaml`, `docs/**/README.md`, `.github/workflows/confluence-watch.yml`, `scripts/confluence-watch.mjs` |
| `hooks/hooks.json` | v1: пусто. Кандидат на v2 — PreToolUse-guard для запрещённых действий (§7.3) |

MCP-сервер **не** входит в плагин: он настраивается в `.mcp.json` проекта, а его имя хранится в `ba-project.yaml` (`atlassian.mcp_server`). Skills вызывают инструменты `mcp__<mcp_server>__*`.

### 1.2 Commands

| Команда | Аргументы | Что делает | Пишет | Останавливается |
|---|---|---|---|---|
| `/ba-new` | `<confluence-url>` `[--jira KEY]` | Проверяет MCP и авторизацию, по URL находит cloudId и page id, создаёт `ba-project.yaml` и скелет `docs/`. Читает типы задач и статусы Jira-проекта по ID. Запускает шаг 1 (ingest). | `ba-project.yaml`, `CLAUDE.md`, `docs/00-source/**`, `.github/workflows/confluence-watch.yml` | Подтверждение BA: проект/пространство/страница/Jira key/стек — перед записью yaml |
| `/ba-status` | — | Только чтение: таблица шагов (статус, утверждение, дата), версия источника — локальная и в Confluence, открытые CON/GAP, stale-артефакты, открытые CHG. | ничего | — |
| `/ba-continue` | `[step]` | Берёт первый шаг, у которого `status ≠ approved/reviewed` и предыдущий шаг ≥ `reviewed`, и запускает его skill. Идёт **до ближайшей HITL-точки** (решение BA, Q7): шаги без HITL выполняются подряд, на HITL — стоп (для build — после каждой истории). | через skill шага | На каждой HITL-точке (§7). Не переходит к следующему шагу, пока BA не перевёл текущий в `reviewed` |
| `/ba-sync` | `[--version N]` | Подтягивает текущую версию страницы, сравнивает со снимком, запускает skill `change-impact`, показывает CHG-отчёт; после OK переделывает только затронутое. | `docs/00-source/confluence/**`, `docs/07-changes/CHG-xxx.md`, затронутые артефакты | После отчёта CHG (OK на план переделки); далее — HITL-точки каждого перезапускаемого шага |

### 1.3 Skills

Все skills сначала загружают `ba-rules` (бывшие golden rules и decision rules из DeskShare `CLAUDE.md`).

| Skill | Шаг | Источник в DeskShare | Вход | Выход | HITL |
|---|---|---|---|---|---|
| `ba-rules` | — | `CLAUDE.md` §Golden rules, §Decision rules, §Language | `ba-project.yaml` | — (правила) | — |
| `ingest` | 1 | `/ingest` | URL / page id из yaml; `docs/00-source/inbox/` (ручные файлы) | `docs/00-source/confluence/<page>/v<N>/…`, `docs/00-source/NN-*.md`, README | Нет (BA только смотрит отчёт) |
| `extract-requirements` | 2 | `/extract-requirements` | `docs/00-source/*.md` | `docs/01-requirements/requirements.md` | BA review → `reviewed` |
| `analyze-conflicts` | 3 | `/analyze-conflicts` | requirements (≥ reviewed), sources | `docs/02-analysis/analysis-log.md`, + REQ `Proposed` | **BA решает каждый CON и GAP** |
| `write-stories` | 4 | `/write-stories` | requirements, analysis-log (0 `Open` CON) | `docs/03-backlog/backlog.md`, `stories/US-xxx.md` | BA review |
| `review-backlog` | 5 | `/review-backlog` | backlog | `docs/03-backlog/review.md`, правки историй | **BA принимает/отклоняет замечания** |
| `spec` | 6 | `/spec` | backlog (≥ reviewed), requirements, analysis-log, `stack` из yaml | `docs/04-spec/*.md` | BA + tech review; вопросы → стоп; **правило архитектора (§3.2) → CON и стоп** |
| `build` | 7 | `/build` | spec (≥ reviewed), история | `app/`, `build-status.md`, `test-plan.md` | BA проверяет каждую историю |
| `deploy` | 8 | `/deploy` | `app/`, `stack.deploy.profile` (§3.1) | URL, smoke-тест, `build-status.md` | **Явное OK на публичную выкладку**; секреты вводит только BA |
| `jira-sync` | 9 | `/jira-sync` | backlog (≥ reviewed), analysis-log §open questions, build-status, `jira` из yaml | Jira-задачи, `docs/05-jira/jira-map.md` | **OK на план перед любой записью** |
| `change-impact` | sync | новое | старый и новый снимок, trace-index, все артефакты | `docs/07-changes/CHG-xxx.md`, затем scoped-перезапуск шагов | **OK на план переделки** |

### 1.4 Agents

| Агент | Роль | Инструменты | Вход | Выход | Кто вызывает |
|---|---|---|---|---|---|
| `backlog-reviewer` | Скептичный QA lead / senior BA, который не писал этот бэклог (как в DeskShare) | Read, Grep, Glob, Write (только `review.md`) | `CLAUDE.md`, `docs/00-source/`, requirements, analysis-log, backlog | `docs/03-backlog/review.md`: таблица # · severity · файл · finding · evidence · fix + вердикт | `review-backlog` |
| `impact-analyst` | Независимый аналитик изменений: классифицирует diff и прослеживает влияние, ничего не правит | Read, Grep, Glob, Write (только `docs/07-changes/`) | diff снимков (`changes.json`), `trace-index.json`, артефакты шагов 2–9 | Черновик `CHG-xxx.md` (§5.4) | `change-impact` |
| `trace-auditor` | Проверяет трассировку: каждая цитата есть в текущем снимке, у каждого REQ есть источник, у каждой истории — REQ/DEC, у каждого AC — тест | Read, Grep, Glob, Write (только `docs/.ba/trace-index.json`, `trace-audit.md`) | `docs/00-source/`, docs 01–05 | `trace-index.json` (§5.2), список нарушений | конец шагов 2–5, начало `/ba-sync`, `/ba-status` |

Субагенту выдаём только Read, Grep, Glob и Write в свою папку. MCP и Bash у них нет: всё, что идёт в Confluence/Jira или Git, делает основной поток, который видит BA.

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
| `jira.priority_on_create` | bool | проверяется | `/ba-new` | Priority через edit |
| `jira.priority_map` | map | `{Must: High, Should: Medium, Could: Low}` | BA | |
| `jira.labels.project` | str | `deskshare-kit-test` | BA | Лейбл на всех задачах, область поиска |
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
| `static` **(default)** | Статический сайт (HTML/CSS/JS) | **Нет** — у каждого браузера свои данные | `localStorage` в браузере | GitHub Pages из `repo` (public); Action `pages` из ветки/папки | Нет | Кликабельный PoC «показать идею», один демонстратор |
| `local` | Приложение запускается на машине BA / разработчика | **Нет** между машинами (общие только на одном компьютере) | Локальный файл / SQLite | Нет публичного URL; `npm run dev` + инструкция в README | Нет | Демо с одного ноутбука, проверка логики |
| `cloudflare` | Worker + D1 (+ static assets), как в DeskShare | **Да** | D1 | `wrangler deploy` в prod-env; БД и миграции | Да — вводит только BA (`wrangler login`, `wrangler secret put`) | Нужны общие данные и публичный URL |
| `none` | Только документы и Jira, без кода | — | — | Шаги 7–8 пропускаются, статус `skipped` | Нет | Чистый BA-анализ |

Общие правила: профиль задаёт `stack.constraints[]` для `spec`. Смена профиля — это решение BA (`DEC-xxx`), после него spec и build получают статус `stale`.

### 3.2 Правило архитектора: общие данные против профиля

| | |
|---|---|
| **Когда срабатывает** | Skill `spec` перед записью spec, а также `change-impact` при C2/C3/C4. Проверка: `stack.deploy.profile ∈ {static, local}` **и** есть хотя бы один REQ/NFR/DEC, который требует общего состояния между устройствами или пользователями |
| **Признаки «нужны общие данные»** | Лимит или ёмкость на всех (capacity, «не больше N»); общая бронь или выдача одного ресурса («кто взял», «свободно ли»); общий склад или журнал; роль, подтверждающая действие другого пользователя («только Ken отмечает возврат»); история или аудит за период; видимость чужих действий в реальном времени |
| **Что делает Claude** | 1) Создаёт `CON-xxx` в `analysis-log.md`: позиция A — требование (цитата, источник), позиция B — профиль деплоя (`ba-project.yaml`, DEC выбора профиля, ограничения стейкхолдеров вроде «no servers»). 2) Даёт 2–3 опции с плюсами и минусами (см. ниже) и `Claude's recommendation`. 3) **Останавливается**: spec не пишется, пока BA не выберет исход по decision rules (a/b/c). |
| **Типовые опции** | (1) Сменить профиль на `cloudflare` (или другой с общим хранилищем) — DEC + `stale` для spec/build; (2) Оставить `static`/`local` и явно сузить требование для PoC: «демо на одном устройстве, общие данные имитируются seed-данными», с баннером в UI и `ASM` — `ASSUMPTION — not validated`; (3) Deferred — sponsor decision: требование не строится, вопрос уходит спонсору |
| **Запрещено** | Молча выбрать профиль, молча урезать требование, или сделать «общие данные» через сторонний сервис (Firebase, Sheets API и т. п.) без DEC |
| **Фиксация** | `DEC-xxx` с `Outcome`, `Decided by`, дата; при смене профиля — правка `stack.deploy.profile` только после OK BA и строка в `approvals` |
| **Ожидаем в тестах** | A — да (общий лимит этажа, бронь стола между сотрудниками); C — да (кто взял какой предмет, только Ken отмечает возврат, история для аудита, «Ken: no servers») — см. §8 |

---

## 4. Ingest из Confluence через Atlassian MCP

### 4.1 Вызовы

| Что | MCP-инструмент (`mcp__<mcp_server>__…`) | Параметры | Что сохраняем |
|---|---|---|---|
| Сайт и cloudId | `getAccessibleAtlassianResources` | — | `atlassian.cloud_id`; проверяем scopes `read:page:confluence`, `read:jira-work` |
| Страница | `getConfluencePage` | `pageId`, `contentFormat: html` | `page.html` (round-trip-формат, нужен для точного diff) |
| Страница (для анализа) | `getConfluencePage` | `contentFormat: markdown` | `page.md` |
| Метаданные | ответ `getConfluencePage` | — | `version.number`, `version.createdAt`, `version.message`, `title`, `spaceId`, `parentId` → `meta.json` |
| Дочерние страницы | `getConfluencePageDescendants` | `pageId` | для каждой: `getConfluencePage` → `children/<id>/page.{html,md}` |
| Вложения | **в списке инструментов MCP нет** (на 2026-10-20 у `atlassian-olga` 32 инструмента, ни одного для вложений) | — | см. §4.3 |

### 4.2 Снимок

| Путь в проекте | Содержимое | Меняется? |
|---|---|---|
| `docs/00-source/confluence/<pageId>/v<N>/page.html` | Тело страницы как есть | Никогда (append-only) |
| `docs/00-source/confluence/<pageId>/v<N>/page.md` | Markdown из MCP | Никогда |
| `docs/00-source/confluence/<pageId>/v<N>/meta.json` | id, title, version, createdAt, version message, автор, список детей и вложений с версиями, sha256 тела | Никогда |
| `docs/00-source/confluence/<pageId>/v<N>/children/<id>/…` | То же для детей | Никогда |
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
| 1 | Прочитать `meta` текущей версии (+ дети, вложения) | основной поток, MCP | Если версия = `source.version` и списки равны → «изменений нет», стоп |
| 2 | Сохранить снимок `v<new>` | основной поток | §4.2 |
| 3 | Блочный diff `v<old>` ↔ `v<new>` по нормализованному HTML: блок = заголовок / абзац / пункт списка / строка таблицы; ключ блока = путь заголовков + порядковый номер | скрипт в skill (детерминированно) | `docs/07-changes/CHG-xxx/changes.json`: `{block_path, old_text, new_text, op: added/removed/modified/moved}` |
| 4 | Обновить и проверить трассировку | `trace-auditor` | `trace-index.json` на `v<old>` |
| 5 | Классифицировать изменения и пройти цепочку | `impact-analyst` | черновик `CHG-xxx.md` |
| 6 | Показать отчёт BA (RU, таблицы), спросить OK по каждой строке плана | основной поток | `Approved by` в CHG |
| 7 | Пометить затронутые шаги `stale`, перезапустить только затронутые элементы (scoped mode) | skills шагов | Новые / `Superseded by …` элементы |
| 8 | `source.version = new`, коммит `sync: CHG-xxx v<old>→v<new>` | основной поток | — |

### 5.2 Цепочка трассировки

| Звено | Где записано сейчас (DeskShare) | Ключ связи | Что добавляет кит |
|---|---|---|---|
| Блок источника → REQ/NFR/CST/OOS | requirements.md: `[W2 · Capacity limits]` + verbatim-цитата | ключ источника + раздел + цитата | Цитата ищется в блоках снимка → `block_path`; в trace-index хранится `{item, source_key, block_path, quote, version}` |
| Блок источника → DEC/CON/GAP/ASM | analysis-log: цитаты и ссылки на REQ | цитата + `Traces/links` | То же |
| REQ/DEC → US | story: `Traces to: REQ-…, DEC-…` | ID | Парсер строки `Traces to` |
| US → AC → тест | `test-plan.md`: scenario → test file | ID сценария `US-xxx-Snn` | Парсер таблицы test-plan |
| US/EP/Q → Jira | `jira-map.md`: Backlog ID → Jira key | ID | Парсер jira-map |
| US → build | `build-status.md`: story → status → commit | ID | Парсер build-status |

`trace-index.json` — производный файл: `trace-auditor` пересобирает его из артефактов, вручную он не правится. Если цитата не находится ни в одном блоке снимка, это нарушение трассировки: оно блокирует `/ba-sync` до исправления.

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
| 6. Log | Что сделано после OK, коммиты |

### 5.5 Правила переделки

| Правило | |
|---|---|
| Только после OK | До OK пишутся только снимок и CHG. Ни один артефакт шагов 2–9 не меняется |
| Только затронутое | Skill шага получает список ID (`scope: [REQ-012, US-006]`) и не трогает остальное |
| Без перезаписи | Изменённый элемент → новый ID + `Superseded by …` (golden rule 6), а не правка на месте. Исключение: C1 (обновление цитаты + строка `Revised`) |
| Статусы | Затронутые шаги → `stale`, затем `draft`; BA снова ставит `reviewed` |
| Jira | Только update найденных задач и create новых. `Superseded`-истории получают лейбл `superseded` и комментарий, а не удаление |
| Build/deploy | Тесты перегенерируются по изменённым AC; код — через `/ba-continue build US-xxx`. Деплой — по общему правилу §7 |

---

## 6. Ежедневная проверка — GitHub Action без ИИ

| Элемент | Значение |
|---|---|
| Файл | `.github/workflows/confluence-watch.yml` (ставит `/ba-new`) + `scripts/confluence-watch.mjs` (Node, без зависимостей) |
| Триггеры | `schedule: cron "0 5 * * 1-5"` (ежедневно в рабочие дни, 05:00 UTC) + `workflow_dispatch` |
| Читает | `ba-project.yaml`: `atlassian.site`, `source.page_id`, `source.version`, `children[]`, `attachments[]`, `watch.issue_label` |
| Запросы (Confluence REST v2, Basic auth email + token) | `GET /wiki/api/v2/pages/{id}` → `version.number`; `GET /wiki/api/v2/pages/{id}/descendants` (если `include_children`); `GET /wiki/api/v2/pages/{id}/attachments` (если `include_attachments`) |
| Сравнение | Версия страницы, набор детей с версиями, набор вложений с версиями — с yaml |
| Если есть изменения | Если нет открытого issue с лейблом `ba-sync` → создать issue «Confluence page 65670 changed: v2 → v3 — run /ba-sync» (тело: таблица изменений, ссылка на страницу, version message). Если открытый есть → комментарий с новой версией |
| Если изменений нет | Ничего (лог в job summary) |
| Секреты (GitHub Secrets) | `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN` — scoped API token только с `read:page:confluence` (+ `read:attachment:confluence`). Заводит BA сам (`gh secret set`), Claude значения не видит |
| Права job | `permissions: { contents: read, issues: write }`; используется `GITHUB_TOKEN` |
| Без ИИ | Никаких вызовов LLM и MCP. Action не пишет в репозиторий и в Confluence |
| Ошибки | 401/403 → issue «watch: auth failed» (одно на всё время, дедупликация по лейблу `ba-watch-error`); 404 → «page not found» |

---

## 7. Human-in-the-loop

### 7.1 HITL-точки

| # | Где | Что решает BA | Как фиксируется |
|---|---|---|---|
| H0 | `/ba-new` | Страница, Jira-проект, стек, включить ли watch | `ba-project.yaml` + `approvals` |
| H1 | после шага 2 | Requirements → `reviewed` | `approvals`, header артефакта |
| H2 | шаг 3, Part B | Каждый CON: опция + исход (a/b/c); каждый GAP | `DEC-xxx` с `Decided by`, датой |
| H3 | после шага 4 | Backlog → `reviewed`; ответы на OQ | `approvals` |
| H4 | шаг 5 | Какие замечания критика принять | `review.md`: `Rejected by BA — …` |
| H5 | шаг 6 | Вопросы по spec, tech review | DEC, `approvals` |
| H5a | шаг 6 / `/ba-sync` | **Правило архитектора** (§3.2): общие данные против профиля `static`/`local` — сменить профиль, сузить требование или отложить | `CON-xxx` → `DEC-xxx`; `stack.deploy.profile` |
| H6 | шаг 7 | Каждая история после build; любая неоднозначность → стоп | `build-status.md` |
| H7 | шаг 8 | **Публичная выкладка** (GitHub Pages для `static`, prod-env для `cloudflare`) — отдельное «OK, выкладываем» в этом же разговоре; ввод секретов | `run-log`, `approvals` |
| H8 | шаг 9 | План Jira (таблица) до любой записи | `jira-map.md`, `approvals` |
| H9 | `/ba-sync` | Классы изменений и план переделки построчно | CHG `Approved by` |
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
| Права | `settings.json` шаблона: `deny` для `mcp__*__deleteJira*` (если появится), `mcp__<mcp_server>__updateConfluencePage` / `createConfluencePage` (кит в Confluence не пишет вообще — правила прав не фильтруют по space), `wrangler deploy --env production` → `ask` | — |
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
| **Шаги** | `/ba-new <url> --jira KAN` → `/ba-continue` до шага 9; в конце — реальная выкладка на GitHub Pages (H7) | после A: правки по таблице ниже → Action или `/ba-sync` | `/ba-new <url> --jira KAN` → шаги 1–6 (+ 9 по желанию) |
| **Ожидаемо** | Ключи источников `HO/CTX/W1–W3` выведены сами; CON по C1/C3 из W3 найдены; **CON правила архитектора (§3.2)** на шаге 6: общий лимит этажа и бронь стола между сотрудниками против `static` → стоп, решение BA; число REQ/CON/US сопоставимо с DeskShare (±30 %); 0 строк без цитаты; Jira: эпики + истории + вопросы, повторный `jira-sync` создаёт 0 дублей; рабочий URL на GitHub Pages | См. таблицу B | Ни одного упоминания DeskShare/BAWT3/Cloudflare вне yaml; ключи источников `HO/CTX/W1/W2` из заголовков; CON шага 3: 14 дней vs «месяцами» (Ken/Marta), бронь vs FCFS, история ≥ 1 год vs минимум данных (Lena/Priyanka), email-напоминания vs «no email»; GAP: число предметов, выходные, дата демо, повреждённые предметы; **CON правила архитектора**: «кто взял что», возврат отмечает только Ken, журнал для аудита против `static` + «Ken: no servers» → стоп, решение BA |
| **Известное отличие** | В DeskShare был ещё `01-workshop-brief.md` из PDF (ключ `BR`) — в Confluence его нет. Решение BA (Q4): проверяем только Confluence; отличие фиксируем в отчёте теста (ожидаем меньше NFR/CST по срокам и формату workshop) | — | — |
| **Метрики** | Время на шаг, число правок BA (`run-log`), совпадение с DeskShare по ключевым DEC | Precision/recall классов по таблице B, число лишне затронутых элементов = 0 | То же, что A |

### 8.1 Сценарии B

| # | Правка в Confluence | Ожидаемый класс | Ожидаемое влияние |
|---|---|---|---|
| B0 | (уже есть) v1 → v2: Source/Scope/Read-only и Date/Attendees на отдельных строках | C0 | Только снимок; 0 артефактов |
| B1 | Опечатка / перефраз в «Current state» | C1 | Обновлены цитаты в REQ, ссылающихся на `CTX · Current state`; больше ничего |
| B2 | W2: Floor 1 capacity 30 → 35 | C2 | REQ про ёмкость → новая версия; истории с этой ёмкостью, AC, config, тесты, Jira-описание |
| B3 | W2 Decisions: новый пункт «Bookings can be made at most 14 days ahead» | C3 | Новый REQ; новая или изменённая история; Jira create |
| B4 | W2: «Agreed: a waitlist is in scope for this PoC» | C4 | Новый CON против OOS / DEC «no waitlist» → HITL |
| B5 | Удалить пункт «No mobile app …» | C5 | OOS → `Superseded by CHG`; BA решает про NFR mobile |
| B6 | Добавить дочернюю страницу «Workshop 4 minutes» | C6 → C3 | Ingest ребёнка, новый ключ источника `W4` |
| B7 | Action: подряд v3 → v4 без `/ba-sync` | — | Одно issue `ba-sync` + комментарий, не два issue |

Каждый B-сценарий — отдельная версия страницы и отдельный CHG. Порядок B0 → B7; перед B2 и далее — коммит-точка, чтобы откатить тестовый репо.

---

## 9. Решения по вопросам v1 (BA, 2026-10-20)

| # | Вопрос | Решение | Где отражено |
|---|---|---|---|
| Q1 | Вложения | **A** — список через REST, файлы BA кладёт в `inbox/` | §4.3 |
| Q2 | Страница для теста C | Вымышленный кейс GearLoan: `tests/fixtures/test-c-gearloan-handoff.md` → Confluence page `294916` (DSSRC) | §8 |
| Q3 | Тестовый репозиторий | Да, **public** (GitHub Pages на бесплатном аккаунте — только public) | §3 `repo.*`, §8 |
| Q4 | PDF brief в тесте A | Только Confluence, разницу фиксируем | §8 A |
| Q5 | Деплой | `stack.deploy.profile` по умолчанию `static` (GitHub Pages, без общих данных); в тесте A — реальная выкладка на GitHub Pages в конце | §3.1, §8 |
| Q6 | Язык | Skills — EN, отчёты в чате — RU, этот документ — RU | §2.1 |
| Q7 | `/ba-continue` | До ближайшей HITL-точки | §1.2 |

## 10. Открытые вопросы v1.1

| # | Вопрос | Влияет на | Рекомендация |
|---|---|---|---|
| Q8 | Профиль `local`: какое хранилище по умолчанию — `localStorage` в браузере (как `static`, но без выкладки) или локальный Node + SQLite? | §3.1 | `localStorage` — меньше зависимостей |
| Q9 | Ожидаемый исход CON правила архитектора в тесте A: что выберет BA? От этого зависит, проверяется ли в A ещё и профиль `cloudflare` | §8 A | Опция (2): `static` + «демо на одном устройстве», чтобы A закончился на GitHub Pages, как решено в Q5 |
