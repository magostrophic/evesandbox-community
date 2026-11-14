-- Post editing. Run once in the D1 console (Workers & Pages > D1 > your database > Console).
ALTER TABLE posts ADD COLUMN edited INTEGER NOT NULL DEFAULT 0;
