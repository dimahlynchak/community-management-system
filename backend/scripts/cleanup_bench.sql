-- Очищає всі тестові дані, створені scripts/seed_benchmark.py.
-- Запуск: psql -d community_db -f scripts/cleanup_bench.sql
--
-- Видаляє у правильному порядку (від листя до кореня FK-дерева), бо у
-- продакшен-схемі немає ON DELETE CASCADE на більшості FK.

BEGIN;

WITH bench_communities AS (
    SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
),
bench_units AS (
    SELECT id FROM units WHERE community_id IN (SELECT id FROM bench_communities)
),
bench_payments AS (
    SELECT id FROM payments WHERE unit_id IN (SELECT id FROM bench_units)
),
bench_charges AS (
    SELECT id FROM charges WHERE unit_id IN (SELECT id FROM bench_units)
)
DELETE FROM payment_allocations
WHERE payment_id IN (SELECT id FROM bench_payments)
   OR charge_id IN (SELECT id FROM bench_charges);

DELETE FROM payments
WHERE unit_id IN (
    SELECT id FROM units WHERE community_id IN (
        SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
    )
);

DELETE FROM charges
WHERE unit_id IN (
    SELECT id FROM units WHERE community_id IN (
        SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
    )
);

DELETE FROM charge_types
WHERE community_id IN (
    SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
);

DELETE FROM units
WHERE community_id IN (
    SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
);

DELETE FROM user_community_roles
WHERE community_id IN (
    SELECT id FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\'
);

DELETE FROM communities WHERE name LIKE '\_BENCH\_%' ESCAPE '\';

-- Юзер bench@local лишається — використовується для повторних запусків.

COMMIT;

SELECT 'Cleanup complete.' AS status;
