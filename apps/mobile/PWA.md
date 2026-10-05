# APETIT PWA staging

Este build usa o mesmo código do aplicativo React Native via Expo Web para validação visual e funcional em navegador mobile.

- build: `npm run build:web`
- runtime: `npm run serve:web`
- backend: `EXPO_PUBLIC_API_URL`
- manifest e service worker: gerados por `scripts/pwa-postexport.mjs`

O PWA é um ambiente de staging e não substitui o aplicativo nativo final.
