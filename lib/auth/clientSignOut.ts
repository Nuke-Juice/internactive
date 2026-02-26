'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

type RouterLike = {
  replace: (href: string) => void
  refresh: () => void
}

const LOCAL_STORAGE_KEY_PATTERNS = [
  /^internup:apply:returnTo$/,
  /^onboarding:(student|employer):details:/,
  /^internactive:listingDraft:/,
  /^employer_create_internship:/,
  /^dismiss_upgrade_best_match:/,
  /^dismiss_ats_defaults_banner:/,
]

const SESSION_STORAGE_KEY_PATTERNS = [
  /^verify-warning-shown:/,
  /^internup:apply:returnTo$/,
]

function clearMatchingKeys(storage: Storage, patterns: RegExp[]) {
  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) continue
    if (patterns.some((pattern) => pattern.test(key))) {
      keysToRemove.push(key)
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key)
  }
}

async function clearBrowserCaches() {
  if (typeof window === 'undefined') return
  if (!('caches' in window)) return
  try {
    const keys = await window.caches.keys()
    await Promise.all(keys.map((key) => window.caches.delete(key)))
  } catch {
    // Ignore cache clear failures and continue logout flow.
  }
}

function clearClientAuthArtifacts() {
  if (typeof window === 'undefined') return
  try {
    clearMatchingKeys(window.localStorage, LOCAL_STORAGE_KEY_PATTERNS)
  } catch {
    // Ignore localStorage failures.
  }
  try {
    clearMatchingKeys(window.sessionStorage, SESSION_STORAGE_KEY_PATTERNS)
  } catch {
    // Ignore sessionStorage failures.
  }
}

export async function signOutAndResetClientView(input: {
  supabase: SupabaseClient
  router: RouterLike
  redirectTo?: string
}) {
  const redirectTo = input.redirectTo ?? '/'
  const { error } = await input.supabase.auth.signOut()
  if (error) return { error }
  clearClientAuthArtifacts()
  await clearBrowserCaches()
  input.router.replace(redirectTo)
  input.router.refresh()
  return { error }
}
