import { useState } from 'react'
import type {
  IconSource,
  IconUsage,
  IconVariant,
} from '@JasonTuTu2/github-admin'
import { CategorySelect } from './CategorySelect'
import { VariantSelect } from './VariantSelect'
import { SourceSelect } from './SourceSelect'
import { UsageSelect } from './UsageSelect'

interface ApplyAllFieldsProps {
  categories: string[]
  onCreateCategory: (name: string) => void
  onApplyCategory: (category: string) => void
  onApplyVariant: (variant: IconVariant) => void
  onApplySource: (source: IconSource) => void
  onApplyUsage: (usage: IconUsage) => void
}

export function ApplyAllFields({
  categories,
  onCreateCategory,
  onApplyCategory,
  onApplyVariant,
  onApplySource,
  onApplyUsage,
}: ApplyAllFieldsProps) {
  const [category, setCategory] = useState('')
  const [variant, setVariant] = useState<IconVariant>('regular')
  const [source, setSource] = useState<IconSource>('custom')
  const [usage, setUsage] = useState<IconUsage>('in-use')

  return (
    <div className="apply-all-fields">
      <span className="apply-all-label">Apply to all</span>
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
