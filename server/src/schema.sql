-- Wayground clone schema (PostgreSQL 10 compatible)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'teacher',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id            SERIAL PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Quiz',
  subject       TEXT,
  grade         TEXT,
  language      TEXT NOT NULL DEFAULT 'English',
  visibility    TEXT NOT NULL DEFAULT 'public',      -- public | private
  cover_image   TEXT,
  teaching_goal TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',       -- draft | published | archived
  source        TEXT,                                -- scratch | ai-prompt | ai-upload | copy | translate
  plays         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quizzes_owner_idx ON quizzes(owner_id);

CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  type        TEXT NOT NULL,                 -- mcq | msq | tf | fill | open | poll | reorder | match | draw
  text        TEXT NOT NULL DEFAULT '',
  image       TEXT,
  options     JSONB NOT NULL DEFAULT '[]',   -- [{id,text,image}] or match pairs [{id,left,right}]
  answer      JSONB,                         -- type specific, see server/src/grading.js
  points      INTEGER NOT NULL DEFAULT 1,
  time_limit  INTEGER NOT NULL DEFAULT 30,   -- seconds
  explanation TEXT,
  extra       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_quiz_idx ON questions(quiz_id, position);

CREATE TABLE IF NOT EXISTS sessions (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  title            TEXT,
  kind             TEXT NOT NULL DEFAULT 'live',     -- live | homework | preview
  pace             TEXT NOT NULL DEFAULT 'student',  -- student | teacher
  game_type        TEXT NOT NULL DEFAULT 'classic',  -- classic | test
  settings         JSONB NOT NULL DEFAULT '{}',
  quiz_snapshot    JSONB NOT NULL,                   -- frozen copy of questions at start
  status           TEXT NOT NULL DEFAULT 'lobby',    -- lobby | running | ended
  current_index    INTEGER NOT NULL DEFAULT -1,      -- teacher-led: question on screen
  phase            TEXT NOT NULL DEFAULT 'idle',     -- teacher-led: idle | question | reveal | leaderboard
  question_started TIMESTAMPTZ,
  deadline         TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_code_idx ON sessions(code);
CREATE INDEX IF NOT EXISTS sessions_host_idx ON sessions(host_id);

CREATE TABLE IF NOT EXISTS participants (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  avatar      TEXT,
  attempt     INTEGER NOT NULL DEFAULT 1,
  score       INTEGER NOT NULL DEFAULT 0,
  streak      INTEGER NOT NULL DEFAULT 0,
  max_streak  INTEGER NOT NULL DEFAULT 0,
  order_map   JSONB,                          -- per-player shuffled question order
  kicked      BOOLEAN NOT NULL DEFAULT false,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS participants_session_idx ON participants(session_id);
-- host cut the player off: they cannot keep playing but their results stay in the report
ALTER TABLE participants ADD COLUMN IF NOT EXISTS disconnected BOOLEAN NOT NULL DEFAULT false;
-- random id kept by the player's browser, used to count attempts when the name changes
ALTER TABLE participants ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS participants_device_idx ON participants(session_id, device_id);

CREATE TABLE IF NOT EXISTS responses (
  id             SERIAL PRIMARY KEY,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL,
  answer         JSONB,
  status         TEXT NOT NULL,              -- correct | incorrect | partial | ungraded | skipped
  fraction       REAL NOT NULL DEFAULT 0,    -- 0..1 credit
  score          INTEGER NOT NULL DEFAULT 0,
  time_ms        INTEGER NOT NULL DEFAULT 0,
  feedback       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);
CREATE INDEX IF NOT EXISTS responses_session_idx ON responses(session_id);
