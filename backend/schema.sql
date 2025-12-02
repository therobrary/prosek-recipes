DROP TABLE IF EXISTS recipes;
CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    serves TEXT,
    cook_time TEXT,
    ingredients TEXT, -- JSON Array
    directions TEXT, -- JSON Array
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
