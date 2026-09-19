# Layout real de cardápio — Planejamento

Arquivo de referência analisado: `Cardapio 17 a 21-08.xlsx`.

## Estrutura observada

- aba: `Planejamento`
- 5 linhas de dias: 17, 18, 19, 20 e 21
- 21 colunas no total
- primeira coluna: `Dia`
- 16 colunas que podem virar itens visíveis no cardápio do funcionário
- 4 colunas operacionais que devem morrer na importação

## Colunas publicáveis

- PRATO PRINCIPAL
- PRATO PRINCIPAL 2
- OPCAO AO PP
- GUARNICAO
- SALADA
- SALADA 2
- SALADA 3
- SOBREMESA
- SOBREMESA 2
- ARROZ
- ARROZ 2
- FEIJAO
- BEBIDA
- BEBIDA 2
- BEBIDA 3
- ACOMPANHAMENTO

## Colunas operacionais excluídas

- KIT - DESCARTAVEIS
- KIT - QUIMICO
- KIT - TEMPERO
- KIT - GALETEIRO

Essas colunas não representam alimentos a serem apresentados ao funcionário e não devem chegar à API pública de cardápio.

## Conteúdo das células

O layout mistura nome, porção, referências internas e custo per capita na mesma célula.

Exemplos reais:

```text
BIFE ACEBOLADO (80g) - C51 - 3.11
30% - 06.03.01.258 - CUBOS DE MELAO - 0.55
ARROZ PARBOILIZADO - C51 - 0.24
```

A importação deve normalizar isso para uma estrutura como:

```text
dia: 17
categoria: prato_principal
nome: BIFE ACEBOLADO
porcao: 80g
codigo_ficha: null
```

ou:

```text
dia: 17
categoria: sobremesa
nome: CUBOS DE MELAO
porcao: null
codigo_ficha: 06.03.01.258
```

## Regra de privacidade comercial

O valor monetário no final da célula é custo per capita da operação. Ele é descartado durante o parse e não faz parte do objeto `ImportedMenuItem`.

Assim, o dado comercial não possui caminho para chegar ao aplicativo do funcionário.

## Datas

O arquivo contém apenas o número do dia. Mês e ano precisam ser confirmados na etapa de preview antes da publicação. O nome do arquivo pode ajudar a sugerir o período, mas nunca deve publicar automaticamente a partir de uma inferência.

## Formatos aceitos

O backend deve aceitar este mesmo layout tanto em `.xlsx` quanto em `.csv`.

O módulo inicial responsável por essa normalização é:

`backend/app/services/menu_import.py`
