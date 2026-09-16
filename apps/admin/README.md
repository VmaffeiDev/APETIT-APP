# APETIT Admin

Painel operacional da Apetit em React + TypeScript + Vite.

## Entrega atual

O módulo de Cardápios já consome a API real do backend e permite:

- informar unidade e tipo de refeição;
- enviar `.xlsx` ou `.csv` por clique ou drag-and-drop;
- visualizar quantidade de dias e itens reconhecidos;
- conferir alertas de ficha técnica ausente ou duplicidade;
- revisar o cardápio agrupado por dia;
- confirmar mês e ano explicitamente;
- publicar o cardápio no PostgreSQL;
- reenviar uma semana corrigida, substituindo o período existente;
- visualizar confirmação final da publicação.

O painel não expõe prescrição ou histórico alimentar individual do funcionário.

## Rodar localmente

Backend, a partir de `backend/`:

```bash
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Painel, a partir de `apps/admin/`:

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`.

A URL padrão da API é `http://localhost:8000` e pode ser alterada com `VITE_API_URL`.

## Próximos módulos do painel

- histórico de importações;
- unidades e refeitórios;
- feedback agregado;
- tendências de satisfação;
- relatórios operacionais.
