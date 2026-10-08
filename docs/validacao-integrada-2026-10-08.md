# Versão integrada para a apresentação de 15/10/2026

Consolida os PRs #2 (alergênicos), #3 (autenticação administrativa), #4 (unidades e privacidade) e #5 (gestão de funcionários e visitantes demo).

A integração ajusta a expectativa de recusa da chave legada (401) e remove uma exigência residual de chave na importação de cardápio quando já existe sessão administrativa autenticada.

## Ensaio automatizado

O teste `test_integrated_employee_journey_from_email_login_to_report` executa, com registros sintéticos isolados em PostgreSQL: solicitação de código e autenticação do funcionário; bloqueio por falta de vínculo; atribuição administrativa; conclusão do perfil; consulta do cardápio; registro e histórico de refeição; avaliações de cinco pessoas; liberação do agregado somente no limite mínimo; ocultação de comentários; exportação PDF restrita ao administrador; encerramento da sessão.

O transporte de e-mail é substituído somente no teste para capturar o código. Portanto, este teste não valida a entrega real de e-mail. Os dados do cardápio são preparados pela fixture; a importação/publicação tem testes próprios. Esta é uma validação HTTP/API, não um ensaio visual no navegador.

## Ensaio no ambiente publicado

- Publicar o conjunto API, painel e PWA; conferir o commit efetivamente ativo em cada serviço.
- Usar administrador individual e conferir login, recuperação de acesso e perfil de visualização.
- Confirmar envio real de e-mail e vincular um funcionário na tela Usuários e acessos.
- Importar/publicar a planilha de demonstração na unidade e data certas.
- Abrir a PWA em celular e computador, renovar a versão em cache, consultar cardápio, registrar refeição e enviar avaliação.
- Usar cinco identidades sintéticas para o relatório, conferir PDF e ausência de dados individuais.
- Abrir duas sessões demo em navegadores distintos e verificar separação de perfil e histórico.
- Confirmar que o QR Code aponta para a PWA, sem confundir a página estática da API com o app.

Não inserir dados pessoais reais no ambiente development: há login por código fixo e criação pública de visitantes. Sessões de oito horas não removem os dados demo. Retenção, limitação de visitas e inferência por consultas sobrepostas permanecem pendentes.

Resultado do CI, status de integração e publicação estão registrados no PR desta versão. A conclusão dos testes não equivale à conclusão da auditoria de segurança nem do ensaio visual.
