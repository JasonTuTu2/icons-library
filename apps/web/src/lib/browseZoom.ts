export const BROWSE_ZOOM_MIN = 0.75
export const BROWSE_ZOOM_MAX = 1.5
export const BROWSE_ZOOM_STEP = 0.125
export const BROWSE_ZOOM_DEFAULT = 1

export function clampBrowseZoom(value: number): number {
  const stepped = Math.round(value / BROWSE_ZOOM_STEP) * BROWSE_ZOOM_STEP
  return Math.min(BROWSE_ZOOM_MAX, Math.max(BROWSE_ZOOM_MIN, stepped))
}

export function zoomOut(current: number): number {
  return clampBrowseZoom(current - BROWSE_ZOOM_STEP)
}

export function zoomIn(current: number): number {
  return clampBrowseZoom(current + BROWSE_ZOOM_STEP)
}
