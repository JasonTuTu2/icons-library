import { useEffect, useId, useRef, useState } from 'react'

interface NoteToggleFieldProps {
  value: string
  onChange: (note: string) => void
  ariaLabel: string
  disabled?: boolean
  /** Compact single-line for upload / Figma rows. */
  variant?: 'compact'
  /** Called when the field should persist (blur / Enter). */
  onCommit?: () => void
  className?: string
}

/**
 * Small Note button that reveals the note input only when opened.
 * Auto-opens when the value already has content.
 */
export function NoteToggleField({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  onCommit,
  className,
}: NoteToggleFieldProps) {
  const inputId = useId()
  const hasNote = value.trim().length > 0
  const [open, setOpen] = useState(hasNote)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (hasNote) setOpen(true)
  }, [hasNote])

  useEffect(() => {
    if (!open || disabled) return
    const el = inputRef.current
    if (!el) return
    if (!hasNote) el.focus()
  }, [open, disabled, hasNote])

  return (
    <div
      className={[
        'note-toggle',
        'note-toggle-compact',
        open ? 'is-open' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={[
          'note-toggle-btn',
          hasNote ? 'has-note' : '',
          open ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-expanded={open}
        aria-controls={inputId}
        disabled={disabled}
        title={hasNote ? 'Edit Note' : 'Add Note'}
        onClick={() => setOpen((prev) => !prev)}
      >
        Note{hasNote ? ' ·' : ''}
      </button>
      {open ? (
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="asset-note-input"
          placeholder="Note…"
          maxLength={500}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onCommit?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit?.()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      ) : null}
    </div>
  )
}
