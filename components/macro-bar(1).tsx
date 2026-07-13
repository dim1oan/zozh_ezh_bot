"use client"

interface MacroBarProps {
  label: string
  value: number
  target: number
  colorClass: string
}

export function MacroBar({ label, value, target, colorClass }: MacroBarProps) {
  const ratio = target > 0 ? Math.min(value / target, 1) : 0
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">
          {Math.round(value)}
          <span className="text-muted-foreground">/{Math.round(target)}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
