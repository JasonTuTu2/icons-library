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

export type ApplyAllAssetFormat = 'svg' | 'png' | 'jpg'

interface ApplyAllFieldsProps {
  categories: string[]
  onCreateCategory: (name: string) => void
  onApplyCategory: (category: string) => void
  onApplyVariant: (variant: IconVariant) => void
  onApplySource: (source: IconSource) => void
  onApplyUsage: (usage: IconUsage) => void
  /** When set, shows SVG / PNG / JPG and applies to the whole batch. */
  onApplyFormat?: (format: ApplyAllAssetFormat) => void
  /** Shown when format is SVG; applies Mono / Multi / Gradient to all. */
  onApplyColorMode?: (colorMode: IconColorMode) => void
  formatDisabled?: boolean
}

export function ApplyAllFields({
  categories,
  onCreateCategory,
  onApplyCategory,
  onApplyVariant,
  onApplySource,
  onApplyUsage,
  onApplyFormat,
  onApplyColorMode,
  formatDisabled = false,
}: ApplyAllFieldsProps) {
  const [category, setCategory] = useState('')
  const [variant, setVariant] = useState<IconVariant>('regular')
  const [source, setSource] = useState<IconSource>('custom')
  const [usage, setUsage] = useState<IconUsage>('in-use')
  const [format, setFormat] = useState<ApplyAllAssetFormat | ''>('')
  const [colorMode, setColorMode] = useState<IconColorMode>('mono')

  return (
    <div className="apply-all-fields">
      <span className="apply-all-label">Apply to all</span>
      {onApplyFormat ? (
        <select
          className="apply-all-format"
          aria-label="Apply export format to all pending assets"
          value={format}
          disabled={formatDisabled}
          onChange={(e) => {
            const value = e.target.value
            if (value !== 'svg' && value !== 'png' && value !== 'jpg') return
            setFormat(value)
            onApplyFormat(value)
          }}
        >
          <option value="" disabled>
            Format…
          </option>
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      ) : null}
      {onApplyFormat && onApplyColorMode && format === 'svg' ? (
        <select
          className="apply-all-color-mode"
          aria-label="Apply color mode to all SVG assets"
          value={colorMode}
          disabled={formatDisabled}
          onChange={(e) => {
            const next =
              e.target.value === 'preserved'
                ? 'preserved'
                : e.target.value === 'gradient'
                  ? 'gradient'
                  : 'mono'
            setColorMode(next)
            onApplyColorMode(next)
          }}
        >
          <option value="mono">Mono</option>
          <option value="preserved">Multi</option>
          <option value="gradient">Gradient</option>
        </select>
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
        ariaLabel="Apply category to all pending assets"
      />
      <VariantSelect
        value={variant}
        onChange={(next) => {
          setVariant(next)
          onApplyVariant(next)
        }}
        ariaLabel="Apply variant to all pending assets"
      />
      <SourceSelect
        value={source}
        onChange={(next) => {
          setSource(next)
          onApplySource(next)
        }}
        ariaLabel="Apply source to all pending assets"
      />
      <UsageSelect
        value={usage}
        onChange={(next) => {
          setUsage(next)
          onApplyUsage(next)
        }}
        ariaLabel="Apply usage to all pending assets"
      />
    </div>
  )
}
