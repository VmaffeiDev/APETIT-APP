# APETIT staging no Railway

## Serviços

Crie um projeto `apetit-staging` com três serviços:

1. `Postgres` — banco gerenciado do Railway.
2. `api` — fonte GitHub `VmaffeiDev/APETIT-APP`, branch `foundation/v1`, Root Directory `backend`.
3. `admin` — mesma fonte/branch, Root Directory `apps/admin`.

Os arquivos `backend/railway.json` e `apps/admin/railway.json` definem build, start e healthcheck.

## Variáveis do serviço api

Use o Raw Editor/Variables do Railway. Não versione valores reais no Git.

```env
APETIT_ENVIRONMENT=staging
APETIT_DATABASE_URL=${{Postgres.DATABASE_URL}}
APETIT_API_SECRET=<segredo-forte>
APETIT_CORS_ORIGINS=https://${{admin.RAILWAY_PUBLIC_DOMAIN}}

APETIT_EMAIL_PROVIDER=smtp
APETIT_EMAIL_FROM=Apetit <acesso@seudominio.com.br>
APETIT_SMTP_HOST=<host>
APETIT_SMTP_PORT=587
APETIT_SMTP_USERNAME=<usuario>
APETIT_SMTP_PASSWORD=<senha>
APETIT_SMTP_STARTTLS=true
APETIT_SMTP_USE_SSL=false

APETIT_OCR_PROVIDER=google_vision
APETIT_GOOGLE_VISION_API_KEY=<credencial>
APETIT_OCR_TIMEOUT_SECONDS=20
APETIT_OCR_PDF_MAX_PAGES=5
```

`APETIT_DATABASE_URL` aceita o `DATABASE_URL` nativo do Railway; o backend normaliza `postgres://`/`postgresql://` para o driver psycopg.

## Variáveis do serviço admin

```env
VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

Como variáveis `VITE_` entram no bundle no build, qualquer alteração exige novo deploy do Admin.

## Domínios

Gere um domínio público para `api` e `admin` em Settings → Networking. O Postgres deve permanecer privado para o staging.

## Migrations

O serviço `api` executa automaticamente antes do deploy:

```bash
alembic upgrade head
```

Se a migration falhar, a nova versão da API não deve ficar ativa.

## Verificação

Após os serviços estarem no ar:

```text
GET https://<api>/api/health
GET https://<api>/api/readiness
```

Esperado para `/api/readiness`:

```json
{"status":"ready","environment":"staging"}
```

Depois execute o smoke test funcional descrito em `docs/staging.md`.

## Segurança

- Não habilitar acesso público ao Postgres sem necessidade explícita.
- Selar credenciais SMTP, Google Vision e `APETIT_API_SECRET` no Railway quando possível.
- Não usar `change-me` fora de development.
- Não usar `email_provider=console` em staging/produção.
