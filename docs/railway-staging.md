# APETIT staging no Railway

## Serviços

Crie um projeto `apetit-staging` com três serviços ativos:

1. `Postgres` — banco gerenciado do Railway.
2. `api-staging-v2` — fonte GitHub `VmaffeiDev/APETIT-APP`, branch `foundation/v1`, Root Directory `backend`.
3. `admin` — fonte GitHub `VmaffeiDev/APETIT-APP`, branch `staging`, Root Directory `apps/admin`.

Os serviços antigos `api` e `api-staging` podem ser ignorados enquanto o staging usa `api-staging-v2`.

## Configuração verificada do serviço api-staging-v2

No ambiente Railway atual, os binários `alembic` e `uvicorn` não ficam disponíveis diretamente no PATH durante pre-deploy/runtime. Use os módulos via Python.

Build Command:

```bash
pip install -e .
```

Pre-deploy Command:

```bash
python -m pip install -e . && python -m alembic upgrade head
```

Start Command:

```bash
python -m pip install -e . && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Healthcheck:

```text
/api/health
```

Timeout recomendado: `120s`.

A instalação repetida no Start é intencional neste estágio porque garante que o runtime enxergue as dependências Python no stack atual do Railway. Depois de estabilizar a imagem/runtime, pode ser testado `python -m uvicorn ...` sem reinstalação.

## Variáveis do serviço api-staging-v2

Use o Raw Editor/Variables do Railway. Não versione valores reais no Git.

Configuração mínima enquanto SMTP e OCR reais ainda não foram provisionados:

```env
APETIT_ENVIRONMENT=staging
APETIT_DATABASE_URL=postgresql+psycopg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
APETIT_API_SECRET=<segredo-forte>
APETIT_CORS_ORIGINS=https://admin-production-02d0.up.railway.app
APETIT_EMAIL_PROVIDER=console
APETIT_OCR_PROVIDER=disabled
```

Para ativar integrações reais posteriormente:

```env
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

## Variáveis do serviço admin

```env
VITE_API_URL=https://api-staging-v2-production.up.railway.app
```

Como variáveis `VITE_` entram no bundle no build, qualquer alteração exige novo deploy do Admin.

## Domínios

API staging:

```text
https://api-staging-v2-production.up.railway.app
```

Admin staging:

```text
https://admin-production-02d0.up.railway.app
```

O Postgres deve permanecer privado para o staging.

## Verificação

Após os serviços estarem no ar:

```text
GET https://api-staging-v2-production.up.railway.app/api/health
GET https://api-staging-v2-production.up.railway.app/api/readiness
```

Enquanto SMTP e Google Vision estiverem desabilitados, `/api/readiness` pode responder `503`; isso é esperado. Depois de configurar as integrações reais, o esperado é:

```json
{"status":"ready","environment":"staging"}
```

Depois execute o smoke test funcional descrito em `docs/staging.md`.

## Deploy automático GitHub → Railway

O serviço deve acompanhar a branch `foundation/v1`. Se a tela Source mostrar `Could not load branches` ou um novo commit não disparar deployment automaticamente, reconecte a integração GitHub do Railway e selecione novamente o repositório e a branch.

## Segurança

- Não habilitar acesso público ao Postgres sem necessidade explícita.
- Manter credenciais SMTP, Google Vision e `APETIT_API_SECRET` somente no Railway.
- Não usar `change-me` fora de development.
- `console` e `disabled` servem apenas para manter o staging funcional enquanto as integrações reais ainda não têm credenciais; antes de testes de aceite completos, trocar para SMTP e Google Vision reais.
