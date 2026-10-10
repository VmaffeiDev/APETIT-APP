# Correções do ensaio visual de 10/10

- Visitantes demo sem prescrição recebem referência fictícia de almoço (650 kcal, 30 g proteína, 80 g carboidrato, 20 g gordura). Só vale em development para identidades aleatórias do fluxo demo. Prescrição real tem prioridade; produção e funcionários comuns continuam exigindo prescrição confirmada. Não são gravadas prescrições fictícias. A API identifica a referência e o app exibe aviso de demonstração.
- Erros são associados à tela de origem e limpos na navegação. Respostas atrasadas de outra tela não aparecem na atual.
- Home e Progresso calculam pontos pelos mesmos registros dos últimos sete dias, cinco pontos por refeição. Não há conquistas fixas. A confirmação do feedback deixa de afirmar que registrou refeição ou premiou pontos.
- Perfil demo oculta e-mail técnico; rótulo Glúten acentuado; ícones substituem fotos de pratos escolhidas por índice.
- Um componente de navegação administrativa mantém ordem e permissões em todas as páginas operacionais, com uma única entrada para satisfação/feedbacks. Removido o roteamento global por texto de botão, que podia sobrescrever o destino de Histórico.
- Visão geral/PDF e Feedbacks usam sete dias por padrão; filtros manuais de Feedbacks continuam disponíveis. Médias podem continuar ocultas por privacidade mesmo com respostas. Nenhum dado foi fabricado para elevar indicadores.
- Fichas técnicas inicia na Coca-Cola se autorizada; a cobertura global continua real. Logos externos frágeis foram substituídos por iniciais locais. Última publicação preserva a data real e identifica período histórico. Texto de zero respostas foi corrigido; Códigos sem ficha já possui acento no código atual.

Testes adicionais verificam referência demo em ambos os fluxos, bloqueio em produção/contas comuns, ausência de gravação de prescrição, e consistência dos sete dias entre resumo e visão geral. Builds/CI registrados no PR. Dados publicados não foram editados durante a correção.
