"use client"

interface ProgressRingProps {
  value: number
  target: number
  size?: number
}

export function ProgressRing({ value, target, size = 170 }: ProgressRingProps) {
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = target > 0 ? Math.min(value / target, 1) : 0
  const over = target > 0 && value > target
  const remaining = Math.max(target - value, 0)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={over ? "text-destructive transition-all duration-700" : "text-primary transition-all duration-700"}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <span className="text-3xl font-semibold tabular-nums">{Math.round(value)}</span>
        <span className="text-xs text-muted-foreground">из {Math.round(target)} ккал</span>
        <span className={`text-xs font-medium ${over ? "text-destructive" : "text-primary"}`}>
          {over ? `+${Math.round(value - target)} сверх` : `осталось ${Math.round(remaining)}`}
        </span>
      </div>
    </div>
  )
}
