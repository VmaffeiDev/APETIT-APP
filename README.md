# APETIT-APP

Nova plataforma da Apetit para experiência do funcionário, gestão de cardápios e inteligência operacional.

## Visão do produto

O APETIT-APP nasce do zero como produto oficial, separado do legado `ApetitFoodBot`.

A plataforma terá três frentes principais:

1. **App do funcionário**
   - onboarding e perfil
   - restrições e alergênicos
   - cardápio do dia
   - controle nutricional individual
   - leitura e confirmação da prescrição do nutricionista
   - sugestão de combinação do cardápio para aproximar a refeição da meta prescrita
   - registro da refeição
   - progresso, favoritos e histórico
   - feedback da refeição e do refeitório

2. **Painel Apetit / Operação**
   - importação de cardápio semanal via CSV
   - pré-validação e preview antes da publicação
   - histórico de importações e substituições
   - gestão de unidades, empresas e refeitórios
   - fichas técnicas e dados nutricionais
   - acompanhamento de inconsistências e alergênicos

3. **Feedback & Relatórios**
   - avaliações agregadas de comida e atendimento
   - principais motivos de insatisfação
   - comentários sem identificação direta
   - filtros por período, unidade, empresa e refeitório
   - proteção de grupos pequenos para reduzir risco de reidentificação
   - indicadores operacionais e tendências

## Princípios de arquitetura

- app, painel administrativo e backend são componentes separados
- PostgreSQL como banco principal
- regras nutricionais e de segurança ficam no backend/domínio, não espalhadas pelas telas
- CSV nunca é publicado diretamente: passa por parse, validação, preview e confirmação
- uma prescrição profissional confirmada pelo funcionário tem prioridade sobre objetivos genéricos
- o app não inventa uma meta nutricional quando já existe orientação profissional cadastrada
- dados alimentares individuais permanecem privados; gestão recebe apenas o necessário e, quando aplicável, dados agregados
- ausência de informação nutricional ou de alergênico nunca deve ser tratada como zero ou como segurança confirmada

## Arquitetura alvo

```text
apps/
  mobile/        # React Native + Expo + TypeScript
  admin/         # painel web Apetit

backend/
  api/           # FastAPI
  domain/        # regras de negócio
  services/      # casos de uso
  integrations/  # e-mail, storage, notificações, IA/OCR

database/
  migrations/
  seeds/

docs/
  architecture.md
  product.md
  privacy.md
```

## Fluxo do cardápio

```text
CSV
 -> upload
 -> parser
 -> validação
 -> preview
 -> confirmação
 -> publicação
 -> app dos funcionários
```

## Fluxo do controle nutricional

```text
Documento do nutricionista
 -> leitura/OCR
 -> extração estruturada
 -> confirmação do funcionário
 -> metas e regras da prescrição
 -> cruzamento com cardápio publicado
 -> remoção de itens incompatíveis com restrições
 -> motor de combinações
 -> sugestão de refeição
```

## Status

Projeto em fundação inicial.
