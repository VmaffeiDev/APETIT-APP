# APETIT — Staging

Este ambiente existe para validar integrações reais sem usar dados de produção.

Para a implantação no Railway, use também `docs/railway-staging.md`.

## Variáveis obrigatórias

Use `.env.staging.example` como referência e configure os valores reais no provedor de hospedagem, nunca no Git.

Obrigatórias para staging:

- `APETIT_ENVIRONMENT=staging`
- `APETIT_DATABASE_URL`
- `APETIT_API_SECRET` diferente de `change-me`
- `APETIT_CORS_ORIGINS` com o domínio real do Admin staging
- `APETIT_EMAIL_PROVIDER=smtp`
- `APETIT_EMAIL_FROM`
- `APETIT_SMTP_HOST`
- `APETIT_SMTP_USERNAME`
- `APETIT_SMTP_PASSWORD`
- `APETIT_OCR_PROVIDER=google_vision`
- `APETIT_GOOGLE_VISION_API_KEY`

## Ordem de subida

1. Criar um PostgreSQL vazio exclusivo do staging.
2. Aplicar `alembic upgrade head` no diretório `backend`.
3. Subir a API com as variáveis de staging.
4. Verificar `GET /api/health`.
5. Verificar `GET /api/readiness` e exigir HTTP 200 com `status=ready`.
6. Publicar o Admin apontando `VITE_API_URL` para a API staging.
7. Configurar o mobile de teste para a mesma API.

## Smoke test obrigatório

- solicitar código para um e-mail de teste e confirmar recebimento real;
- autenticar e restaurar sessão;
- enviar PDF textual para preview de prescrição;
- enviar imagem/HEIC ou PDF escaneado e confirmar OCR;
- revisar a prescrição sem ativação automática;
- importar uma ficha técnica de teste;
- publicar um cardápio de teste e conferir cobertura nutricional;
- montar e registrar um prato;
- verificar histórico, progresso e feedback.

## Dados

Staging não deve usar dados pessoais reais nem prescrições reais durante a homologação inicial. Use pessoas, empresas, cardápios e documentos sintéticos até haver definição formal de governança e acesso.

## Readiness

`GET /api/readiness` não testa conectividade externa; ele valida se a configuração mínima foi fornecida. Um retorno `503` indica que o ambiente não deve ser considerado pronto para demonstração integrada.
