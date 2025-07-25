-- Script de inicialización de la base de datos
-- Este archivo se ejecuta automáticamente cuando se crea el contenedor de PostgreSQL

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear índices adicionales si es necesario
-- (Prisma se encargará de crear las tablas y relaciones)

-- Comentario: Las tablas se crearán automáticamente cuando ejecutes las migraciones de Prisma
-- npm run db:migrate 