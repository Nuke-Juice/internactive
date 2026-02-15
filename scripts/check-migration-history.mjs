#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const execFileAsync = promisify(execFile)
const ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

function parseEnvFile(raw) {
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function loadEnvFromDotLocal() {
  try {
    const raw = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8')
    const parsed = parseEnvFile(raw)
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // ignore
  }
}

async function getLocalVersions() {
  const files = await fs.readdir(MIGRATIONS_DIR)
  return Array.from(
    new Set(
      files
    .map((file) => {
      const match = file.match(/^(\d{14})_/) || file.match(/^(\d{8,14})_/) 
      return match ? match[1] : null
    })
    .filter((v) => v !== null)
    )
  ).sort()
}

async function getRemoteVersionsViaDb() {
  await loadEnvFromDotLocal()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    return { ok: false, reason: 'missing_env', versions: [] }
  }

  try {
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'supabase_migrations' },
    })

    const { data, error } = await admin.from('schema_migrations').select('version')
    if (error) return { ok: false, reason: `db_error:${error.message}`, versions: [] }

    const versions = (data ?? [])
      .map((row) => String(row.version ?? '').trim())
      .filter(Boolean)
      .sort()
    return { ok: true, reason: 'db', versions }
  } catch (error) {
    return { ok: false, reason: `db_exception:${error instanceof Error ? error.message : String(error)}`, versions: [] }
  }
}

async function getRemoteVersionsViaCli() {
  try {
    const { stdout } = await execFileAsync('supabase', ['migration', 'list'])
    const versions = Array.from(new Set((stdout.match(/\b\d{8,14}\b/g) ?? []).filter(Boolean))).sort()
    return { ok: true, reason: 'cli', versions, raw: stdout }
  } catch (error) {
    return {
      ok: false,
      reason: `cli_error:${error instanceof Error ? error.message : String(error)}`,
      versions: [],
      raw: '',
    }
  }
}

async function main() {
  const localVersions = await getLocalVersions()

  let remote = await getRemoteVersionsViaDb()
  if (!remote.ok) {
    const cli = await getRemoteVersionsViaCli()
    remote = { ok: cli.ok, reason: cli.reason, versions: cli.versions }
  }

  const localSet = new Set(localVersions)
  const remoteSet = new Set(remote.versions)

  const missingLocal = remote.versions.filter((v) => !localSet.has(v))
  const localOnly = localVersions.filter((v) => !remoteSet.has(v))

  console.log('=== Migration History Check ===')
  console.log(`local_count=${localVersions.length}`)
  console.log(`remote_count=${remote.versions.length}`)
  console.log(`remote_source=${remote.reason}`)

  console.log('\n-- Remote versions missing locally --')
  if (missingLocal.length === 0) console.log('none')
  else missingLocal.forEach((v) => console.log(v))

  console.log('\n-- Local versions not found remotely --')
  if (localOnly.length === 0) console.log('none')
  else localOnly.forEach((v) => console.log(v))

  process.exitCode = missingLocal.length > 0 ? 2 : 0
}

await main()
