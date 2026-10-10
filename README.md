# Orient Travel CRM

CRM турагентства Orient Travel (Фергана): лиды из Meta Lead Ads, сделки, задачи, финансы и отчёты.
Рабочий адрес — https://crm.orienttravel.uz

Код находится в папке [`crm/`](crm/) — там же подробное описание, запуск и настройка: [crm/README.md](crm/README.md).

- `crm/` — приложение (Next.js, TypeScript, Prisma/PostgreSQL), фоновый воркер, Docker.
- `.github/workflows/crm-ci.yml` — проверки (типы, линтер, тесты, сборка, миграции, Docker-образ).
- `.github/workflows/crm-deploy.yml` — автообновление сервера после мерджа.
