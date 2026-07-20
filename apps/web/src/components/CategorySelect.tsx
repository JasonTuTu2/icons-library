import { useId, useMemo, useState } from 'react'
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  filterCategoriesBySearch,
} from '../lib/categories'

const CREATE_VALUE = '__create__'

interface CategorySelectProps {
  value: string
  onChange: (category: string) => void
  categories: string[]
  onCreateCategory: (name: string) => void
  ariaLabel?: string
  className?: string
}

function visibleCategories(
  categories: string[],
  search: string,
  selectedValue: string,
): string[] {
  const filtered = filterCategoriesBySearch(categories, search)
  if (!selectedValue || filtered.includes(selectedValue)) {
    return filtered
  }
  return [selectedValue, ...filtered]
}

export function CategorySelect({
  value,
  onChange,
  categories,
  onCreateCategory,
  ariaLabel = 'Category',
  className = 'category-select',
}: CategorySelectProps) {
  const createInputId = useId()
  const searchInputId = useId()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')

  const options = useMemo(
    () => visibleCategories(categories, search, value),
    [categories, search, value],
  )

  function handleSelectChange(next: string) {
    if (next === CREATE_VALUE) {
      setCreating(true)
      setDraft('')
      return
    }
    setCreating(false)
    onChange(next)
  }

  function commitCreate() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onCreateCategory(trimmed)
    onChange(trimmed)
    setCreating(false)
    setDraft('')
    setSearch('')
  }

  return (
    <div className="category-select-wrap">
      <label className="sr-only" htmlFor={searchInputId}>
        Search categories
      </label>
      <input
        id={searchInputId}
        type="search"
        className="category-search-input"
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      <select
        className={className}
        aria-label={ariaLabel}
        value={creating ? CREATE_VALUE : value}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">No category</option>
        {options.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value={CREATE_VALUE}>Create new…</option>
      </select>
      {creating ? (
        <div className="category-create-row">
          <label className="sr-only" htmlFor={createInputId}>
            New category name
          </label>
          <input
            id={createInputId}
            type="text"
            value={draft}
            placeholder="Category name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCreate()
              }
            }}
          />
          <button type="button" className="ghost" onClick={commitCreate}>
            Add
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setCreating(false)
              setDraft('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface CategoryFilterSelectProps {
  value: string
  onChange: (value: string) => void
  categories: string[]
}

/** Toolbar category filter (all / none / one category) with search. */
export function CategoryFilterSelect({
  value,
  onChange,
  categories,
}: CategoryFilterSelectProps) {
  const searchInputId = useId()
  const selectId = useId()
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => filterCategoriesBySearch(categories, search),
    [categories, search],
  )

  const showSelected =
    value !== CATEGORY_FILTER_ALL &&
    value !== CATEGORY_FILTER_NONE &&
    !filtered.includes(value)

  return (
    <div className="category-select-wrap category-filter-wrap">
      <label className="sr-only" htmlFor={searchInputId}>
        Search categories
      </label>
      <input
        id={searchInputId}
        type="search"
        className="category-search-input"
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={CATEGORY_FILTER_ALL}>All categories</option>
        <option value={CATEGORY_FILTER_NONE}>No category</option>
        {showSelected ? (
          <option value={value}>{value}</option>
        ) : null}
        {filtered.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  )
}

export function categoryLabel(category: string | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed || 'No category'
}
