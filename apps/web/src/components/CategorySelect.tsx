import { useId, useState } from 'react'

const CREATE_VALUE = '__create__'

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
  const createInputId = useId()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

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
  }

  return (
    <div className="category-select-wrap">
      <select
        className={className}
        aria-label={ariaLabel}
        value={creating ? CREATE_VALUE : value}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">No category</option>
        {categories.map((category) => (
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

interface ApplyAllCategoryProps {
  categories: string[]
  onCreateCategory: (name: string) => void
  onApplyAll: (category: string) => void
}

export function ApplyAllCategory({
  categories,
  onCreateCategory,
  onApplyAll,
}: ApplyAllCategoryProps) {
  const [value, setValue] = useState('')

  return (
    <div className="apply-all-category">
      <span className="apply-all-label">Apply category to all</span>
      <CategorySelect
        value={value}
        onChange={(category) => {
          setValue(category)
          onApplyAll(category)
        }}
        categories={categories}
        onCreateCategory={(name) => {
          onCreateCategory(name)
          setValue(name)
          onApplyAll(name)
        }}
        ariaLabel="Apply category to all pending assets"
      />
    </div>
  )
}

export function categoryLabel(category: string | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed || 'No category'
}
