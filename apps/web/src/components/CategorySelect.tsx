import { useMemo } from 'react'
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
} from '../lib/categories'
import { DropdownCombobox, type DropdownOption } from './DropdownCombobox'

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
  className = '',
}: CategorySelectProps) {
  const options = useMemo(
    (): DropdownOption[] => [
      { value: '', label: 'No Category' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories],
  )

  return (
    <DropdownCombobox
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={ariaLabel}
      className={`category-dropdown${className ? ` ${className}` : ''}`}
      searchable
      allowCreate
      onCreateOption={onCreateCategory}
      placeholder="Type to find or create…"
      displayValue={(v) => (v.trim() ? v : 'No Category')}
    />
  )
}

interface CategoryFilterSelectProps {
  value: string
  onChange: (value: string) => void
  categories: string[]
}

export function CategoryFilterSelect({
  value,
  onChange,
  categories,
}: CategoryFilterSelectProps) {
  const options = useMemo(
    (): DropdownOption[] => [
      { value: CATEGORY_FILTER_ALL, label: 'All Categories' },
      { value: CATEGORY_FILTER_NONE, label: 'No Category' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories],
  )

  return (
    <DropdownCombobox
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel="Category filter"
      className="category-dropdown"
      searchable
      placeholder="Type to filter categories…"
      displayValue={(v) => {
        if (v === CATEGORY_FILTER_ALL) return 'All Categories'
        if (v === CATEGORY_FILTER_NONE) return 'No Category'
        return v
      }}
    />
  )
}

export function categoryLabel(category: string | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed || 'No Category'
}
