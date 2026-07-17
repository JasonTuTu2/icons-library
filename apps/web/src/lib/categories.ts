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
