-- 009_remove_order.sql
-- 1. Remove the sort_order column from emissions table

ALTER TABLE emissions
    DROP COLUMN sort_order;

    