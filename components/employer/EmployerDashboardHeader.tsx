import EmployerWorkspaceNav from '@/components/employer/EmployerWorkspaceNav'
import type { ReactNode } from 'react'

type InternshipOption = {
  id: string
  title: string
}

type Props = {
  title: string
  description: string
  internships: InternshipOption[]
  selectedInternshipId?: string
  includeAllOption?: boolean
  rightSlot?: ReactNode
}

export default function EmployerDashboardHeader(props: Props) {
  return (
    <div className="mb-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{props.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{props.description}</p>
      </div>
      <EmployerWorkspaceNav
        selectedInternshipId={props.selectedInternshipId}
        internships={props.internships}
        includeAllOption={props.includeAllOption}
        rightSlot={props.rightSlot}
      />
    </div>
  )
}
