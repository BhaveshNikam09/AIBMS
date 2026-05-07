-- Fix: Mark the correct Head Office branch for each business
-- Run this in psql or pgAdmin against your AIBMS database.

-- Step 1: See all your branches first
SELECT name, branch_type, is_primary, city, created_at
FROM branches
WHERE is_active = true
ORDER BY created_at ASC;

-- Step 2: Mark the OLDEST branch per business as head_office + primary
-- (This is a safe default — the first branch created is usually the main one)
UPDATE branches
SET branch_type = 'head_office', is_primary = true
WHERE id IN (
    SELECT DISTINCT ON (business_id) id
    FROM branches
    WHERE is_active = true
    ORDER BY business_id, created_at ASC
)
AND branch_type != 'head_office';  -- Don't overwrite if already set

-- Step 3: Verify
SELECT name, branch_type, is_primary FROM branches WHERE is_active = true;
