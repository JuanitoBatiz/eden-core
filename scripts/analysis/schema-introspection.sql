-- SOLO LECTURA. Pegar en Supabase > SQL Editor y ejecutar cada bloque (Run). No modifica nada.
-- Pegar los resultados (o exportar CSV) para completar docs/analysis/02-base-de-datos.md.

-- 1) CHECK constraints, PK, FK, UNIQUE
select conrelid::regclass as tabla, conname, contype, pg_get_constraintdef(oid) as definicion
from pg_constraint where connamespace = 'public'::regnamespace order by 1, 3, 2;

-- 2) Índices
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by 1, 2;

-- 3) Triggers
select event_object_table as tabla, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers where trigger_schema = 'public' order by 1, 2;

-- 4) Funciones / RPC (código completo)
select p.proname, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as definicion
from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;

-- 5) RLS por tabla y políticas
select c.relname as tabla, c.relrowsecurity as rls_activo from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1;
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;

-- 6) Extensiones y cron jobs (¿existe pg_cron?)
select extname, extversion from pg_extension order by 1;
-- (ejecutar solo si pg_cron aparece arriba)
-- select jobid, schedule, command, active from cron.job;

-- 7) Políticas de Storage
select policyname, cmd, qual, with_check from pg_policies where schemaname = 'storage' order by 1;
