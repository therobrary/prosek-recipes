DROP TABLE IF EXISTS recipes;
CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    serves TEXT,
    cook_time TEXT,
    ingredients TEXT, -- JSON Array
    directions TEXT, -- JSON Array
    tags TEXT, -- JSON Array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
