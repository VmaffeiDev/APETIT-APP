# Segurança — preparação da demonstração de 15/10/2026

## Escopo e método

Início em 07/10/2026. Revisão do código, testes automatizados com dados sintéticos
e validação controlada em homologação. Não executar testes de carga, força bruta
ou exploração contra o ambiente publicado nem consultar dados pessoais reais.
Esta revisão não é certificação, pentest independente ou validação de conformidade legal.

O aceite para piloto exige resolver falhas críticas/altas conhecidas no seu escopo,
validar a jornada completa e registrar limitações. Não declarar segurança absoluta.

## Primeira entrega: autenticação administrativa

### SEC-01 — chave compartilhada substitui contas individuais (alta)

Antes: `X-Apetit-Admin-Key` igual a `APETIT_API_SECRET` concedia privilégios de
administrador em qualquer ambiente. Uma configuração vazia podia coincidir com
um cabeçalho ausente; o valor padrão era conhecido.

Correção implementada:

- Desativada por padrão: `APETIT_ALLOW_LEGACY_ADMIN_KEY=false`.
- Rejeitada sempre em `staging` e `production`, mesmo com opt-in.
- Compatibilidade somente em `development`, com opt-in explícito e chave de ao
  menos 32 caracteres, não vazia/não padrão; comparação em tempo constante.
- Aplicada aos dois verificadores administrativos existentes.

Não habilitar a opção no ambiente da apresentação para contornar problemas de
login. Preparar e validar uma conta individual antes do deploy. A chave pública
`presentation`, disponível em development antes do primeiro administrador, ainda
é um fluxo separado e precisa ser revisada junto do bootstrap demo.

### SEC-02 — login por senha sem limite de tentativas (alta)

Correção implementada:

- Até 5 tentativas por conta em uma janela móvel de 15 minutos.
- Tentativas válidas também consomem o limite; o login não limpa o histórico.
- E-mail normalizado e armazenado como hash no controle de tentativas.
- Reserva atômica via transação e advisory lock PostgreSQL, compartilhada por
  todos os processos e mantida após reinício da API.
- Sexta tentativa retorna HTTP 429 e cabeçalho `Retry-After`.
- Usuário inexistente/inativo e senha incorreta retornam a mesma mensagem.
- Executar verificação de senha também para usuários inexistentes reduz uma
  diferença óbvia de custo; não garante igualdade perfeita de tempo de resposta.

Limites restantes: um atacante que conhece um e-mail pode consumir seu orçamento
e causar bloqueio temporário. Ainda falta limitação global/por origem confiável na
borda contra pulverização de senhas entre contas. Não confiar cegamente em
`X-Forwarded-For`. A retenção global de eventos também deve ganhar limpeza agendada;
esta entrega remove registros expirados apenas da conta que tenta entrar.

## Testes da entrega

- Chave legada: desligada por padrão; produção/staging negados; valores vazios,
  curtos, padrão e incorretos negados; opt-in de desenvolvimento explícito funciona.
- Login: erros persistem no contador; mudança de caixa do e-mail não reinicia limite;
  contas inexistentes recebem a mesma resposta; outra conta permanece independente.
- Expiração da janela permite nova tentativa; logout revoga a sessão.
- Conta desativada não entra.
- 12 reservas simultâneas para uma conta admitem exatamente 5.

## Demais frentes — ainda pendentes

| ID | Área | Verificação/correção necessária |
| --- | --- | --- |
| SEC-03 | Ambiente e demo | Exigir configuração explícita de ambiente; isolar visitantes; revisar bootstrap e chave presentation |
| SEC-04 | Autorização | Vínculo funcionário/unidade, itens/data da refeição, acesso a dados de outra pessoa, matriz de permissões |
| SEC-05 | Privacidade | Participantes distintos e supressão consistente em dashboard/PDF; comentários e dados de saúde |
| SEC-06 | Uploads | Tamanho, formatos, páginas, tempo/memória de extração e retenção de documentos |
| SEC-07 | Credenciais | Varredura de segredos em arquivos/histórico, logs e bundles, sem expor valores no relatório |
| SEC-08 | Dependências | Auditoria de versões efetivamente instaladas, lockfiles e tratamento de vulnerabilidades |
| SEC-09 | Sessões e navegador | Expiração, revogação, armazenamento web, XSS, headers e CORS conforme arquitetura |
| SEC-10 | Infraestrutura | Exposição do banco, TLS, permissões, backup/restauração, logs e monitoramento |
| SEC-11 | Outros fluxos de acesso | OTP funcionário, recuperação, cadastro, limites concorrentes e consumo único de códigos |
| SEC-12 | Abuso e disponibilidade | Limite global/por origem, tempo limite, fila de OCR e retenção de eventos |

As prioridades são preliminares e devem ser atualizadas por evidências. Não
considerar esta lista concluída só porque o CI passou. Documentar commit, ambiente,
resultado esperado e evidência de cada teste antes de liberar dados reais.
