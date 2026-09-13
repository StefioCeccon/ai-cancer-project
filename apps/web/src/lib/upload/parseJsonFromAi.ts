/**
 * Parse JSON from AI model output, tolerating markdown fences, leading/trailing text,
 * and truncated responses (salvages complete array elements when possible).
 */
export function parseJsonFromAi(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Empty AI response");
  }

  const attempts = [
    trimmed,
    extractFencedJson(trimmed),
    sliceOuterObject(trimmed),
    tryRepairTruncatedJson(trimmed),
  ].filter((s): s is string => !!s);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next strategy
    }
  }

  const salvaged = salvageJsonWithArray(trimmed, "symptoms")
    ?? salvageJsonWithArray(trimmed, "therapies")
    ?? salvageJsonWithArray(trimmed, "markers");

  if (salvaged) {
    return salvaged;
  }

  throw new Error(`Invalid JSON from AI: ${trimmed.slice(0, 160)}`);
}

export function isSalvagedPartialJson(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "_partial" in data &&
    (data as { _partial?: boolean })._partial === true
  );
}

function extractFencedJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced?.[1]?.trim() ?? null;
}

function sliceOuterObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return null;
}

/** Close unbalanced brackets/braces when the model output was cut off mid-stream. */
function tryRepairTruncatedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let fragment = text.slice(start);
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (c === "[") brackets++;
    if (c === "]") brackets--;
  }

  if (inString) {
    fragment += '"';
  }

  // Drop incomplete trailing key/value or array element
  fragment = fragment.replace(/,\s*("[^"]*"\s*:\s*)?[^,\[\{}"']*$/, "");
  fragment = fragment.replace(/,\s*$/, "");

  while (brackets > 0) {
    fragment += "]";
    brackets--;
  }
  while (braces > 0) {
    fragment += "}";
    braces--;
  }

  return fragment;
}

function salvageJsonWithArray(text: string, arrayKey: string): Record<string, unknown> | null {
  const keyPattern = new RegExp(`"${arrayKey}"\\s*:\\s*\\[`);
  const match = keyPattern.exec(text);
  if (!match) return null;

  const arrayBodyStart = match.index + match[0].length;
  const objects = extractCompleteJsonObjects(text.slice(arrayBodyStart));
  if (objects.length === 0) return null;

  const sourceTitle = readJsonStringField(text, "sourceTitle");

  return {
    sourceTitle,
    [arrayKey]: objects,
    _partial: true,
  };
}

function readJsonStringField(text: string, field: string): string | null {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!m) {
    if (new RegExp(`"${field}"\\s*:\\s*null`).test(text)) return null;
    return null;
  }
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1];
  }
}

/** Extract every complete {...} object from the start of an array body. */
function extractCompleteJsonObjects(text: string): unknown[] {
  const objects: unknown[] = [];
  let i = 0;

  while (i < text.length) {
    while (i < text.length && text[i] !== "{") i++;
    if (i >= text.length) break;

    const end = findMatchingBrace(text, i);
    if (end < 0) break;

    const slice = text.slice(i, end + 1);
    try {
      objects.push(JSON.parse(slice));
    } catch {
      // skip malformed object
    }
    i = end + 1;
  }

  return objects;
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}
