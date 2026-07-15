-- schema.sql
DROP TABLE IF EXISTS Students;
DROP TABLE IF EXISTS Knowledge_State;

CREATE TABLE Students (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Knowledge_State (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  tier_level TEXT NOT NULL, -- '基础理解层', '综合运用层', '高阶表达层', '反思拓展层'
  base_l_score REAL,
  anomaly_s_score REAL,
  anomaly_details TEXT, -- JSON string detailing where the anomaly happened
  ai_analysis TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES Students(id)
);
