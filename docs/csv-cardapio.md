# Contrato inicial do CSV de cardápio

O importador será tolerante a variações de layout, mas internamente todo arquivo deve ser normalizado para estes campos:

| Campo | Obrigatório | Exemplo |
|---|---:|---|
| `data` | sim | `2026-09-21` |
| `refeicao` | sim | `almoco` |
| `categoria` | sim | `prato_principal` |
| `nome_prato` | sim | `Frango grelhado` |
| `codigo_ficha` | não | `01.03.01.033` |
| `porcao` | não | `120 g` |
| `kcal` | não | `198` |
| `proteina_g` | não | `36` |
| `carboidrato_g` | não | `0` |
| `gordura_g` | não | `6` |

## Regras de importação

1. O upload nunca publica automaticamente.
2. Toda linha deve ser associada a uma unidade e a uma data.
3. Data inválida, categoria vazia ou prato vazio bloqueiam a linha.
4. Ausência de macro permanece `NULL`; nunca vira zero.
5. Valores negativos de energia ou macronutrientes são inválidos.
6. Reimportar o mesmo período deve gerar um diff antes da substituição.
7. A publicação exige confirmação explícita da operação.
8. A ficha técnica, quando houver, é a chave preferencial para enriquecer o prato com dados nutricionais e alergênicos.

## Pipeline

```text
arquivo original
  -> detecção de layout
  -> normalização
  -> validação
  -> preview
  -> diff com versão publicada
  -> confirmação
  -> publicação
```
