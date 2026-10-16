# Atualização visual do app do colaborador — 15/10/2026

## Mudanças

- Home com ações principais, ilustração decorativa do prato e progresso ligado aos mesmos dados da aba Progresso.
- Cardápio com categorias e valores por porção, sem classificação nutricional baseada na posição do item ou fotos que não representam a preparação.
- Montador com controles de 44 px, indicação da seleção e limites de zero a três porções; avaliação desabilitada quando não há seleção.
- Progresso com os últimos sete dias e uma ação útil quando não há registros. Removidos os filtros de mês/ano que não tinham comportamento.
- Perfil integrado à navegação, com escolha de tema claro ou escuro. A preferência é local ao dispositivo; não é enviada ao backend.
- Temas aplicados também ao acesso, cadastro e revisão da prescrição. Contrastes de texto revisados nas duas paletas.
- Navegação inferior em telas menores; barra lateral a partir de 900 px. Removido o limite global de 430 px da PWA no computador.
- Documento HTML identificado como português do Brasil e sem tradução automática, para evitar alterações indevidas nos textos da interface.

## Validação realizada

- `npm run typecheck`.
- `EXPO_PUBLIC_API_URL=https://api-staging-v2-production.up.railway.app npm run build:web`.
- `git diff --check`.
- Cálculo de contraste dos pares de texto principal, secundário, marca, aviso, sucesso, erro e botão primário, nas duas paletas.

O ensaio local foi limitado pelo acesso do navegador ao servidor local. A versão `563a817568482da02038872782a0974667fe0cfd` foi publicada na PWA em 15/10 e conferida no navegador em 16/10/2026.

### Ensaio na publicação — 16/10/2026

- Navegação por Início, Cardápio, Meu prato, Progresso e Perfil no Chrome desktop, em 1363 × 936 px.
- Temas Claro e Escuro permanecem após recarregar a página; perfil de demonstração exibe “Conta de demonstração”, sem o e-mail técnico.
- Cardápio com seis preparações; Acompanhamentos filtra arroz, feijão e guarnição. Não há fotos de outras preparações nem selos nutricionais arbitrários.
- Montador sem itens mantém a avaliação desabilitada; controles limitados a zero–três porções. Uma porção de arroz, feijão, carne e folhas foi avaliada com sucesso: 520 kcal, 43 g de proteína, 57 g de carboidratos e 14 g de gorduras, com aviso de meta fictícia.
- “Quanto pegar hoje” retornou uma sugestão de demonstração, sem o erro de prescrição ausente. A tela de avaliação do refeitório abriu sem mensagem de erro residual.
- Home e Progresso exibiram zero pontos e zero dias registrados. O atalho do estado vazio abriu o montador.
- Nenhuma refeição foi registrada e nenhuma avaliação do refeitório foi enviada durante o ensaio.

O ensaio identificou dois ajustes complementares: expor `aria-checked` na seleção de tema e `aria-current` na navegação web, e apresentar “Carregando sua unidade…” enquanto a consulta está pendente, reservando a mensagem de falha para um erro real. O perfil continua montado se a unidade for recarregada durante sua edição.

Ainda falta a conferência em 390 px e em dispositivos Android/iOS, além do teste com leitor de tela real. O ensaio desktop não substitui essas verificações. Registro de refeições, envio de feedback e fluxo completo de prescrição não foram executados nesta revisão visual.

## Ensaio após publicação

1. Abrir Início, Cardápio, Meu prato, Progresso e Perfil em 390 px e em desktop; conferir ausência de cortes e rolagem lateral.
2. Em Perfil → Aparência, escolher Escuro, navegar pelas cinco telas, recarregar e conferir que o tema permanece. Repetir com Claro.
3. Abrir Cardápio, filtrar Acompanhamentos e conferir arroz, feijão e guarnição; voltar a Todos.
4. No montador, conferir limites 0–3, avaliação sem seleção desabilitada e avaliação com itens. Conferir Carboidratos nos macronutrientes.
5. Abrir Quanto pegar hoje e conferir a mensagem de demonstração. Não registrar refeições ou enviar avaliações reais durante o ensaio visual.
6. Conferir estado vazio de Progresso e retorno ao montador; conferir retorno do Perfil a cada aba e reposicionamento da rolagem.
7. Conferir acesso por teclado, foco visível, mensagens de erro e campos de perfil nos dois temas.

## Publicação

A publicação autorizada foi realizada somente no serviço da PWA (`api`, domínio `api-production-c008.up.railway.app`), implantação `b1ac7a8a-0937-42a0-a51c-0fd4a221c96a`, em 15/10/2026. Os ajustes complementares seguem o mesmo serviço; seu estado de publicação está registrado no PR #15. API e admin têm publicações independentes. A versão anterior ao redesign é `2f8e18912354865bafc392aa31b7089780199a6f`.

Não foram adicionados serviços pagos, provedores de IA ou dependências de execução. O OCR externo continua sem configuração.
