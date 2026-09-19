# Dados de demonstração

Enquanto a Apetit não fornece o relatório oficial de empresas, unidades e refeitórios, o ambiente de demonstração usa uma base fictícia e temporária.

## Empresas e unidades de demo

| Empresa | Unidade | Refeitório |
| --- | --- | --- |
| Copel | Unidade Copel — Demonstração | Refeitório Copel — Demo |
| Sanepar | Unidade Sanepar — Demonstração | Refeitório Sanepar — Demo |
| Coca-Cola | Unidade Coca-Cola — Demonstração | Refeitório Coca-Cola — Demo |

Esses registros não representam endereços, contratos ou estruturas operacionais reais das empresas. São apenas entidades de demonstração do APETIT-APP.

Os UUIDs são fixos e compartilhados entre o seed do PostgreSQL e o painel administrativo para permitir demonstrações reproduzíveis de:

- importação/publicação de cardápio;
- consulta do cardápio por unidade;
- feedback de funcionários;
- dashboard agregado de satisfação;
- futuros fluxos de prescrição e recomendação nutricional.

## Substituição futura

Quando a Apetit enviar o relatório oficial:

1. cadastrar empresas reais;
2. cadastrar cada unidade real vinculada à empresa correta;
3. cadastrar os refeitórios reais;
4. substituir a lista temporária do painel por dados carregados via API;
5. remover os seeds fictícios dos ambientes que não sejam de demonstração.

O código de negócio não deve depender dos nomes Copel, Sanepar ou Coca-Cola. Eles são somente dados temporários.
