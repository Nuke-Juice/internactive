import { permanentRedirect } from 'next/navigation'

export default async function LegacyStudentDashboardPage() {
  permanentRedirect('/student/dashboard')
}
