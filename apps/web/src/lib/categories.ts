import {
  getCustomMetadata,
  isGithubAdminEnabled,
  type CustomIconMetadata,
} from '../lib/github'

export async function loadCategoryRegistry(): Promise<{
  categories: string[]
}> {
  if (isGithubAdminEnabled()) {
    const metadata = await getCustomMetadata()
    return { categories: metadata.categories }
  }

  try {
    const res = await fetch('/__gv/icons/metadata')
    if (!res.ok) return { categories: [] }
    const data = (await res.json()) as CustomIconMetadata
    return { categories: data.categories ?? [] }
  } catch {
    return { categories: [] }
  }
}

export function mergeCategoryIntoRegistry(
  categories: string[],
  category: string,
): string[] {
  const trimmed = category.trim()
  if (!trimmed || categories.includes(trimmed)) return categories
  return [...categories, trimmed].sort((a, b) => a.localeCompare(b))
}

/** Match every whitespace-separated word as a case-insensitive substring. */
export function filterCategoriesBySearch(
  categories: string[],
  query: string,
): string[] {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return categories
  return categories.filter((category) => {
    const hay = category.toLowerCase()
    return words.every((word) => hay.includes(word))
  })
}

/** Browser toolbar: show all categories. */
export const CATEGORY_FILTER_ALL = ''
/** Browser toolbar: icons with no category. */
export const CATEGORY_FILTER_NONE = '__none__'
