import { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export function Card({ title, children, className = '', actions }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-[#e3e9ee] p-4 md:p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-xs font-semibold text-[#5c6f80] uppercase tracking-wider">
              {title}
            </h3>
          )}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

interface KPIGridProps {
  items: Array<{
    label: string
    value: string | number
    variant?: 'default' | 'success' | 'warning' | 'danger'
    trend?: number
  }>
}

export function KPIGrid({ items }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => {
        const colors = {
          default: 'text-[#185FA5]',
          success: 'text-[#15803d]',
          warning: 'text-[#b91c1c]',
          danger: 'text-[#b91c1c]',
        }

        return (
          <Card key={i} title={item.label}>
            <div className="flex items-baseline gap-2">
              <div className={`text-3xl md:text-4xl font-bold ${colors[item.variant || 'default']}`}>
                {item.value}
              </div>
              {item.trend !== undefined && (
                <span className={`text-xs font-semibold ${item.trend > 0 ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
                  {item.trend > 0 ? '+' : ''}{item.trend}%
                </span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning'
  showLabel?: boolean
}

export function ProgressBar({ value, max = 100, variant = 'default', showLabel = true }: ProgressBarProps) {
  const percentage = (value / max) * 100
  const colors = {
    default: 'bg-[#185FA5]',
    success: 'bg-[#15803d]',
    warning: 'bg-[#b91c1c]',
  }

  return (
    <div className="w-full">
      <div className="h-2 bg-[#e3e9ee] rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[variant]} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-[#5c6f80] mt-1 font-medium">{Math.round(percentage)}%</div>
      )}
    </div>
  )
}

interface ChipProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'info'
  size?: 'sm' | 'md'
}

export function Chip({ label, variant = 'default', size = 'md' }: ChipProps) {
  const colors = {
    default: 'bg-[#eef2f6] text-[#5c6f80]',
    success: 'bg-[#e9f7ee] text-[#15803d]',
    warning: 'bg-[#fdecec] text-[#b91c1c]',
    info: 'bg-[#ede9fe] text-[#6d28d9]',
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colors[variant]} ${sizeClasses[size]}`}>
      {label}
    </span>
  )
}
