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

O navegador de revisão não alcançou o servidor local. A abertura direta de arquivos foi bloqueada pela política do navegador. A inspeção visual e os testes de interação desta versão ainda precisam ser realizados em uma publicação acessível; compilação não substitui esse ensaio.

## Ensaio após publicação

1. Abrir Início, Cardápio, Meu prato, Progresso e Perfil em 390 px e em desktop; conferir ausência de cortes e rolagem lateral.
2. Em Perfil → Aparência, escolher Escuro, navegar pelas cinco telas, recarregar e conferir que o tema permanece. Repetir com Claro.
3. Abrir Cardápio, filtrar Acompanhamentos e conferir arroz, feijão e guarnição; voltar a Todos.
4. No montador, conferir limites 0–3, avaliação sem seleção desabilitada e avaliação com itens. Conferir Carboidratos nos macronutrientes.
5. Abrir Quanto pegar hoje e conferir a mensagem de demonstração. Não registrar refeições ou enviar avaliações reais durante o ensaio visual.
6. Conferir estado vazio de Progresso e retorno ao montador; conferir retorno do Perfil a cada aba e reposicionamento da rolagem.
7. Conferir acesso por teclado, foco visível, mensagens de erro e campos de perfil nos dois temas.

## Publicação

Publicar somente o serviço da PWA (`api`, domínio `api-production-c008.up.railway.app`) no commit desta alteração, após aprovação. API e admin têm publicações independentes. O commit anterior da PWA é `2f8e18912354865bafc392aa31b7089780199a6f`.

Não foram adicionados serviços pagos, provedores de IA ou dependências de execução. O OCR externo continua sem configuração.
