# R1 — входные параметры

Вердикт: `implemented`.

Обязательные `city`, `date`, `format`, `category`, `budget` и опциональные `hours`, `language` присутствуют в типе, серверной Zod-схеме и форме: `lib/types.ts:7-10`, `lib/catalog.ts:44-53`, `app/finder.tsx:52-62`. API отклоняет неверный ввод: `app/api/recommendations/route.ts:5-13`; это покрыто `tests/core.test.ts:44-49` и `tests/browser/finder.spec.ts:41-46`.
