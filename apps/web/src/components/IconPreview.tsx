import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { Icon } from '@JasonTuTu2/icons-react'
import { customImagePublicUrl } from '../lib/customImageUrl'

export function IconPreview({
  icon,
  size = 28,
}: {
  icon: IconMeta
  size?: number
}) {
  if (icon.assetKind === 'image' && icon.assetPath) {
    return (
      <img
        className="icon-cell-image"
        src={customImagePublicUrl(icon.assetPath)}
        alt=""
        width={size}
        height={size}
      />
    )
  }
  return <Icon name={icon.id} size={size} decorative />
}
