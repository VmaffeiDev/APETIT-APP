# Gestão de funcionários e isolamento da demonstração

Entrega de 08/10/2026, construída sobre o PR #4. Integrar primeiro o PR #4.

## Operação

1. O funcionário realiza o primeiro login por e-mail. Isso cria seu cadastro, ainda sem unidade.
2. Um administrador individual abre **Usuários e acessos → Funcionários e unidades**.
3. Busca pelo nome/e-mail ou filtra **Aguardando unidade**, seleciona a unidade real e confirma.
4. A API registra o autor, funcionário e unidade anterior na auditoria.
5. O funcionário sai e entra novamente para concluir o perfil e carregar seu cardápio.

A tela contém paginação de 25 registros, estados de carregamento, vazio, erro e confirmação. A listagem retorna somente identidade e vínculo, sem prescrições, restrições ou histórico alimentar. Contas de operação/nutrição/visualização, funcionários e chaves compartilhadas não podem consultar ou alterar vínculos. Mesmo em apresentação, a rota de gestão exige login individual de administrador.

## Demonstração

Cada chamada ao início de demonstração cria uma pessoa distinta com identificador aleatório e sessão de oito horas. O histórico e o perfil deixam de ser compartilhados entre visitantes. Sair de uma sessão não encerra as outras. Na primeira visita ao fluxo novo, as sessões da antiga conta compartilhada são revogadas. O endpoint continua indisponível fora de development.

O fluxo ainda escolhe a primeira unidade cadastrada. Usar banco/ambiente de demonstração com dados fictícios: oito horas limitam a sessão, não apagam os registros. Visitas distintas não equivalem necessariamente a pessoas físicas distintas; avaliações demo não devem compor indicadores de produção. Limitação de criação de visitas e rotina de retenção continuam pendentes. O código fixo de login de development também impede tratar esse ambiente como produção.

## Validação e publicação

Testes HTTP/PostgreSQL cobrem permissão de consulta, campos mínimos, exclusão lógica, busca literal, paginação, filtro de vínculo, unidades reais, identidades demo diferentes, acesso cruzado negado, validade da sessão, logout independente e bloqueio em produção. A validação completa fica registrada no CI do PR desta entrega.

Publicar API e painel após integrar e validar as entregas anteriores. Não foi executado deploy nem ensaio visual no ambiente publicado nesta etapa. Os PRs #2 e #3 permanecem entregas independentes e precisam ser integrados e testados em conjunto antes da apresentação.
