import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  filterCategoriesBySearch,
} from '../lib/categories'

type ComboboxOption = {
  value: string
  label: string
  create?: boolean
}

interface CategoryComboboxProps {
  value: string
  onChange: (value: string) => void
  categories: string[]
  ariaLabel?: string
  className?: string
  /** Extra fixed options before the filtered category list. */
  leadingOptions?: ComboboxOption[]
  /** Label shown in the closed input for the current value. */
  displayValue: (value: string) => string
  /** Offer creating a category from the typed query. */
  allowCreate?: boolean
  onCreateCategory?: (name: string) => void
  placeholder?: string
}

function CategoryCombobox({
  value,
  onChange,
  categories,
  ariaLabel = 'Category',
  className = 'category-select',
  leadingOptions = [],
  displayValue,
  allowCreate = false,
  onCreateCategory,
  placeholder = 'Search categories…',
}: CategoryComboboxProps) {
  const listId = useId()
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(
    () => filterCategoriesBySearch(categories, query),
    [categories, query],
  )

  const options = useMemo(() => {
    const trimmed = query.trim()
    const next: ComboboxOption[] = [...leadingOptions]
    for (const category of filtered) {
      next.push({ value: category, label: category })
    }
    if (
      allowCreate &&
      trimmed &&
      !categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      next.push({
        value: trimmed,
        label: `Create “${trimmed}”`,
        create: true,
      })
    }
    return next
  }, [leadingOptions, filtered, allowCreate, query, categories])

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
    setOpen(true)
    setQuery('')
    setHighlight(0)
  }

  function choose(option: ComboboxOption) {
    if (option.create && onCreateCategory) {
      onCreateCategory(option.value)
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
      setHighlight((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[highlight]
      if (option) choose(option)
    }
  }

  const inputValue = open ? query : displayValue(value)

  return (
    <div
      ref={rootRef}
      className={`category-select-wrap category-combobox${open ? ' is-open' : ''}`}
    >
      <input
        id={inputId}
        type="text"
        role="combobox"
        className={`category-combobox-input ${className}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && options[highlight]
            ? `${listId}-opt-${highlight}`
            : undefined
        }
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          if (!open) openList()
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => openList()}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
      />
      {open ? (
        <ul
          id={listId}
          className="category-combobox-list"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.length === 0 ? (
            <li className="category-combobox-empty" role="presentation">
              No matching categories
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={`${option.create ? 'create:' : ''}${option.value}`}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value && !option.create}
                className={`category-combobox-option${
                  index === highlight ? ' is-active' : ''
                }${option.create ? ' is-create' : ''}`}
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

interface CategorySelectProps {
  value: string
  onChange: (category: string) => void
  categories: string[]
  onCreateCategory: (name: string) => void
  ariaLabel?: string
  className?: string
}

export function CategorySelect({
  value,
  onChange,
  categories,
  onCreateCategory,
  ariaLabel = 'Category',
  className = 'category-select',
}: CategorySelectProps) {
  return (
    <CategoryCombobox
      value={value}
      onChange={onChange}
      categories={categories}
      ariaLabel={ariaLabel}
      className={className}
      allowCreate
      onCreateCategory={onCreateCategory}
      leadingOptions={[{ value: '', label: 'No category' }]}
      displayValue={(v) => (v.trim() ? v : 'No category')}
      placeholder="Type to find or create…"
    />
  )
}

interface CategoryFilterSelectProps {
  value: string
  onChange: (value: string) => void
  categories: string[]
}

/** Toolbar category filter (all / none / one category) with typeahead. */
export function CategoryFilterSelect({
  value,
  onChange,
  categories,
}: CategoryFilterSelectProps) {
  return (
    <CategoryCombobox
      value={value}
      onChange={onChange}
      categories={categories}
      ariaLabel="Category filter"
      className="category-select"
      leadingOptions={[
        { value: CATEGORY_FILTER_ALL, label: 'All categories' },
        { value: CATEGORY_FILTER_NONE, label: 'No category' },
      ]}
      displayValue={(v) => {
        if (v === CATEGORY_FILTER_ALL) return 'All categories'
        if (v === CATEGORY_FILTER_NONE) return 'No category'
        return v
      }}
      placeholder="Type to filter categories…"
    />
  )
}

export function categoryLabel(category: string | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed || 'No category'
}
