# Arquitetura — APETIT-APP

## Componentes

- `apps/mobile`: aplicativo do funcionário em React Native + Expo.
- `apps/admin`: painel web da Apetit para operação, cardápios e relatórios.
- `backend`: API FastAPI e regras de negócio.
- `database`: esquema e futuras migrações PostgreSQL.

## Limites de responsabilidade

### App do funcionário

Pode:
- consultar o cardápio publicado;
- cadastrar restrições;
- enviar e confirmar um controle nutricional;
- receber sugestões calculadas pelo backend;
- registrar refeição;
- enviar feedback;
- consultar o próprio histórico.

Não pode:
- decidir sozinho segurança de alergênico;
- inventar metas nutricionais quando existe prescrição confirmada;
- recalcular no cliente regras que mudam a recomendação alimentar.

### Painel Apetit

Pode:
- importar CSV;
- revisar inconsistências;
- publicar e substituir cardápios;
- manter ficha técnica;
- consultar indicadores operacionais e feedback agregado.

Não deve expor:
- histórico alimentar individual;
- prescrição individual;
- relatório que permita reidentificar grupos muito pequenos.

### Backend

É a fonte de verdade para:
- regras nutricionais;
- alergênicos;
- validação de cardápio;
- cruzamento prescrição × cardápio;
- geração de combinações de refeição;
- privacidade e agregação de feedback.

## Fluxo de cardápio

1. upload do CSV;
2. parser normaliza o arquivo;
3. validação de datas, categorias, duplicatas e valores;
4. preview para a operação;
5. confirmação explícita;
6. publicação;
7. leitura pelo app.

## Fluxo de prescrição

1. funcionário envia PDF, imagem ou dados manuais;
2. camada de extração lê o documento;
3. sistema apresenta o que entendeu;
4. funcionário confirma ou corrige;
5. prescrição confirmada passa a ter prioridade sobre objetivo genérico;
6. backend cruza metas, porções, restrições e cardápio;
7. motor retorna uma ou mais combinações compatíveis;
8. se a meta não puder ser alcançada com segurança, o sistema informa a diferença em vez de inventar porções.

## Feedback e privacidade

O registro pode manter um identificador interno para deduplicação, exclusão LGPD e auditoria. A camada administrativa deve consumir consultas agregadas. Recortes pequenos devem ser suprimidos antes de retornar o dado ao painel.

## Princípio de segurança

Ausência de informação não equivale a zero e não equivale a seguro. Isso vale para macros, alergênicos e prescrição.
