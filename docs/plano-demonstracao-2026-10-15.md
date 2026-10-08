# APETIT-APP — plano de preparação para 15/10/2026

Data de início: 07/10/2026. Prazo: quinta-feira, 15/10/2026.

## Objetivo e limites

Demonstrar uma jornada integrada confiável com dados sintéticos: publicação de cardápio
no Admin, acesso individual do funcionário, consulta, revisão de prescrição, montagem
e registro de prato, satisfação e indicadores no painel. Preparar um piloto controlado;
isso não equivale à homologação de produção ou à validação clínica das recomendações.

O cronograma é um plano de trabalho, não execução automática em segundo plano.
Priorizar correção e integração antes de funcionalidades novas. Concluir o ensaio até
14/10; reservar 15/10 para conferência e correções pequenas.

## Etapas e critérios de aceite

| Etapa | Janela | Trabalho | Critério de aceite |
| --- | --- | --- | --- |
| 1 — Regras críticas | 07–08/10 | Unificar alergênicos; revisar metas e dados insuficientes; validar os itens, unidade e data no registro de refeições | Testes de regressão passam; informação ausente não vira ausência de alergênico; backend rejeita registros inconsistentes |
| 2 — Acessos e privacidade | 09–10/10 | Restringir chave administrativa legada; limitar tentativas de login; definir vínculo funcionário/unidade; suprimir grupos pequenos em painel, relatórios e PDF | Perfis sem acesso são bloqueados; indicadores contam participantes distintos; dados privados não aparecem em agregações pequenas |
| 3 — Jornada e demonstração | 11–12/10 | Isolar visitantes demo; carregar unidades reais da API; remover mensagens demo do fluxo normal; validar destino do QR Code; substituir estados técnicos por textos claros | Dois visitantes não compartilham histórico nem sobrescrevem avaliações; jornada principal funciona no desktop e celular |
| 4 — Estabilidade | 13/10 | Persistir previews com expiração; limitar uploads; revisar dependências, prontidão e logs; registrar commits implantados | Reinício não perde previews válidos; arquivo excessivo é rejeitado; builds reproduzíveis e versão publicada identificável |
| 5 — Ensaio e aceite | 14/10 | Ensaiar apresentação completa; validar CSV/PDF/imagem, erros, sessões e relatórios; conferir dados sintéticos e plano de recuperação | Checklist abaixo executado; nenhum bloqueio da jornada principal; registro de evidências e limitações |
| 6 — Conferência final | 15/10 | Conferir links, acesso, QR Code e dados do dia; congelar mudanças de escopo; corrigir somente bloqueadores | Apresentação ensaiada e versão conhecida, com forma de recuperar a demonstração |

## Progresso inicial

- [x] Revisar o código-base e o CI do commit `6150879`.
- [x] Implementar política compartilhada de alergênicos na recomendação e no prato manual.
- [x] Adicionar testes unitários e de integração PostgreSQL para a política.
- [ ] Validar o PR completo no CI.
- [ ] Integrar a correção à branch usada no deploy e conferir no ambiente de demonstração.
- [ ] Executar os demais itens das etapas 1–6.

## Política de alergênicos da primeira entrega

Para cada restrição declarada pelo funcionário:

| Informação no item | Comportamento |
| --- | --- |
| `contains` | Excluir da recomendação; bloquear avaliação como compatível |
| `may_contain` | Tratar como incerteza; não recomendar |
| `free_from` explícito | Não bloquear por essa restrição |
| Informação ausente ou status desconhecido | Tratar como incerteza; não recomendar |
| `confirmed` legado | Tratar como presença para compatibilidade conservadora |

Normalizar maiúsculas, espaços externos e acentos sem inferir equivalência entre
alimentos diferentes (por exemplo, leite e lactose). Ausência de restrições não
cria bloqueio por alergênicos. Dados nutricionais incompletos continuam sujeitos à
validação existente. Manter os formatos de resposta atuais para os clientes.

Fichas sintéticas incompletas podem deixar de gerar sugestões para visitantes com
restrições. Completar apenas informações comprovadas na origem; nunca marcar
`free_from` automaticamente para facilitar a demonstração. Conferir o cadastro de
restrições e os snapshots de cardápios já publicados antes do ensaio.

## Checklist do ensaio

- [ ] Admin entra com conta e permissões adequadas.
- [ ] Importação de cardápio mostra preview e confirma o período explicitamente.
- [ ] Ficha técnica enriquece o cardápio publicado com os valores esperados.
- [ ] Funcionário acessa pelo QR Code da PWA funcional.
- [ ] Dois funcionários têm sessões e históricos independentes.
- [ ] Unidade do funcionário coincide com o cardápio e refeitório usados.
- [ ] Prescrição textual e imagem têm revisão e confirmação explícitas.
- [ ] Alérgeno presente, traços, ausência explícita e falta de dados têm mensagens corretas.
- [ ] Registro da refeição persiste após recarregar a página.
- [ ] Satisfação aparece no painel somente conforme a política de grupos mínimos.
- [ ] Expiração da sessão e falhas de rede exibem orientação recuperável.
- [ ] Relatório/PDF respeita os mesmos filtros e proteção do painel.
- [ ] Links, QR Code e versão publicada são registrados no roteiro final.
- [ ] Backup/restauração e dados de apresentação foram conferidos.

## Links de referência

- Admin: https://admin-production-02d0.up.railway.app
- Funcionário (PWA): https://api-production-c008.up.railway.app
- API: https://api-staging-v2-production.up.railway.app

As rotas `/funcionario` e `/app-funcionario` da API são páginas estáticas no código
revisado; não usá-las como destino do QR Code funcional.

## Fora do escopo da apresentação

Publicação em lojas de aplicativos, novas integrações com ERP, gamificação completa,
expansão comercial e novas funcionalidades que comprometam a estabilização.
Qualquer pendência crítica remanescente impede declarar o produto pronto para uso real.
