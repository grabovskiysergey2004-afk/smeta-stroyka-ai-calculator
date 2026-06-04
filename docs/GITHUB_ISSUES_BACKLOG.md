# GitHub Issues Backlog

Этот файл дублирует стартовый набор Issues, которые нужно создать в GitHub после публикации приватного репозитория.

Для автоматического создания:

```powershell
gh auth login
.\scripts\github-bootstrap.ps1
```

## Done

1. **DONE: Подготовить папку проекта и стартовую структуру**
   - Распаковка проекта.
   - Переименование/подготовка `smeta-stroyka-ai-calculator`.
   - `package.json`, Vite, `.gitignore`.
   - Первый коммит.

2. **DONE: Восстановить интерфейс после белого экрана**
   - Исправлен запуск через локальный сервер.
   - Добавлен fallback-редирект с `file://` на `http://127.0.0.1:5173/`.
   - Добавлен `vite.config.js` для legacy `.jsx`.
   - Исправлены конфликты глобальных объявлений.

3. **DONE: Зафиксировать продуктовую документацию PRD/Stack/Research/Plan**
   - `PRD.md`.
   - `TECH_STACK.md`.
   - `SOURCE_ANALYSIS.md`.
   - `PRE_DEVELOPMENT_RESEARCH.md`.
   - `DEVELOPMENT_PLAN.md`.
   - `AGENTS.md`.

## Planned

4. **PLAN: Мигрировать legacy-прототип на полноценный React/Vite стек**

5. **PLAN: Спроектировать локальную базу данных и папку клиента**

6. **PLAN: Реализовать модуль прайс-листов и поставщиков**

7. **PLAN: Реализовать PDF/import pipeline для чертежей ИЖС**

8. **PLAN: Развить CAD-light холст под ИЖС**

9. **PLAN: Добавить расчёт ИЖС материалов и работ**

10. **PLAN: Подготовить Windows/Mac запуск, backup и клиентскую поставку**
