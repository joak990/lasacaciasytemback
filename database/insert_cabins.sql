-- Script para insertar las cabañas especificadas
-- Ejecutar después de las migraciones de Prisma

INSERT INTO "cabins" (
  "id",
  "name", 
  "description",
  "capacity",
  "price",
  "status",
  "amenities",
  "imageUrl",
  "createdAt",
  "updatedAt"
) VALUES 
(
  'cabin-turquesa',
  'Turquesa',
  'Hermosa cabaña con vista al lago, perfecta para 4 personas',
  4,
  35000.00,
  'AVAILABLE',
  ARRAY['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Vista al lago'],
  'https://example.com/turquesa.jpg',
  NOW(),
  NOW()
),
(
  'cabin-maiz',
  'Maíz',
  'Cabaña espaciosa ideal para grupos de 6 personas',
  6,
  40000.00,
  'AVAILABLE',
  ARRAY['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Juegos de mesa'],
  'https://example.com/maiz.jpg',
  NOW(),
  NOW()
),
(
  'cabin-perla',
  'Perla',
  'Cabaña romántica perfecta para 2 personas',
  2,
  20000.00,
  'AVAILABLE',
  ARRAY['WiFi', 'Cocina completa', 'Terraza', 'Chimenea'],
  'https://example.com/perla.jpg',
  NOW(),
  NOW()
),
(
  'cabin-rosa',
  'Rosa',
  'Cabaña acogedora para 3 personas con ambiente familiar',
  3,
  20000.00,
  'AVAILABLE',
  ARRAY['WiFi', 'Cocina completa', 'Terraza', 'Jardín'],
  'https://example.com/rosa.jpg',
  NOW(),
  NOW()
),
(
  'cabin-beige',
  'Beige',
  'Cabaña moderna y elegante para 5 personas',
  5,
  40000.00,
  'AVAILABLE',
  ARRAY['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Jacuzzi'],
  'https://example.com/beige.jpg',
  NOW(),
  NOW()
);

-- Verificar que se insertaron correctamente
SELECT 
  id,
  name,
  capacity,
  price,
  status,
  createdAt
FROM "cabins" 
WHERE name IN ('Turquesa', 'Maíz', 'Perla', 'Rosa', 'Beige')
ORDER BY name; 