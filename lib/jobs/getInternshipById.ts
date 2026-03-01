import { getEmployerVerificationTier } from '@/lib/billing/subscriptions'
import {
  canViewerAccessInternship,
  type InternshipViewerContext,
  type InternshipViewerRole,
} from '@/lib/jobs/internshipAccess'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

export type InternshipDetailAccess = 'visible' | 'not_found' | 'not_authorized'

export type InternshipDetailListing = {
  id: string
  employer_id: string | null
  employer_verification_tier?: string | null
  is_active: boolean | null
  status: string | null
  application_deadline: string | null
  visibility?: string | null
  [key: string]: unknown
}

export type GetInternshipByIdResult = {
  access: InternshipDetailAccess
  listing: InternshipDetailListing | null
}

const DETAIL_SELECT_RICH_COLUMNS = [
  'id',
  'title',
  'company_name',
  'employer_id',
  'employer_verification_tier',
  'location',
  'location_city',
  'location_state',
  'location_lat',
  'location_lng',
  'experience_level',
  'target_student_year',
  'desired_coursework_strength',
  'majors',
  'target_graduation_years',
  'short_summary',
  'description',
  'description_raw',
  'responsibilities',
  'qualifications',
  'requirements_details',
  'compliance_details',
  'source_metadata',
  'employment_type',
  'internship_types',
  'work_authorization_scope',
  'hours_per_week',
  'hours_min',
  'hours_max',
  'role_category',
  'work_mode',
  'term',
  'start_date',
  'apply_mode',
  'ats_stage_mode',
  'external_apply_url',
  'required_skills',
  'preferred_skills',
  'recommended_coursework',
  'pay_min',
  'pay_max',
  'compensation_currency',
  'compensation_interval',
  'compensation_is_estimated',
  'bonus_eligible',
  'compensation_notes',
  'remote_eligibility_scope',
  'remote_eligible_states',
  'application_deadline',
  'application_cap',
  'applications_count',
  'resume_required',
  'restrict_by_major',
  'restrict_by_year',
  'is_active',
  'status',
  'visibility',
  'internship_required_skill_items(skill_id)',
  'internship_preferred_skill_items(skill_id)',
  'internship_skill_requirements(importance, canonical_skill_id, custom_skill_id, custom_skill:custom_skills(name))',
  'internship_required_course_categories(category_id, category:canonical_course_categories(name, slug))',
  'internship_coursework_items(coursework_item_id)',
  'internship_coursework_category_links(category_id, category:coursework_categories(name))',
] as const

const DETAIL_SELECT_RICH_LEGACY_COLUMNS = [
  'id',
  'title',
  'company_name',
  'employer_id',
  'employer_verification_tier',
  'location',
  'location_city',
  'location_state',
  'location_lat',
  'location_lng',
  'experience_level',
  'target_student_year',
  'desired_coursework_strength',
  'majors',
  'target_graduation_years',
  'short_summary',
  'description',
  'description_raw',
  'responsibilities',
  'qualifications',
  'requirements_details',
  'compliance_details',
  'source_metadata',
  'employment_type',
  'internship_types',
  'work_authorization_scope',
  'hours_per_week',
  'hours_min',
  'hours_max',
  'role_category',
  'work_mode',
  'term',
  'start_date',
  'apply_mode',
  'ats_stage_mode',
  'external_apply_url',
  'required_skills',
  'preferred_skills',
  'recommended_coursework',
  'pay_min',
  'pay_max',
  'compensation_currency',
  'compensation_interval',
  'compensation_is_estimated',
  'bonus_eligible',
  'compensation_notes',
  'remote_eligibility_scope',
  'remote_eligible_states',
  'application_deadline',
  'application_cap',
  'applications_count',
  'resume_required',
  'restrict_by_major',
  'restrict_by_year',
  'is_active',
  'status',
  'visibility',
  'internship_required_skill_items(skill_id)',
  'internship_preferred_skill_items(skill_id)',
  'internship_required_course_categories(category_id, category:canonical_course_categories(name, slug))',
  'internship_coursework_items(coursework_item_id)',
  'internship_coursework_category_links(category_id, category:coursework_categories(name))',
] as const

const DETAIL_SELECT_BASE_COLUMNS = [
  'id',
  'title',
  'company_name',
  'employer_id',
  'employer_verification_tier',
  'location',
  'location_city',
  'location_state',
  'location_lat',
  'location_lng',
  'experience_level',
  'target_student_year',
  'desired_coursework_strength',
  'majors',
  'target_graduation_years',
  'short_summary',
  'description',
  'description_raw',
  'responsibilities',
  'qualifications',
  'requirements_details',
  'compliance_details',
  'source_metadata',
  'employment_type',
  'internship_types',
  'work_authorization_scope',
  'hours_per_week',
  'hours_min',
  'hours_max',
  'role_category',
  'work_mode',
  'term',
  'start_date',
  'apply_mode',
  'ats_stage_mode',
  'external_apply_url',
  'required_skills',
  'preferred_skills',
  'recommended_coursework',
  'pay_min',
  'pay_max',
  'compensation_currency',
  'compensation_interval',
  'compensation_is_estimated',
  'bonus_eligible',
  'compensation_notes',
  'remote_eligibility_scope',
  'remote_eligible_states',
  'application_deadline',
  'application_cap',
  'applications_count',
  'resume_required',
  'restrict_by_major',
  'restrict_by_year',
  'is_active',
  'status',
  'visibility',
] as const

type MinimalListingRow = Pick<InternshipDetailListing, 'id' | 'employer_id' | 'is_active' | 'status' | 'application_deadline' | 'visibility'>

function isMissingColumnError(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    (normalized.includes("could not find the '") && normalized.includes("' column"))
  )
}

function extractMissingColumnName(message: string | null | undefined) {
  if (!message) return null
  const lower = message.toLowerCase()
  const match = lower.match(/column\s+[\w."]*?([a-z_][a-z0-9_]*)\s+does not exist/)
  if (match?.[1]) return match[1]
  const schemaCacheMatch = lower.match(/could not find the ['"]([a-z_][a-z0-9_]*)['"] column/)
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1]
  return null
}

function withDefaultRelations(row: InternshipDetailListing): InternshipDetailListing {
  return {
    ...row,
    internship_required_skill_items: Array.isArray(row.internship_required_skill_items)
      ? row.internship_required_skill_items
      : [],
    internship_preferred_skill_items: Array.isArray(row.internship_preferred_skill_items)
      ? row.internship_preferred_skill_items
      : [],
    internship_skill_requirements: Array.isArray(row.internship_skill_requirements)
      ? row.internship_skill_requirements
      : [],
    internship_required_course_categories: Array.isArray(row.internship_required_course_categories)
      ? row.internship_required_course_categories
      : [],
    internship_coursework_items: Array.isArray(row.internship_coursework_items)
      ? row.internship_coursework_items
      : [],
    internship_coursework_category_links: Array.isArray(row.internship_coursework_category_links)
      ? row.internship_coursework_category_links
      : [],
  }
}

async function queryListingById(params: {
  client: Awaited<ReturnType<typeof supabaseServer>> | ReturnType<typeof supabaseAdmin>
  id: string
  columns: readonly string[]
}) {
  let selectedColumns = [...params.columns]
  const minimumColumns = 12

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await params.client
      .from('internships')
      .select(selectedColumns.join(', '))
      .eq('id', params.id)
      .maybeSingle()

    if (!error) {
      return { data: data as InternshipDetailListing | null, error: null as { message: string } | null }
    }

    const missingColumn = extractMissingColumnName(error.message)
    if (missingColumn && selectedColumns.includes(missingColumn) && selectedColumns.length > minimumColumns) {
      selectedColumns = selectedColumns.filter((column) => column !== missingColumn)
      continue
    }

    return { data: null, error: { message: error.message } }
  }

  return { data: null, error: { message: 'schema fallback exhausted' } }
}

async function fetchListingByIdWithFallback(params: {
  client: Awaited<ReturnType<typeof supabaseServer>> | ReturnType<typeof supabaseAdmin>
  id: string
}) {
  const rich = await queryListingById({
    client: params.client,
    id: params.id,
    columns: DETAIL_SELECT_RICH_COLUMNS,
  })
  if (!rich.error) return rich.data ? withDefaultRelations(rich.data) : null

  const missingSkillRelationship =
    rich.error.message.includes("Could not find a relationship between 'internships' and 'internship_skill_requirements'") ||
    rich.error.message.toLowerCase().includes('internship_skill_requirements')

  if (missingSkillRelationship) {
    const legacy = await queryListingById({
      client: params.client,
      id: params.id,
      columns: DETAIL_SELECT_RICH_LEGACY_COLUMNS,
    })
    if (!legacy.error) return legacy.data ? withDefaultRelations(legacy.data) : null
  }

  const base = await queryListingById({
    client: params.client,
    id: params.id,
    columns: DETAIL_SELECT_BASE_COLUMNS,
  })
  if (!base.error) return base.data ? withDefaultRelations(base.data) : null

  if (isMissingColumnError(rich.error.message) || isMissingColumnError(base.error.message)) {
    console.warn('[jobs] getInternshipById schema mismatch', {
      id: params.id,
      richError: rich.error.message,
      baseError: base.error.message,
    })
  } else {
    console.error('[jobs] getInternshipById query failed', {
      id: params.id,
      richError: rich.error.message,
      baseError: base.error.message,
    })
  }
  return null
}

export async function getInternshipById(
  id: string,
  viewer: InternshipViewerContext
): Promise<GetInternshipByIdResult> {
  const supabase = await supabaseServer()
  const shouldUseAdminClient = viewer.viewerRole === 'admin' && hasSupabaseAdminCredentials()
  const primaryClient = shouldUseAdminClient ? supabaseAdmin() : supabase
  let listing = await fetchListingByIdWithFallback({ client: primaryClient, id })

  if (!listing && hasSupabaseAdminCredentials()) {
    const admin = supabaseAdmin()
    const { data: existsRow } = await admin
      .from('internships')
      .select('id, employer_id, is_active, status, application_deadline, visibility')
      .eq('id', id)
      .maybeSingle()
    const minimal = (existsRow ?? null) as MinimalListingRow | null
    if (!minimal) {
      return { access: 'not_found', listing: null }
    }
    if (!canViewerAccessInternship({ row: minimal, viewer })) {
      return { access: 'not_authorized', listing: null }
    }

    listing = await fetchListingByIdWithFallback({ client: admin, id })
    if (!listing) {
      return { access: 'not_found', listing: null }
    }
  }

  if (!listing) {
    return { access: 'not_found', listing: null }
  }

  if (!canViewerAccessInternship({ row: listing, viewer })) {
    return { access: 'not_authorized', listing: null }
  }

  if (listing.employer_id) {
    const tier = await getEmployerVerificationTier({
      supabase,
      userId: listing.employer_id,
    })
    listing = {
      ...listing,
      employer_verification_tier: tier,
    }
  }

  return { access: 'visible', listing }
}
