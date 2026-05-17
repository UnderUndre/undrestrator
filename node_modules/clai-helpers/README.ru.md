# clai-helpers

CLI-инструмент, который использует `.claude/` как единый источник истины для конфигурации AI-инструментов и транспилирует её в форматы GitHub Copilot (`.github/`), Google Gemini (`.gemini/`) и другие.

Пишешь один раз в формате Claude. Синхронизируешь везде.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Команды](#команды)
- [Глобальные флаги](#глобальные-флаги)
- [Защищённые слоты](#защищённые-слоты)
- [Конфигурация](#конфигурация)
- [Трансформеры](#трансформеры)
- [Lock-файл](#lock-файл)
- [CI-интеграция](#ci-интеграция)
- [Программный API](#программный-api)
- [Разработка](#разработка)

## Быстрый старт

### Требования

- Node.js 20+
- npm

### Инициализация проекта

```bash
npx clai-helpers init
```

Что происходит:

1. Скачивается последний релиз из source-репозитория
2. Копируются файлы `.claude/` (команды, агенты, CLAUDE.md)
3. Генерируются `.github/prompts/`, `.github/instructions/`, `.github/copilot-instructions.md` для Copilot
4. Генерируются `.gemini/commands/`, `.gemini/agents/`, `GEMINI.md` для Gemini
5. Создаётся `helpers-lock.json` -- **этот файл нужно коммитить**

### Привязка к версии

```bash
npx clai-helpers init --version v1.0.0
```

### Только определённые таргеты

```bash
npx clai-helpers init --targets claude,copilot
```

### Обновление до последней версии

```bash
npx clai-helpers sync --upgrade
```

## Команды

### `helpers init`

Инициализация нового проекта из source-репозитория.

```bash
helpers init [опции]
```

| Флаг                     | Тип     | По умолчанию                | Описание                                       |
| ------------------------ | ------- | --------------------------- | ---------------------------------------------- |
| `--source <url>`         | string  | `github:underundre/helpers` | URL source-репозитория                         |
| `--version <tag>`        | string  | последний тег               | Привязка к версии                              |
| `--ref <ref>`            | string  | --                          | Ветка или SHA (перебивает `--version`)         |
| `--targets <list>`       | string  | `claude,copilot,gemini`     | Таргеты через запятую                          |
| `--source-config <path>` | string  | --                          | Локальный оверрайд манифеста                   |
| `--trust-custom`         | boolean | `false`                     | Автоматически доверять кастомным трансформерам |

### `helpers sync`

Обновление существующего проекта. Без `--upgrade` только чинит дрифт, не меняет версию.

```bash
helpers sync [опции]
```

| Флаг                     | Тип     | По умолчанию | Описание                                       |
| ------------------------ | ------- | ------------ | ---------------------------------------------- |
| `--upgrade`              | boolean | `false`      | Обновить до последней версии                   |
| `--version <tag>`        | string  | --           | Обновить до конкретной версии                  |
| `--ref <ref>`            | string  | --           | Ветка или SHA                                  |
| `--source-config <path>` | string  | --           | Локальный оверрайд манифеста                   |
| `--trust-custom`         | boolean | `false`      | Автоматически доверять кастомным трансформерам |

### `helpers status`

Текущее состояние всех отслеживаемых файлов.

```bash
helpers status [опции]
```

| Флаг               | Тип     | По умолчанию | Описание                                     |
| ------------------ | ------- | ------------ | -------------------------------------------- |
| `--strict`         | boolean | `false`      | Код выхода 2 при обнаружении дрифта (для CI) |
| `--targets <list>` | string  | все          | Фильтр по таргетам                           |

### `helpers diff`

Превью того, что изменится при следующем sync.

```bash
helpers diff [path...]
```

### `helpers eject`

Снять файл с отслеживания, но оставить на диске. Sync его больше не тронет.

```bash
helpers eject <path> [--cascade]
```

`--cascade` -- также снять с отслеживания все сгенерированные потомки.

### `helpers remove`

Удалить файл с диска и снять с отслеживания. **Деструктивная операция** -- требует `--yes` или `--interactive`.

```bash
helpers remove <path>
```

### `helpers add-target`

Включить новый таргет и сгенерировать его файлы.

```bash
helpers add-target <name>
```

### `helpers remove-target`

Удалить все файлы таргета и снять с отслеживания. **Деструктивная операция** -- требует `--yes` или `--interactive`.

```bash
helpers remove-target <name>
```

### `helpers list-transformers`

Список всех доступных трансформеров (встроенных и кастомных).

```bash
helpers list-transformers [--json]
```

### `helpers doctor`

Проверка целостности lock-файла и хешей файлов на диске.

```bash
helpers doctor [--fix] [--clean]
```

| Флаг      | Описание                                                       |
| --------- | -------------------------------------------------------------- |
| `--fix`   | Автоматически исправить безопасные проблемы (пересчитать хеши) |
| `--clean` | Удалить оставшиеся `.helpers_new` файлы                        |

### `helpers recover`

Восстановление после краша sync или init. Нужен ровно один из трёх флагов.

```bash
helpers recover <--resume | --rollback | --abandon>
```

| Флаг         | Описание                                                                               |
| ------------ | -------------------------------------------------------------------------------------- |
| `--resume`   | Продолжить с первой незавершённой операции                                             |
| `--rollback` | Восстановить из бэкапа, вернуться к состоянию до sync                                  |
| `--abandon`  | Удалить журнал и бэкапы, оставить файлы как есть. **Деструктивная** -- требует `--yes` |

## Глобальные флаги

Работают со всеми командами:

| Флаг                | Тип     | По умолчанию      | Описание                                          |
| ------------------- | ------- | ----------------- | ------------------------------------------------- |
| `--dry-run`         | boolean | `false`           | Показать план, ничего не писать                   |
| `--offline`         | boolean | `false`           | Без сети. Использовать кеш giget                  |
| `--non-interactive` | boolean | `true`            | Никогда не спрашивать. Безопасно для CI           |
| `--interactive`     | boolean | `false`           | Спрашивать при конфликтах                         |
| `--yes`             | boolean | `false`           | Автоматически подтверждать деструктивные операции |
| `--no-color`        | boolean | по `NO_COLOR` env | Отключить цвета                                   |
| `--json`            | boolean | `false`           | Вывод в JSON вместо текста                        |
| `--verbose`         | boolean | `false`           | Расширенное логирование                           |

## Коды выхода

| Код    | Значение                                                  |
| ------ | --------------------------------------------------------- |
| `0`    | Успех                                                     |
| `1`    | Ошибка использования (неверные флаги, неизвестный таргет) |
| `2`    | Обнаружен дрифт или конфликт                              |
| `3`    | Незавершённый журнал -- запустите `helpers recover`       |
| `4`    | Недоверенный кастомный трансформер                        |
| `5`    | Несовместимая версия схемы lock-файла                     |
| `>=10` | Внутренняя ошибка                                         |

## Защищённые слоты

Защищённые слоты позволяют вставлять проектный контент в управляемые файлы так, чтобы он сохранялся при sync.

### Синтаксис

```md
# Управляемая секция (обновляется при sync)

<!-- HELPERS:CUSTOM START -->
Ваш проектный контент.
Этот блок сохраняется при каждом sync.
<!-- HELPERS:CUSTOM END -->

# Другая управляемая секция
```

Маркеры зависят от формата файла:

| Формат          | Маркеры                                                         |
| --------------- | --------------------------------------------------------------- |
| Markdown/HTML   | `<!-- HELPERS:CUSTOM START -->` / `<!-- HELPERS:CUSTOM END -->` |
| YAML/Shell/TOML | `# HELPERS:CUSTOM START` / `# HELPERS:CUSTOM END`               |
| JS/TS/JSONC     | `// HELPERS:CUSTOM START` / `// HELPERS:CUSTOM END`             |
| JSON            | Слоты не поддерживаются                                         |

### Как это работает

1. При `sync` вычисляется **каноничный хеш** -- содержимое слотов заменяется плейсхолдером. Изменения внутри слотов не считаются дрифтом.
2. Отдельный **хеш слотов** отслеживает содержимое слотов, чтобы `status` мог показать кастомизации.
3. Маркеры должны быть на отдельных строках и попарно закрыты.

### Правила

- Каждый `START` должен иметь парный `END`
- Содержимое слотов никогда не перезаписывается при sync
- Можно иметь несколько слотов в одном файле
- Вложенные слоты не поддерживаются

## Конфигурация

Source-репозиторий предоставляет `helpers.config.ts` (или `.js`, `.mjs`, `.json`) в корне. Это манифест, определяющий что синхронизируется и как.

### Пример

```ts
import { defineHelpersConfig } from "clai-helpers";

export default defineHelpersConfig({
  version: 1,

  sources: [
    "commands/**/*.md",
    "agents/**/*.md",
    "CLAUDE.md",
    "settings.json",
  ],

  targets: {
    claude: {
      pipelines: [
        {
          transformer: "identity",
          match: "**/*",
          output: ".claude/{{relativePath}}",
        },
      ],
    },
    copilot: {
      pipelines: [
        {
          transformer: "claude-to-copilot-prompt",
          match: "commands/**/*.md",
          output: ".github/prompts/{{name}}.prompt.md",
        },
      ],
    },
    gemini: {
      pipelines: [
        {
          transformer: "claude-to-gemini-command",
          match: "commands/**/*.md",
          output: ".gemini/commands/{{name}}.toml",
        },
      ],
    },
  },
});
```

### Шаблонные переменные

| Переменная         | Раскрывается в            | Пример                           |
| ------------------ | ------------------------- | -------------------------------- |
| `{{name}}`         | Имя файла без расширения  | `commit` из `commands/commit.md` |
| `{{relativePath}}` | Полный путь от `.claude/` | `commands/commit.md`             |
| `{{ext}}`          | Расширение с точкой       | `.md`                            |

### Классы файлов

| Класс    | Поведение                                                         |
| -------- | ----------------------------------------------------------------- |
| `core`   | Записывается при init, обновляется при каждом sync. По умолчанию. |
| `config` | Записывается только при init. Sync никогда не перезаписывает.     |
| `binary` | Побайтовое копирование. Без слотов, без заголовков.               |

### Локальные оверрайды

```bash
helpers sync --source-config ./helpers.local.config.ts
```

Локальные значения имеют приоритет. Это позволяет добавлять кастомные таргеты (например, Cursor) без форка source-репозитория.

## Трансформеры

### Встроенные

| Имя                                   | Паттерн            | Выход                                           |
| ------------------------------------- | ------------------ | ----------------------------------------------- |
| `identity`                            | Любой              | Тот же путь (копия `.claude/`)                  |
| `claude-to-copilot-prompt`            | `commands/**/*.md` | `.github/prompts/{{name}}.prompt.md`            |
| `claude-to-copilot-instructions`      | `agents/**/*.md`   | `.github/instructions/{{name}}.instructions.md` |
| `claude-to-copilot-root-instructions` | `CLAUDE.md`        | `.github/copilot-instructions.md`               |
| `claude-to-gemini-command`            | `commands/**/*.md` | `.gemini/commands/{{name}}.toml`                |
| `claude-to-gemini-agent`              | `agents/**/*.md`   | `.gemini/agents/{{name}}.md`                    |
| `claude-to-gemini-root`               | `CLAUDE.md`        | `GEMINI.md`                                     |

### Кастомный трансформер

```ts
import type { TransformerFn, ParsedFile, RenderedFile } from "clai-helpers";
import { FileKind } from "clai-helpers";

const transform: TransformerFn = (source, ctx): RenderedFile | null => {
  if (source.extension !== ".md") return null;

  return {
    targetPath: `.cursor/prompts/${source.sourcePath}`,
    content: source.body,
    kind: FileKind.Generated,
    fromSource: source.sourcePath,
    transformer: "my-cursor-transformer",
  };
};

export default transform;
```

В манифесте -- путь к файлу вместо имени:

```ts
{ transformer: "./transformers/my-cursor.ts", match: "commands/**/*.md", output: ".cursor/prompts/{{name}}.md" }
```

Кастомные трансформеры подчиняются **модели доверия**: их хеш фиксируется в lock-файле. При изменении файла доверие отзывается до повторного подтверждения.

## Lock-файл

`helpers-lock.json` живёт в корне проекта. **Коммитьте его в git.**

### Что отслеживается

- **Source-метаданные**: URL репозитория, ref, точный SHA коммита
- **Активные таргеты**: какие таргеты включены
- **Доверенные трансформеры**: хеш-пин кастомных трансформеров
- **Записи файлов**: путь, тип (source/generated), класс, хеши, статус

### Типы хешей

| Хеш          | Для чего                | Назначение                                                                                                      |
| ------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Каноничный   | Source-файлы            | Хеш контента с плейсхолдерами вместо слотов. Обнаруживает upstream-изменения без ложных срабатываний от слотов. |
| Хеш слотов   | Source-файлы со слотами | Хеш содержимого слотов. Отслеживает кастомизации.                                                               |
| Rendered-хеш | Сгенерированные файлы   | Хеш полного вывода. Обнаруживает ручные правки.                                                                 |

### Обнаружение дрифта

| Тип файла       | Условие дрифта                                     |
| --------------- | -------------------------------------------------- |
| Source (core)   | Локальный каноничный хеш отличается от source-хеша |
| Source (config) | Никогда не дрифтует                                |
| Generated       | Локальный rendered-хеш отличается от ожидаемого    |
| Ejected         | Не проверяется                                     |

## CI-интеграция

```yaml
# GitHub Actions
- name: Проверка дрифта AI-конфигурации
  run: npx clai-helpers status --strict
```

Код выхода `2` -- кто-то руками отредактировал управляемый файл. Инструмент по умолчанию неинтерактивный, работает в CI без дополнительных флагов.

### Рекомендуемый воркфлоу

1. Разработчик запускает `helpers sync --upgrade` локально
2. CI запускает `helpers status --strict` для проверки
3. Если дрифт обнаружен -- разработчик перезапускает sync и коммитит результат

## Программный API

```ts
import {
  defineHelpersConfig,
  FileKind, FileClass, FileStatus, ExitCode,
} from "clai-helpers";

import type {
  HelpersConfig, TargetConfig, TransformerPipeline,
  TransformerFn, ParsedFile, RenderedFile, TransformContext,
} from "clai-helpers";
```

## Разработка

```bash
git clone https://github.com/underundre/ai.git
cd ai/packages/cli
npm install
```

| Команда                    | Описание                      |
| -------------------------- | ----------------------------- |
| `npm run build`            | Компиляция TypeScript         |
| `npm run dev`              | Компиляция в watch-режиме     |
| `npm test`                 | Все тесты (vitest)            |
| `npm run test:unit`        | Только юнит-тесты             |
| `npm run test:integration` | Только интеграционные         |
| `npm run validate`         | Проверка типов без компиляции |

### Стек

- **TypeScript 5.x** -- strict, ESM
- **citty** -- CLI-фреймворк
- **giget** -- загрузка репозиториев с кешированием
- **c12** -- загрузчик TS-конфигурации
- **consola** -- логирование
- **pathe** -- кроссплатформенные пути
- **vitest** -- тесты

## Лицензия

MIT
