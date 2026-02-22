'use client'

type MatchScoreCircleButtonProps = {
  value: string
  className: string
  targetId?: string
}

export default function MatchScoreCircleButton({
  value,
  className,
  targetId = 'match-details',
}: MatchScoreCircleButtonProps) {
  return (
    <button
      type="button"
      aria-label="View match details"
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      className={`grid h-24 w-24 cursor-pointer place-items-center rounded-full border-2 transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className}`}
    >
      <span className="text-2xl font-semibold leading-none">{value}</span>
    </button>
  )
}
