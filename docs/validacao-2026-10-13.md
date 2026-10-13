# Validação de 13/10/2026

## API publicada (commit 2f8e189)

Ensaio com dois visitantes demo independentes, sem usar credenciais administrativas.
Recomendação e avaliação do prato responderam 200 com referência demo.
Registro de almoço respondeu 200; repetir atualizou a mesma refeição.
Histórico e progresso confirmaram uma refeição (cinco pontos pela regra da interface).
Outro funcionário e outra unidade foram bloqueados com 403.
Funcionário não acessou o admin (401); endpoints protegidos sem sessão responderam 401.
Logout das duas sessões respondeu 200 e acesso posterior respondeu 401.
Foi mantida uma refeição fictícia no visitante criado para o ensaio; não foi enviado feedback.

## Correção de recuperação de senha

Tentativas inválidas eram gravadas na transação que lançava HTTP 401, causando rollback
do contador. A reserva agora é confirmada antes do trabalho de recuperação, com lock
por conta no PostgreSQL para impedir que concorrência ultrapasse o limite.
Pedidos de recuperação e cadastro usam a mesma reserva atômica.
Confirmação conta todas as tentativas e limpa o orçamento após uma redefinição válida.
Nenhuma senha ou token é gravado no contador, somente hash do e-mail e tipo de evento.

Quatro testes adicionais cobrem limite após links inválidos, concorrência,
falha de entrega e invalidação, uso único do link e revogação de sessões.
A execução completa fica registrada no CI do PR correspondente.

## Satisfação

Mensagem vazia distingue ausência de avaliações de proteção de grupos pequenos.
O mínimo é explicado como pessoas distintas e o período efetivamente consultado
é mostrado mesmo quando os detalhes estão ocultos. Removida data fixa incorreta
no aviso de apresentação.

O resultado histórico da base publicada ainda precisa ser confirmado com sessão
administrativa: a conexão do navegador falhou na consulta anterior.
Os ensaios por API não substituem a revisão visual final nem uma auditoria completa.
