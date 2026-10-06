import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  Ellipsis,
  Flag,
  Folder,
  HelpCircle,
  Info,
  List,
  Minus,
  Moon,
  PanelRight,
  Plus,
  Search,
  Settings,
  Square,
  Sun,
  Trash2,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'
const icons = {
  back: ArrowLeft,
  next: ArrowRight,
  book: BookOpen,
  check: Check,
  chevron: ChevronDown,
  right: ChevronRight,
  clock: Clock,
  copy: Copy,
  edit: Edit3,
  more: Ellipsis,
  flag: Flag,
  folder: Folder,
  help: HelpCircle,
  info: Info,
  list: List,
  minimize: Minus,
  moon: Moon,
  note: PanelRight,
  plus: Plus,
  search: Search,
  settings: Settings,
  maximize: Square,
  sun: Sun,
  trash: Trash2,
  stats: TrendingUp,
  close: X,
} satisfies Record<string, LucideIcon>
export function Icon({ name, className = '' }: { name: keyof typeof icons; className?: string }) {
  const Component = icons[name]
  return <Component className={`icon ${className}`} aria-hidden="true" strokeWidth={1.6} />
}
export function Keycap({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}
export function Button({
  variant = 'secondary',
  loading = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`button button-${variant} ${className}`}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
export function IconButton({
  name,
  label,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  name: keyof typeof icons
  label: string
}) {
  return (
    <Button
      variant="ghost"
      {...props}
      className={`icon-button ${props.className ?? ''}`}
      aria-label={label}
      title={label}
    >
      <Icon name={name} />
    </Button>
  )
}
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'new' | 'learning' | 'due' | 'danger'
}) {
  return <span className={`chip tone-${tone}`}>{children}</span>
}
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange(value: T): void
  options: readonly { value: T; label: string }[]
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? 'selected' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
export function Pill({
  selected,
  children,
  onClick,
}: {
  selected: boolean
  children: ReactNode
  onClick(): void
}) {
  return (
    <button
      type="button"
      className={`pill ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
export function MemoryMeter({ value }: { value: number | null }) {
  return (
    <span
      className="memory-meter"
      aria-label={value === null ? 'Sin estimación' : `Memoria: ${Math.round(value * 100)}%`}
    >
      <span className="meter-track">
        <span style={{ width: `${(value ?? 0) * 100}%` }} />
      </span>
      <span>{value === null ? '—' : `${Math.round(value * 100)}%`}</span>
    </span>
  )
}
export function DifficultyDots({ value }: { value: number }) {
  return (
    <span className="difficulty" aria-label={`Dificultad ${value} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < value ? 'filled' : ''} />
      ))}
    </span>
  )
}
export function Counts({
  counts,
  large = false,
  active,
}: {
  counts: { new: number; learning: number; due: number }
  large?: boolean
  active?: number
}) {
  return (
    <div className={`counts ${large ? 'counts-large' : ''}`}>
      {[
        { key: 'new', label: 'Nuevas', state: 0 },
        { key: 'learning', label: 'Aprendiendo', state: 1 },
        { key: 'due', label: 'Por repasar', state: 2 },
      ].map(({ key, label, state }) => (
        <span
          key={key}
          className={`count count-${key} ${counts[key as keyof typeof counts] === 0 ? 'zero' : ''} ${active === state || (active === 3 && state === 1) ? 'current' : ''}`}
        >
          <strong>{counts[key as keyof typeof counts]}</strong>
          <span>{label}</span>
        </span>
      ))}
    </div>
  )
}
export function ProgressLine({ value, total }: { value: number; total: number }) {
  return (
    <div
      className="progress-line"
      role="progressbar"
      aria-label="Progreso"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <span style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
  sheet = false,
  wide = false,
  footer,
}: {
  title: string
  children: ReactNode
  onClose(): void
  sheet?: boolean
  wide?: boolean
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId()
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${sheet ? 'sheet' : ''} ${wide ? 'modal-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        close.current()
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const bounds = ref.current!.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close.current()
        }
      }}
    >
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <IconButton name="close" label="Cerrar" onClick={onClose} />
      </header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </dialog>
  )
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-glyph">
        <Icon name="folder" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="button-row">{action}</div>
    </div>
  )
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'notice-error' : ''}`}>
      {children}
    </div>
  )
}
export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string
  description?: string
  action?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="button-row">{action}</div>}
    </header>
  )
}
export function Skeleton() {
  return <span className="skeleton" aria-hidden="true" />
}
export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="property-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  )
}
export function VerdictLine({
  verdict,
  reason,
}: {
  verdict: 'fail' | 'partial' | 'pass'
  reason: string
}) {
  return (
    <div className={`verdict-line verdict-${verdict}`}>
      <strong>
        <Icon name={verdict === 'pass' ? 'check' : verdict === 'partial' ? 'info' : 'close'} />
        {verdict === 'pass' ? 'Correcto' : verdict === 'partial' ? 'Casi' : 'Incorrecto'}
      </strong>
      <p>{reason}</p>
    </div>
  )
}
export function RatingGroup({
  selected,
  intervals,
  onRate,
}: {
  selected?: number
  intervals: readonly string[]
  onRate(rating: number): void
}) {
  return (
    <div className="rating-group">
      {['Otra vez', 'Difícil', 'Bien', 'Fácil'].map((label, i) => (
        <button
          key={label}
          type="button"
          className={`rating rating-${i + 1} ${selected === i + 1 ? 'selected' : ''}`}
          aria-pressed={selected === i + 1}
          onClick={() => onRate(i + 1)}
        >
          <span>
            {label}
            <Keycap>{i + 1}</Keycap>
          </span>
          <small>{intervals[i]}</small>
        </button>
      ))}
    </div>
  )
}
