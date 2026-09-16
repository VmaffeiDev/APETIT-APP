-- DADOS FICTÍCIOS PARA DEMONSTRAÇÃO DO APETIT-APP
-- Substituir pelas empresas/unidades reais quando a Apetit fornecer o relatório oficial.
-- Os UUIDs são fixos para que painel, testes e demonstração usem os mesmos registros.

INSERT INTO companies (id, name)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Copel'),
  ('10000000-0000-4000-8000-000000000002', 'Sanepar'),
  ('10000000-0000-4000-8000-000000000003', 'Coca-Cola')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO units (id, company_id, name)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Unidade Copel — Demonstração'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Unidade Sanepar — Demonstração'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Unidade Coca-Cola — Demonstração')
ON CONFLICT (id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  name = EXCLUDED.name;

INSERT INTO restaurants (id, unit_id, name)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Refeitório Copel — Demo'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Refeitório Sanepar — Demo'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Refeitório Coca-Cola — Demo')
ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  name = EXCLUDED.name;
