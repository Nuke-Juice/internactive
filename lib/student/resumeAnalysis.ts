import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { isResumeStoragePathOwnedByUser } from '@/lib/student/resumeStorageOwnership'

type AnalyzeResult = {
  text: string
  score: number
  metrics: Record<string, unknown>
  suggestions: string[]
  keywords: string[]
}

const ACTION_VERBS = [
  'led',
  'built',
  'developed',
  'designed',
  'implemented',
  'analyzed',
  'managed',
  'created',
  'improved',
  'optimized',
  'launched',
  'delivered',
  'collaborated',
  'initiated',
  'automated',
  'streamlined',
] as const

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'not',
  'but',
  'into',
  'about',
  'over',
  'than',
  'then',
  'also',
  'using',
  'used',
  'use',
  'our',
  'their',
  'his',
  'her',
  'its',
  'them',
  'they',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
  'through',
  'across',
  'within',
  'work',
  'worked',
  'working',
  'experience',
  'education',
  'skills',
  'project',
  'projects',
  'team',
  'student',
  'university',
  'internship',
])

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function tokenizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function extractTopTerms(text: string, limit = 12) {
  const frequencies = new Map<string, number>()
  for (const token of tokenizeWords(text)) {
    if (token.length < 3) continue
    if (/^\d+$/.test(token)) continue
    if (STOPWORDS.has(token)) continue
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
  }

  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }))
}

function buildSuggestions(metrics: {
  hasEducation: boolean
  hasExperience: boolean
  hasSkills: boolean
  bulletCount: number
  quantifiedBulletCount: number
  numericTokenCount: number
  actionVerbCount: number
  wordCount: number
  topKeywordsCount: number
}) {
  const suggestions: string[] = []

  if (!metrics.hasEducation) suggestions.push('Add an Education section with degree, school, and expected graduation date.')
  if (!metrics.hasExperience) suggestions.push('Add an Experience section highlighting internships, projects, or part-time work.')
  if (!metrics.hasSkills) suggestions.push('Add a Skills section with technical tools and role-relevant capabilities.')
  if (metrics.bulletCount < 6) suggestions.push('Use more concise bullet points under each experience entry to improve scanability.')
  if (metrics.quantifiedBulletCount < 3) suggestions.push('Add measurable outcomes to more bullets (percentages, volume, or time saved).')
  if (metrics.actionVerbCount < 8) suggestions.push('Start bullets with stronger action verbs to make accomplishments clearer.')
  if (metrics.numericTokenCount < 5) suggestions.push('Include more concrete numbers to show scope and impact.')
  if (metrics.topKeywordsCount < 8) suggestions.push('Include more role-specific terms from target internship descriptions.')
  if (metrics.wordCount < 250) suggestions.push('Add relevant detail so recruiters can understand context and impact.')
  if (metrics.wordCount > 900) suggestions.push('Trim repetitive content and keep the resume focused on high-signal evidence.')

  suggestions.push('Prioritize your most relevant projects and outcomes near the top of the page.')
  suggestions.push('Tailor your summary and skills ordering to the internship category you are targeting.')

  return Array.from(new Set(suggestions)).slice(0, 10)
}

function analyzeExtractedText(text: string): AnalyzeResult {
  const normalized = normalizeWhitespace(text)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const words = normalized.split(/\s+/).filter(Boolean)
  const lower = normalized.toLowerCase()

  const hasEducation = /\beducation\b/i.test(lower)
  const hasExperience = /\bexperience\b/i.test(lower) || /\binternship\b/i.test(lower)
  const hasSkills = /\bskills\b/i.test(lower)
  const bulletLines = lines.filter((line) => /^([\-•*]|\d+\.)\s+/.test(line))
  const bulletCount = bulletLines.length
  const quantifiedBulletCount = bulletLines.filter((line) => /\d/.test(line)).length
  const numericTokenCount = (normalized.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length
  const actionVerbCount = ACTION_VERBS.reduce((count, verb) => count + (lower.match(new RegExp(`\\b${verb}\\b`, 'g')) ?? []).length, 0)
  const wordCount = words.length
  const lineCount = lines.length
  const topKeywords = extractTopTerms(normalized, 12)
  const keywordTerms = topKeywords.map((item) => item.term)

  const scoring = {
    sections: (hasEducation ? 10 : 0) + (hasExperience ? 15 : 0) + (hasSkills ? 10 : 0),
    structure: Math.min(15, bulletCount * 2) + Math.min(10, lineCount >= 20 ? 10 : Math.floor(lineCount / 2)),
    quantifiedImpact: Math.min(15, quantifiedBulletCount * 4) + Math.min(10, Math.floor(numericTokenCount / 2)),
    actionLanguage: Math.min(10, Math.floor(actionVerbCount * 1.2)),
    keywordCoverage: Math.min(15, topKeywords.length),
    lengthBalance: wordCount >= 300 && wordCount <= 800 ? 15 : wordCount >= 220 && wordCount <= 950 ? 10 : 0,
  }

  const score = clampScore(
    scoring.sections +
      scoring.structure +
      scoring.quantifiedImpact +
      scoring.actionLanguage +
      scoring.keywordCoverage +
      scoring.lengthBalance
  )

  const metrics = {
    sections_detected: {
      education: hasEducation,
      experience: hasExperience,
      skills: hasSkills,
    },
    bullet_count: bulletCount,
    line_count: lineCount,
    word_count: wordCount,
    quantification_numeric_tokens: numericTokenCount,
    quantified_bullet_count: quantifiedBulletCount,
    action_verbs_count: actionVerbCount,
    top_keywords: topKeywords,
    scoring_breakdown: scoring,
    score_rubric: {
      sections: '0-35',
      structure: '0-25',
      quantified_impact: '0-25',
      action_language: '0-10',
      keyword_coverage: '0-15',
      length_balance: '0-15',
      total_capped: '0-100',
    },
  }

  return {
    text: normalized,
    score,
    metrics,
    suggestions: buildSuggestions({
      hasEducation,
      hasExperience,
      hasSkills,
      bulletCount,
      quantifiedBulletCount,
      numericTokenCount,
      actionVerbCount,
      wordCount,
      topKeywordsCount: topKeywords.length,
    }),
    keywords: keywordTerms,
  }
}

async function extractPdfTextFromBuffer(bytes: Buffer) {
  const mod = await import('pdf-parse')
  const parser =
    (mod as { default?: (buffer: Buffer) => Promise<{ text?: string }> }).default ??
    (mod as unknown as (buffer: Buffer) => Promise<{ text?: string }>)
  const parsed = await parser(bytes)
  return typeof parsed?.text === 'string' ? parsed.text : ''
}

async function markAnalysisFailed(params: { userId: string; analysisRowId: string; message: string }) {
  const supabase = supabaseAdmin()
  const { userId, analysisRowId, message } = params

  await supabase
    .from('student_resume_analysis')
    .update({
      extraction_status: 'failed',
      analysis_status: 'failed',
      suggestions: ['We could not analyze this PDF yet. Try exporting your resume as a standard text-based PDF and upload again.'],
      metrics: { error: message },
    })
    .eq('id', analysisRowId)
    .eq('user_id', userId)
}

async function runAnalysisForFile(params: { userId: string; storagePath: string; analysisRowId: string; resumeFileId: string }) {
  const { userId, storagePath, analysisRowId, resumeFileId } = params
  const supabase = supabaseAdmin()

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from('resumes').download(storagePath)
    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? 'Could not download resume from storage')
    }

    const bytes = Buffer.from(await fileBlob.arrayBuffer())
    const extractedText = await extractPdfTextFromBuffer(bytes)
    const normalizedText = normalizeWhitespace(extractedText)
    if (!normalizedText) {
      throw new Error('Could not extract text from this PDF')
    }

    const analysis = analyzeExtractedText(normalizedText)

    await supabase
      .from('student_resume_analysis')
      .update({
        user_id: userId,
        resume_file_id: resumeFileId,
        extracted_text: analysis.text,
        extraction_status: 'ok',
        analysis_status: 'ok',
        resume_score: analysis.score,
        metrics: analysis.metrics,
        suggestions: analysis.suggestions,
        keywords: analysis.keywords,
      })
      .eq('id', analysisRowId)
      .eq('user_id', userId)

    return { ok: true as const, analysisRowId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume analysis failed'
    await markAnalysisFailed({ userId, analysisRowId, message })
    return { ok: false as const, error: message }
  }
}

export async function analyzeResumeFromStorage(params: { user_id: string; resume_file_id: string }) {
  const supabase = supabaseAdmin()
  const userId = params.user_id
  const resumeFileId = params.resume_file_id

  const { data: resumeFile, error: resumeFileError } = await supabase
    .from('student_resume_files')
    .select('id, storage_path')
    .eq('id', resumeFileId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; storage_path: string }>()

  if (resumeFileError || !resumeFile) {
    return { ok: false as const, error: resumeFileError?.message ?? 'Resume file not found' }
  }

  const { data: pendingAnalysis } = await supabase
    .from('student_resume_analysis')
    .insert({
      user_id: userId,
      resume_file_id: resumeFileId,
      extraction_status: 'pending',
      analysis_status: 'pending',
    })
    .select('id')
    .single<{ id: string }>()

  if (!pendingAnalysis?.id) {
    return { ok: false as const, error: 'Could not create analysis row' }
  }

  return runAnalysisForFile({
    userId,
    storagePath: resumeFile.storage_path,
    analysisRowId: pendingAnalysis.id,
    resumeFileId,
  })
}

export async function registerResumeUploadAndAnalyze(params: {
  userId: string
  storagePath: string
  originalFilename: string | null
  mimeType: string | null
  fileSize: number | null
}) {
  const supabase = supabaseAdmin()
  const { userId, storagePath, originalFilename, mimeType, fileSize } = params
  if (!isResumeStoragePathOwnedByUser(userId, storagePath)) {
    return { ok: false as const, error: 'Invalid resume storage path' }
  }

  await supabase
    .from('student_resume_files')
    .update({ latest_version: false })
    .eq('user_id', userId)
    .eq('latest_version', true)

  const { data: fileRow, error: fileInsertError } = await supabase
    .from('student_resume_files')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: fileSize,
      latest_version: true,
    })
    .select('id')
    .single<{ id: string }>()

  if (fileInsertError || !fileRow?.id) {
    return { ok: false as const, error: fileInsertError?.message ?? 'Could not register resume file' }
  }

  const analysisResult = await analyzeResumeFromStorage({
    user_id: userId,
    resume_file_id: fileRow.id,
  })
  if (!analysisResult.ok) {
    return { ok: false as const, error: analysisResult.error, resumeFileId: fileRow.id }
  }

  return { ok: true as const, resumeFileId: fileRow.id, analysisRowId: analysisResult.analysisRowId }
}
