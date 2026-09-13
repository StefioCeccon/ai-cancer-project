export interface GroupableFile {
  clientId: string;
  fileName?: string;
  file?: { name: string };
}

function getFileName(entry: GroupableFile): string {
  return entry.fileName ?? entry.file?.name ?? entry.clientId;
}

const PAGE_SUFFIX_PATTERN = /[_\-\s.(]*(page|pg|p|sheet|foglio|pag)[_\-\s.)]*\d+$/i;

/** True when the filename ends with a recognised page suffix (-1, -2, page1, page2, …). */
export function hasPageSuffix(name: string): boolean {
  const base = name.replace(/\.[^.]+$/, "");
  if (/-\d{1,3}$/.test(base)) return true;
  return PAGE_SUFFIX_PATTERN.test(base);
}

/** Strip extension and page suffixes to get the shared document root. */
export function normalizeFileStem(name: string): string {
  let stem = name.replace(/\.[^.]+$/, "");
  stem = stem.replace(PAGE_SUFFIX_PATTERN, "");
  stem = stem.replace(/-\d{1,3}$/, "");
  return stem.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isImageFileName(name: string): boolean {
  return /\.(jpe?g|png|webp|heic)$/i.test(name);
}

function extractExplicitPageOrder(name: string): number {
  const base = name.replace(/\.[^.]+$/, "");
  const pageMatch = base.match(/(?:page|pg|p|sheet|foglio|pag)[_\-\s.)]*(\d+)$/i);
  if (pageMatch) return parseInt(pageMatch[1], 10);
  const dashMatch = base.match(/-(\d{1,3})$/);
  if (dashMatch) return parseInt(dashMatch[1], 10);
  return 0;
}

/** Multi-page only when every file shares the same root and has a page suffix (-1, page2, …). */
export function isMultiPageFileGroup(files: GroupableFile[]): boolean {
  if (files.length < 2) return false;
  if (!files.every((f) => hasPageSuffix(getFileName(f)))) return false;
  const root = normalizeFileStem(getFileName(files[0]));
  if (!root) return false;
  return files.every((f) => normalizeFileStem(getFileName(f)) === root);
}

/** Extract page order from filename for sorting multi-page documents. */
export function extractPageOrder(name: string): number {
  return extractExplicitPageOrder(name);
}

export function sortFilesByPage<T extends GroupableFile>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const orderDiff = extractPageOrder(getFileName(a)) - extractPageOrder(getFileName(b));
    if (orderDiff !== 0) return orderDiff;
    return getFileName(a).localeCompare(getFileName(b));
  });
}

function metadataKey(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").toLowerCase().trim())
    .filter(Boolean)
    .join("|");
}

export function autoGroupFiles<T extends GroupableFile>(
  files: T[],
  metaKey: (file: T) => string | null
): T[][] {
  if (files.length === 0) return [];

  const merged: T[][] = [];
  const stemGroups = new Map<string, T[]>();
  for (const file of files) {
    if (!hasPageSuffix(getFileName(file))) continue;
    const stem = normalizeFileStem(getFileName(file)) || file.clientId;
    const list = stemGroups.get(stem) ?? [];
    list.push(file);
    stemGroups.set(stem, list);
  }

  const used = new Set<string>();

  for (const group of stemGroups.values()) {
    const sorted = sortFilesByPage(group);
    if (isMultiPageFileGroup(sorted)) {
      sorted.forEach((f) => used.add(f.clientId));
      merged.push(sorted);
    }
  }

  const singletons = files.filter((f) => !used.has(f.clientId));
  const metaGroups = new Map<string, T[]>();
  for (const file of singletons) {
    const key = metaKey(file);
    if (!key) {
      merged.push([file]);
      continue;
    }
    const list = metaGroups.get(key) ?? [];
    list.push(file);
    metaGroups.set(key, list);
  }

  for (const group of metaGroups.values()) {
    merged.push(sortFilesByPage(group));
  }

  return merged;
}

export function combineTexts(texts: (string | undefined | null)[], separator = "\n\n---\n\n"): string {
  return texts.filter((t) => t?.trim()).join(separator);
}

export { metadataKey };
