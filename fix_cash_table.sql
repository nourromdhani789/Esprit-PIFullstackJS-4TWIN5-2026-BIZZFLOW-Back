-- Fix the cash table schema mismatch
-- Run this SQL in your MySQL database:

-- 1. First, backup any data if needed
-- CREATE TABLE cash_backup AS SELECT * FROM cash;

-- 2. Drop the incorrect cash table
DROP TABLE IF EXISTS cash;

-- 3. Restart your NestJS server - TypeORM will recreate the table with correct schema
