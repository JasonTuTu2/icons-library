import { useState } from 'react'
import type {
  IconColorMode,
  IconSource,
  IconUsage,
  IconVariant,
} from '@JasonTuTu2/github-admin'
import { CategorySelect } from './CategorySelect'
import { VariantSelect } from './VariantSelect'
import { SourceSelect } from './SourceSelect'
import { UsageSelect } from './UsageSelect'
import { NoteToggleField } from './NoteToggleField'
import { DropdownCombobox } from './DropdownCombobox'

export type ApplyAllAssetFormat = 'svg' | 'png' | 'jpg'

interface ApplyAllFieldsProps {
  categories: string[]
  onCreateCategory: (name: string) => void
  onApplyCategory: (category: string) => void
  onApplyVariant: (variant: IconVariant) => void
  onApplySource: (source: IconSource) => void
  onApplyUsage: (usage: IconUsage) => void
  /** Applies a free-form note to all pending assets. */
  onApplyNote?: (note: string) => void
  /** When set, shows SVG / PNG / JPG and applies to the whole batch. */
  onApplyFormat?: (format: ApplyAllAssetFormat) => void
  /** Shown when format is SVG; applies Mono / Multi / Gradient to all. */
  onApplyColorMode?: (colorMode: IconColorMode) => void
  formatDisabled?: boolean
  /** Optional UI labels (plugin i18n). Defaults stay English. */
  labels?: {
    applyToAll?: string
    formatPlaceholder?: string
    colorPlaceholder?: string
    ariaApplyFormat?: string
    ariaApplyColor?: string
    ariaApplyCategory?: string
    ariaApplyVariant?: string
    ariaApplySource?: string
    ariaApplyUsage?: string
    ariaApplyNote?: string
    note?: string
    notePlaceholder?: string
    addNote?: string
    editNote?: string
  }
}

export function ApplyAllFields({
  categories,
  onCreateCategory,
  onApplyCategory,
  onApplyVariant,
  onApplySource,
  onApplyUsage,
  onApplyNote,
  onApplyFormat,
  onApplyColorMode,
  formatDisabled = false,
  labels,
}: ApplyAllFieldsProps) {
  const [category, setCategory] = useState('')
  const [variant, setVariant] = useState<IconVariant>('none')
  const [source, setSource] = useState<IconSource>('custom')
  const [usage, setUsage] = useState<IconUsage>('in-use')
  const [note, setNote] = useState('')
  const [format, setFormat] = useState<ApplyAllAssetFormat | ''>('')
  const [colorMode, setColorMode] = useState<IconColorMode>('mono')

  return (
    <div className="apply-all-fields">
      <span className="apply-all-label">
        {labels?.applyToAll ?? 'Apply to All'}
      </span>
      {onApplyFormat ? (
        <DropdownCombobox
          className="apply-all-format"
          ariaLabel={
            labels?.ariaApplyFormat ??
            'Apply export format to all pending assets'
          }
          value={format}
          disabled={formatDisabled}
          searchable
          placeholder={labels?.formatPlaceholder ?? 'Format…'}
          displayValue={(v) =>
            v === 'svg' || v === 'png' || v === 'jpg'
              ? v.toUpperCase()
              : (labels?.formatPlaceholder ?? 'Format…')
          }
          options={[
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
          ]}
          onChange={(value) => {
            if (value !== 'svg' && value !== 'png' && value !== 'jpg') return
            setFormat(value)
            onApplyFormat(value)
          }}
        />
      ) : null}
      {onApplyFormat && onApplyColorMode && format === 'svg' ? (
        <DropdownCombobox
          className="apply-all-color-mode"
          ariaLabel={
            labels?.ariaApplyColor ?? 'Apply color mode to all SVG assets'
          }
          value={colorMode}
          disabled={formatDisabled}
          searchable
          placeholder={labels?.colorPlaceholder ?? 'Color…'}
          displayValue={(v) => {
            if (v === 'preserved') return 'Multi'
            if (v === 'gradient') return 'Gradient'
            return 'Mono'
          }}
          options={[
            { value: 'mono', label: 'Mono' },
            { value: 'preserved', label: 'Multi' },
            { value: 'gradient', label: 'Gradient' },
          ]}
          onChange={(value) => {
            const next =
              value === 'preserved'
                ? 'preserved'
                : value === 'gradient'
                  ? 'gradient'
                  : 'mono'
            setColorMode(next)
            onApplyColorMode(next)
          }}
        />
      ) : null}
      <CategorySelect
        value={category}
        onChange={(next) => {
          setCategory(next)
          onApplyCategory(next)
        }}
        categories={categories}
        onCreateCategory={(name) => {
          onCreateCategory(name)
          setCategory(name)
          onApplyCategory(name)
        }}
        ariaLabel={
          labels?.ariaApplyCategory ?? 'Apply category to all pending assets'
        }
      />
      <VariantSelect
        value={variant}
        onChange={(next) => {
          setVariant(next)
          onApplyVariant(next)
        }}
        ariaLabel={
          labels?.ariaApplyVariant ?? 'Apply variant to all pending assets'
        }
      />
      <SourceSelect
        value={source}
        onChange={(next) => {
          setSource(next)
          onApplySource(next)
        }}
        ariaLabel={
          labels?.ariaApplySource ?? 'Apply source to all pending assets'
        }
      />
      <UsageSelect
        value={usage}
        onChange={(next) => {
          setUsage(next)
          onApplyUsage(next)
        }}
        ariaLabel={
          labels?.ariaApplyUsage ?? 'Apply usage to all pending assets'
        }
      />
      {onApplyNote ? (
        <NoteToggleField
          className="apply-all-note-toggle"
          value={note}
          disabled={formatDisabled}
          ariaLabel={
            labels?.ariaApplyNote ?? 'Apply note to all pending assets'
          }
          labels={
            labels
              ? {
                  note: labels.note,
                  placeholder: labels.notePlaceholder,
                  addTitle: labels.addNote,
                  editTitle: labels.editNote,
                }
              : undefined
          }
          onChange={setNote}
          onCommit={() => onApplyNote(note)}
        />
      ) : null}
    </div>
  )
}
