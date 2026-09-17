# APETIT Mobile

Aplicativo do funcionário em React Native + Expo + TypeScript.

## Primeira experiência implementada

- Home do funcionário;
- troca entre unidades fictícias Copel, Sanepar e Coca-Cola para apresentação;
- funcionária demo `Mariana Demo` com UUID fixo de seed;
- acesso a `Meu controle nutricional`;
- seleção de PDF, TXT ou imagem;
- upload para `/api/prescriptions/preview`;
- estado seguro para arquivo que precisa de OCR;
- conferência de kcal, proteína, carboidratos, gordura e porções reconhecidas;
- confirmação explícita antes de ativar a prescrição;
- consulta a `/api/nutrition/recommendation`;
- tela `Seu almoço de hoje` com itens e estimativa de macros;
- estado `insufficient_data` quando o cardápio não possui informação suficiente;
- aviso de privacidade e de que a sugestão não substitui orientação profissional.

## Execução local

```bash
cd apps/mobile
npm install
cp .env.example .env
npm start
```

Em aparelho físico, `EXPO_PUBLIC_API_URL` deve apontar para o IP local da máquina que está executando o backend, e não para `127.0.0.1`.

A base está fixada no Expo SDK 57 estável para a fundação. Pacotes Expo específicos devem ser mantidos compatíveis via `npx expo install --fix` durante upgrades.

## Próximos fluxos

- autenticação/onboarding;
- cardápio do dia;
- montar prato;
- registrar refeição;
- feedback pós-refeição;
- progresso;
- favoritos e notificações;
- perfil e privacidade.

As regras nutricionais e de alergênicos permanecem centralizadas no backend e não devem ser duplicadas no cliente.
