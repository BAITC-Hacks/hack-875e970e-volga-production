# R6 — три исхода

Вердикт: `implemented`.

`matched`, `category_absent`, `no_match` разделены в `lib/types.ts:15-20` и формируются в `lib/recommend.ts:13-21`. Интерфейс даёт им разные заголовки, сообщения и причины: `app/finder.tsx:69-82`. Core и browser тесты покрывают все три исхода.
