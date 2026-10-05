export const DEMO_PERSON = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'Mariana Demo',
}

export const DEMO_UNITS = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    restaurantId: '30000000-0000-4000-8000-000000000001',
    company: 'Copel',
    label: 'Unidade Copel',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    restaurantId: '30000000-0000-4000-8000-000000000002',
    company: 'Sanepar',
    label: 'Unidade Sanepar',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    restaurantId: '30000000-0000-4000-8000-000000000003',
    company: 'Coca-Cola',
    label: 'Unidade Coca-Cola',
  },
]

export function configureEmployeeContext(params: { id: string; name: string; unitId?: string | null }) {
  DEMO_PERSON.id = params.id
  DEMO_PERSON.name = params.name
  if (params.unitId) {
    const index = DEMO_UNITS.findIndex((unit) => unit.id === params.unitId)
    if (index > 0) {
      const [unit] = DEMO_UNITS.splice(index, 1)
      DEMO_UNITS.unshift(unit)
    }
  }
}
