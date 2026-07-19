// Local-first SQLite persistence (in-browser).
//
// The runtime store in ./db is in-memory and resets on every page load.
// This module is the durable backing store: it keeps a real SQLite database
// (sql.js / WASM) whose bytes are persisted to IndexedDB, so the dashboard
// survives a page refresh with no backend and no re-ingestion.
//
// The indatabase schema mirrors the one described in frontend/CLAUDE.md. The
// query layer (./usage-queries) never touches this file — it reads the
// in-memory store, which ./db hydrates from here on startup.

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js"
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url"

import type { Store } from "./db"
import type {
  Model,
  Project,
  Task,
  UsageEvent,
  User,
} from "./usage-types"

const IDB_NAME = "token-traking"
const IDB_STORE = "sqlite"
const DB_KEY = "db"

let sqlStatic: SqlJsStatic | null = null
let db: Database | null = null

async function getSqlStatic(): Promise<SqlJsStatic> {
  if (!sqlStatic) {
    sqlStatic = await initSqlJs({ locateFile: () => sqlWasmUrl })
  }
  return sqlStatic
}

// ---- IndexedDB helpers (store the exported DB bytes) ----------------------

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetBytes(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb()
    return await new Promise<Uint8Array | null>((resolve) => {
      const tx = idb.transaction(IDB_STORE, "readonly")
      const req = tx.objectStore(IDB_STORE).get(DB_KEY)
      req.onsuccess = () => resolve((req.result as Uint8Array) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function idbSetBytes(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await openIdb()
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(IDB_STORE, "readwrite")
      tx.objectStore(IDB_STORE).put(bytes, DB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Persistence is best-effort; the in-memory store still works without it.
  }
}

// ---- Schema ---------------------------------------------------------------

function migrate(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id text primary key,
      name text not null,
      description text,
      color text,
      created_at text not null,
      updated_at text not null
    );
    CREATE TABLE IF NOT EXISTS users (
      id text primary key,
      name text not null,
      email text,
      avatar_url text,
      role text,
      created_at text not null,
      updated_at text not null
    );
    CREATE TABLE IF NOT EXISTS models (
      id text primary key,
      provider text not null,
      name text not null,
      display_name text not null,
      input_cost_per_1m real default 0,
      output_cost_per_1m real default 0,
      cached_input_cost_per_1m real default 0,
      created_at text not null,
      updated_at text not null
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id text primary key,
      project_id text not null,
      user_id text,
      title text not null,
      status text not null default 'active',
      tags text,
      started_at text,
      completed_at text,
      created_at text not null,
      updated_at text not null
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id text primary key,
      project_id text not null,
      user_id text,
      task_id text,
      model_id text not null,
      input_tokens integer not null default 0,
      output_tokens integer not null default 0,
      cached_input_tokens integer not null default 0,
      total_tokens integer not null default 0,
      estimated_cost real not null default 0,
      event_at text not null,
      created_at text not null
    );
    CREATE INDEX IF NOT EXISTS idx_ue_project_time on usage_events(project_id, event_at);
    CREATE INDEX IF NOT EXISTS idx_ue_user_time on usage_events(user_id, event_at);
    CREATE INDEX IF NOT EXISTS idx_ue_task_time on usage_events(task_id, event_at);
    CREATE INDEX IF NOT EXISTS idx_ue_model_time on usage_events(model_id, event_at);
  `)
}

async function ensureDb(): Promise<Database> {
  if (db) return db
  const SQL = await getSqlStatic()
  const bytes = await idbGetBytes()
  db = bytes ? new SQL.Database(bytes) : new SQL.Database()
  migrate(db)
  return db
}

// ---- Row <-> domain mapping ----------------------------------------------

type Row = Record<string, unknown>

function rowToProject(r: Row): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    color: (r.color as string) ?? "#3b82f6",
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToUser(r: Row): User {
  return {
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string) ?? "",
    avatarUrl: (r.avatar_url as string) ?? "",
    role: (r.role as string) ?? "",
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToModel(r: Row): Model {
  return {
    id: r.id as string,
    provider: r.provider as string,
    name: r.name as string,
    displayName: r.display_name as string,
    inputCostPer1m: Number(r.input_cost_per_1m) || 0,
    outputCostPer1m: Number(r.output_cost_per_1m) || 0,
    cachedInputCostPer1m: Number(r.cached_input_cost_per_1m) || 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToTask(r: Row): Task {
  let tags: string[] = []
  if (typeof r.tags === "string" && r.tags.length > 0) {
    try {
      tags = JSON.parse(r.tags)
    } catch {
      tags = []
    }
  }
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    userId: (r.user_id as string) || undefined,
    title: r.title as string,
    status: r.status as Task["status"],
    tags,
    startedAt: (r.started_at as string) || undefined,
    completedAt: (r.completed_at as string) || undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToEvent(r: Row): UsageEvent {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    userId: (r.user_id as string) || undefined,
    taskId: (r.task_id as string) || undefined,
    modelId: r.model_id as string,
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
    cachedInputTokens: Number(r.cached_input_tokens) || 0,
    totalTokens: Number(r.total_tokens) || 0,
    estimatedCost: Number(r.estimated_cost) || 0,
    eventAt: r.event_at as string,
    createdAt: r.created_at as string,
  }
}

function queryAll<T>(database: Database, table: string): T[] {
  const res = database.exec(`SELECT * FROM ${table}`)
  if (!res[0]) return []
  const { columns, values } = res[0]
  return values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

// ---- Public API -----------------------------------------------------------

// Load the full dataset from SQLite. Returns null when there is no persisted
// data yet (e.g. first run), so the caller can fall back to ingestion.
export async function loadPersisted(): Promise<Store | null> {
  const database = await ensureDb()
  const countRes = database.exec("SELECT COUNT(*) AS c FROM usage_events")
  const count = (countRes[0]?.values[0]?.[0] as number) ?? 0
  if (count === 0) return null
  return {
    projects: queryAll<Row>(database, "projects").map(rowToProject),
    users: queryAll<Row>(database, "users").map(rowToUser),
    models: queryAll<Row>(database, "models").map(rowToModel),
    tasks: queryAll<Row>(database, "tasks").map(rowToTask),
    usageEvents: queryAll<Row>(database, "usage_events").map(rowToEvent),
  }
}

// Replace the persisted dataset. Writes the whole dataset inside a
// transaction, then exports the DB and saves it to IndexedDB so it survives a
// page refresh.
export async function persistStore(store: Store): Promise<void> {
  const database = await ensureDb()
  database.run("BEGIN")
  try {
    for (const table of [
      "usage_events",
      "tasks",
      "models",
      "users",
      "projects",
    ]) {
      database.run(`DELETE FROM ${table}`)
    }

    const insProject = database.prepare(
      `INSERT OR REPLACE INTO projects (id,name,description,color,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    )
    for (const p of store.projects) {
      insProject.run([p.id, p.name, p.description, p.color, p.createdAt, p.updatedAt])
    }
    insProject.free()

    const insUser = database.prepare(
      `INSERT OR REPLACE INTO users (id,name,email,avatar_url,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    )
    for (const u of store.users) {
      insUser.run([u.id, u.name, u.email, u.avatarUrl, u.role, u.createdAt, u.updatedAt])
    }
    insUser.free()

    const insModel = database.prepare(
      `INSERT OR REPLACE INTO models (id,provider,name,display_name,input_cost_per_1m,output_cost_per_1m,cached_input_cost_per_1m,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    for (const m of store.models) {
      insModel.run([
        m.id,
        m.provider,
        m.name,
        m.displayName,
        m.inputCostPer1m,
        m.outputCostPer1m,
        m.cachedInputCostPer1m,
        m.createdAt,
        m.updatedAt,
      ])
    }
    insModel.free()

    const insTask = database.prepare(
      `INSERT OR REPLACE INTO tasks (id,project_id,user_id,title,status,tags,started_at,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    for (const t of store.tasks) {
      insTask.run([
        t.id,
        t.projectId,
        t.userId ?? null,
        t.title,
        t.status,
        JSON.stringify(t.tags ?? []),
        t.startedAt ?? null,
        t.completedAt ?? null,
        t.createdAt,
        t.updatedAt,
      ])
    }
    insTask.free()

    const insEv = database.prepare(
      `INSERT OR REPLACE INTO usage_events (id,project_id,user_id,task_id,model_id,input_tokens,output_tokens,cached_input_tokens,total_tokens,estimated_cost,event_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    for (const e of store.usageEvents) {
      insEv.run([
        e.id,
        e.projectId,
        e.userId ?? null,
        e.taskId ?? null,
        e.modelId,
        e.inputTokens,
        e.outputTokens,
        e.cachedInputTokens,
        e.totalTokens,
        e.estimatedCost,
        e.eventAt,
        e.createdAt,
      ])
    }
    insEv.free()

    database.run("COMMIT")
  } catch (err) {
    database.run("ROLLBACK")
    throw err
  }
  const bytes = database.export()
  await idbSetBytes(bytes)
}

// Remove all persisted data (used by the Settings "clear local data" action).
export async function clearPersisted(): Promise<void> {
  const database = await ensureDb()
  for (const table of [
    "usage_events",
    "tasks",
    "models",
    "users",
    "projects",
  ]) {
    database.run(`DELETE FROM ${table}`)
  }
  const bytes = database.export()
  await idbSetBytes(bytes)
}
