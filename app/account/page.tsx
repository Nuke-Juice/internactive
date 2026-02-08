import Link from 'next/link'
import { redirect } from 'next/navigation'
import EmployerAccount from '@/components/account/EmployerAccount'
import StudentAccount from '@/components/account/StudentAccount'
import { supabaseServer } from '@/lib/supabase/server'

type Role = 'student' | 'employer'

type StudentProfileRow = {
  university_id: string | number | null
  school: string | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  interests: string | null
}

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  location: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  location: string | null
  pay: string | null
  created_at: string | null
}

export default async function AccountPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to manage your student preferences or company internships.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log in
            </Link>
            <Link
              href="/signup/student"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign up as student
            </Link>
            <Link
              href="/signup/employer"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign up as employer
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = userRow?.role as Role | undefined

  async function chooseRole(formData: FormData) {
    'use server'

    const selectedRole = String(formData.get('role') ?? '') as Role
    if (selectedRole !== 'student' && selectedRole !== 'employer') {
      redirect('/account?error=Choose+an+account+type')
    }

    const actionSupabase = await supabaseServer()
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser()

    if (!actionUser) redirect('/login')

    const { error: roleError } = await actionSupabase.from('users').upsert(
      {
        id: actionUser.id,
        role: selectedRole,
        verified: false,
      },
      { onConflict: 'id' }
    )

    if (roleError) {
      redirect(`/account?error=${encodeURIComponent(roleError.message)}`)
    }

    if (selectedRole === 'student') {
      const { error: profileError } = await actionSupabase.from('student_profiles').upsert(
        {
          user_id: actionUser.id,
          school: 'Not set',
          majors: null,
          year: 'Not set',
          coursework: null,
          experience_level: 'none',
          availability_start_month: 'May',
          availability_hours_per_week: 20,
          interests: null,
        },
        { onConflict: 'user_id' }
      )

      if (profileError) redirect(`/account?error=${encodeURIComponent(profileError.message)}`)
    }

    if (selectedRole === 'employer') {
      const { error: profileError } = await actionSupabase.from('employer_profiles').upsert(
        {
          user_id: actionUser.id,
          company_name: null,
          website: null,
          contact_email: actionUser.email ?? null,
          industry: null,
          location: null,
        },
        { onConflict: 'user_id' }
      )

      if (profileError) redirect(`/account?error=${encodeURIComponent(profileError.message)}`)
    }

    redirect('/account?welcome=1')
  }

  if (role !== 'student' && role !== 'employer') {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Choose account type</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pick this once so we can route your account automatically.
          </p>

          <form action={chooseRole} className="mt-6 grid gap-3">
            <button
              type="submit"
              name="role"
              value="student"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Student
            </button>
            <button
              type="submit"
              name="role"
              value="employer"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Employer
            </button>
          </form>
        </div>
      </main>
    )
  }

  if (role === 'student') {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select(
        'university_id, school, majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week, interests'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <StudentAccount userId={user.id} initialProfile={(profile ?? null) as StudentProfileRow | null} />
        </div>
      </main>
    )
  }

  const [{ data: employerProfile }, { data: internships }] = await Promise.all([
    supabase
      .from('employer_profiles')
      .select('company_name, website, contact_email, industry, location')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('internships')
      .select('id, title, location, pay, created_at')
      .eq('employer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <EmployerAccount
          userId={user.id}
          userEmail={user.email ?? null}
          initialProfile={(employerProfile ?? null) as EmployerProfileRow | null}
          recentInternships={(internships ?? []) as InternshipRow[]}
        />
      </div>
    </main>
  )
}
