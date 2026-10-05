export type DemoUnit = {
  company: string
  unitName: string
  unitId: string
  restaurantName: string
  restaurantId: string
  logoUrl: string
}

// Dados temporários de demonstração.
// Substituir quando a Apetit enviar o relatório oficial de empresas/unidades.
export const DEMO_UNITS: DemoUnit[] = [
  {
    company: 'Copel',
    unitName: 'Unidade Copel — Demonstração',
    unitId: '20000000-0000-4000-8000-000000000001',
    restaurantName: 'Refeitório Copel — Demo',
    restaurantId: '30000000-0000-4000-8000-000000000001',
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Copel.svg',
  },
  {
    company: 'Sanepar',
    unitName: 'Unidade Sanepar — Demonstração',
    unitId: '20000000-0000-4000-8000-000000000002',
    restaurantName: 'Refeitório Sanepar — Demo',
    restaurantId: '30000000-0000-4000-8000-000000000002',
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Logotipo_Sanepar.svg',
  },
  {
    company: 'Coca-Cola',
    unitName: 'Unidade Coca-Cola — Demonstração',
    unitId: '20000000-0000-4000-8000-000000000003',
    restaurantName: 'Refeitório Coca-Cola — Demo',
    restaurantId: '30000000-0000-4000-8000-000000000003',
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Coca-Cola_logo.svg',
  },
]
