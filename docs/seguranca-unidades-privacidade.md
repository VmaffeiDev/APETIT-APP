# Entrega de 08/10/2026 — unidade do funcionário e privacidade dos indicadores

## O que muda

- Cardápio e opções de unidade exigem sessão do funcionário.
- Opções retornam somente a unidade vinculada no banco, incluindo seu primeiro
  refeitório (ordem por nome/id); a tela deixa de oferecer as três unidades fixas.
- Recomendação, avaliação do prato e satisfação recusam unidade de outra pessoa.
- Registro de refeição exige itens da unidade vinculada, data efetiva e tipo de
  refeição, em importação publicada. Itens repetidos são rejeitados; quantidade
  limitada a 10 porções por item, alinhada à avaliação de prato.
- Em development continua valendo a resolução de data de demonstração existente;
  fora de development a data precisa corresponder exatamente ao cardápio.
- Perfil/onboarding não concede nem altera vínculo de unidade, mesmo no primeiro
  acesso. A atribuição é uma ação administrativa autenticada e auditada.
- O relatório exige pelo menos cinco pessoas distintas, não cinco respostas.
  A regra também vale para cada dia da tendência e para cada tag.
- A visão geral e o PDF ocultam médias dos grupos pequenos. O total também fica
  oculto quando sua diferença em relação às unidades visíveis revelaria um grupo
  pequeno. Contagem de respostas continua visível.
- Comentários livres não são retornados; permanecem no banco para futura política
  de acesso/revisão. Não prometer anonimização automática de texto livre.
- O painel de satisfação deixa de inventar dados de demonstração quando a API falha.
  Uma sessão administrativa presente tem prioridade sobre a chave presentation.

## Atribuição de unidade

`PUT /api/admin/employees/{person_id}/unit`

Cabeçalho: Bearer da conta individual de administrador. Corpo JSON:

```json
{"unit_id": "UUID da unidade autorizada"}
```

Exige permissão `manage_users`, negada a chaves compartilhadas sem identidade.
Valida pessoa não excluída e unidade existente. Registra ator, pessoa, nova unidade
e unidade anterior em `admin_audit_events`, na mesma transação.

O funcionário precisa existir (primeiro login por e-mail pode criar o cadastro).
A tela administrativa de atribuição ainda não está implementada; esta entrega
fornece o endpoint auditado. Preparar os vínculos sintéticos antes do ensaio.
Após receber vínculo, o funcionário deve entrar novamente para atualizar a tela.
A sessão demo existente já recebe uma unidade do backend; seu compartilhamento
entre visitantes continua pendente de correção.

## Implantação coordenada

Publicar API, app e painel juntos, após validar os PRs de alergênicos e autenticação.
Atualizar a PWA nos dispositivos usados no ensaio: clientes antigos chamavam
`/api/menu` e `/api/auth/options` sem token. Não afrouxar o backend para compensar
clientes antigos. Confirmar uma conta individual de administrador antes da publicação.

Validar unidade/refeitório do visitante, cardápio publicado para a data, CSV de teste,
cinco funcionários sintéticos distintos para os indicadores e mensagens de erro.
Não marcar dados ausentes como verdadeiros para fazer a demonstração funcionar.

## Validação adicionada

12 cenários HTTP com PostgreSQL isolado: sessão ausente; outra unidade; vínculo
ausente; alteração do próprio vínculo; atribuição administrativa e auditoria;
itens de outra unidade, data ou refeição; registro correto e duplicação; acesso a
histórico de outra pessoa; satisfação/recomendação/prato fora da unidade; uma pessoa
com cinco respostas; cinco pessoas distintas; tags raras; tendência diária; supressão
na visão geral e no conteúdo enviado ao gerador de PDF.

## Limitações e trabalho restante

- Esta é proteção de grupos mínimos, não garantia de anonimato contra toda inferência
  por consultas sobrepostas, conhecimento externo ou recortes históricos.
- Revisar retenção e moderação dos comentários antes de liberá-los.
- Isolar sessões demo por visitante e revisar bootstrap/presentation.
- Criar tela de administração de vínculos e seleção de refeitório para unidades
  que possuem vários refeitórios.
- Concluir revisão de uploads, segredos, dependências, cookies/armazenamento de
  sessão, CORS, logs e infraestrutura antes do piloto real.
- Não testar ataques ou usar dados pessoais reais no ambiente da apresentação.
