import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon } from './Icon'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string | null
  hint?: ReactNode
}

/** Ô nhập có nhãn, gợi ý và thông báo lỗi gắn với input (đọc được bằng trình đọc màn hình) */
export function TextField({ label, error, hint, className = '', ...input }: FieldProps) {
  const id = useId()
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-text placeholder:text-muted focus:outline-none disabled:opacity-60 ${
          error ? 'border-danger' : 'border-border focus:border-primary'
        }`}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextAreaProps {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  maxLength?: number
  placeholder?: string
  error?: string | null
  hint?: ReactNode
  /** Hiện bộ đếm ký tự "đã nhập/tối đa" */
  counter?: boolean
}

/** Ô nhập nhiều dòng: nhãn, gợi ý, lỗi gắn bằng aria-describedby (không lẫn vào tên của ô) */
export function TextAreaField({ label, value, onChange, rows = 4, maxLength, placeholder, error, hint, counter }: TextAreaProps) {
  const id = useId()
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted focus:outline-none disabled:opacity-60 ${
          error ? 'border-danger' : 'border-border focus:border-primary'
        }`}
      />
      <div className="mt-1 flex justify-between gap-3 text-xs">
        {error ? (
          <p id={`${id}-error`} className="font-medium text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-muted">
            {hint}
          </p>
        ) : (
          <span />
        )}
        {counter && maxLength && (
          <span className="shrink-0 tabular-nums text-muted">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  )
}

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-danger/40 bg-danger/10 text-text',
    success: 'border-success/40 bg-success/10 text-text',
    info: 'border-border bg-surface-2 text-text',
  }
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${styles[kind]}`}>
      <Icon
        name={kind === 'success' ? 'check' : 'info'}
        size={18}
        className={`mt-px shrink-0 ${kind === 'error' ? 'text-danger' : kind === 'success' ? 'text-success' : 'text-muted'}`}
      />
      <div>{children}</div>
    </div>
  )
}

/** Khung chung cho các trang đăng nhập / đăng ký / quên mật khẩu */
export function AuthCard({ title, subtitle, children, logo }: { title: string; subtitle?: ReactNode; children: ReactNode; logo: ReactNode }) {
  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-10">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-pop sm:p-8">
        <div className="flex justify-center">{logo}</div>
        <h1 className="mt-6 text-center text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
