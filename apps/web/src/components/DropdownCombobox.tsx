import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export type DropdownOption = {
  value: string
  label: string
  create?: boolean
}

interface DropdownComboboxProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  ariaLabel?: string
  className?: string
  /** When true, typing filters the option list. */
  searchable?: boolean
  placeholder?: string
  /** Closed-state label for the current value. */
  displayValue?: (value: string) => string
  /** When searchable, offer creating from a novel typed query. */
  allowCreate?: boolean
  onCreateOption?: (name: string) => void
  disabled?: boolean
}

function filterOptions(
  options: DropdownOption[],
  query: string,
  searchable: boolean,
): DropdownOption[] {
  if (!searchable) return options
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return options
  return options.filter((option) => {
    if (option.create) return true
    const hay = option.label.toLowerCase()
    return words.every((word) => hay.includes(word))
  })
}

function ChevronDownIcon() {
  return (
    <svg
      className="dropdown-combobox-chevron"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Figma-styled dropdown (Web Icon Library “Dropdown menu”).
 * Typeahead when searchable; list stays open while typing.
 */
export function DropdownCombobox({
  value,
  onChange,
  options,
  ariaLabel = 'Select',
  className = '',
  searchable = true,
  placeholder = 'Search…',
  displayValue,
  allowCreate = false,
  onCreateOption,
  disabled = false,
}: DropdownComboboxProps) {
  const listId = useId()
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const visible = useMemo(() => {
    const filtered = filterOptions(options, query, searchable)
    const trimmed = query.trim()
    if (
      allowCreate &&
      searchable &&
      trimmed &&
      !options.some(
        (o) =>
          !o.create &&
          (o.value.toLowerCase() === trimmed.toLowerCase() ||
            o.label.toLowerCase() === trimmed.toLowerCase()),
      )
    ) {
      return [
        ...filtered,
        {
          value: trimmed,
          label: `Create “${trimmed}”`,
          create: true,
        },
      ]
    }
    return filtered
  }, [options, query, searchable, allowCreate])

  const selectedLabel =
    displayValue?.(value) ??
    options.find((o) => o.value === value && !o.create)?.label ??
    value

  useEffect(() => {
    if (!open) return
    setHighlight(0)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function openList() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setHighlight(0)
  }

  function choose(option: DropdownOption) {
    if (option.create && onCreateOption) {
      onCreateOption(option.value)
    }
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault()
        openList()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = visible[highlight]
      if (option) choose(option)
    }
  }

  const inputValue = open && searchable ? query : selectedLabel

  return (
    <div
      ref={rootRef}
      className={`dropdown-combobox${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="dropdown-combobox-trigger">
        <input
          id={inputId}
          type="text"
          role="combobox"
          className="dropdown-combobox-input"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[highlight]
              ? `${listId}-opt-${highlight}`
              : undefined
          }
          placeholder={placeholder}
          value={inputValue}
          readOnly={!searchable || disabled}
          disabled={disabled}
          onChange={(e) => {
            if (!searchable || disabled) return
            if (!open) openList()
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => openList()}
          onClick={() => {
            if (!open) openList()
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <ChevronDownIcon />
      </div>
      {open ? (
        <ul
          id={listId}
          className="dropdown-combobox-list"
          role="listbox"
          aria-label={ariaLabel}
        >
          {visible.length === 0 ? (
            <li className="dropdown-combobox-empty" role="presentation">
              No matches
            </li>
          ) : (
            visible.map((option, index) => (
              <li
                key={`${option.create ? 'create:' : ''}${option.value}:${option.label}`}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value && !option.create}
                className={`dropdown-combobox-option${
                  index === highlight ? ' is-active' : ''
                }${option.create ? ' is-create' : ''}${
                  option.value === value && !option.create ? ' is-selected' : ''
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(option)
                }}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
