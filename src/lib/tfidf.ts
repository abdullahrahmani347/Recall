/**
 * TF-IDF vectorizer + cosine similarity — powers semantic search and
 * "related notes" in Phase 2.
 *
 * Per §8 of the brief: the production target is pgvector-backed semantic
 * search using a real embeddings API. The z-ai-web-dev-sdk doesn't expose
 * an embeddings endpoint, so for Phase 2 we implement TF-IDF as a
 * lightweight, dependency-free semantic-ish layer. The API contract
 * (Embedding table + cosine similarity) is identical, so swapping in a
 * true embeddings model later is a drop-in replacement.
 *
 * Sparse vectors are stored as { [term]: weight } maps. Cosine similarity
 * on sparse vectors is O(min(|A|, |B|)) — fast enough for a personal
 * note library of thousands of notes.
 */

const STOPWORDS = new Set([
  // English
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'i', 'you', 'we', 'they', 'this', 'these',
  'those', 'but', 'not', 'or', 'if', 'then', 'than', 'so', 'do', 'does',
  'did', 'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',
  'about', 'above', 'after', 'again', 'all', 'also', 'any', 'because',
  'been', 'before', 'being', 'below', 'between', 'both', 'during', 'each',
  'few', 'more', 'most', 'other', 'over', 'same', 'some', 'such', 'through',
  'under', 'until', 'very', 'what', 'when', 'where', 'which', 'while',
  'who', 'whom', 'why', 'how',
  // Markdown / note structural tokens
  'nbsp', 'amp', 'quot', 'apos', 'lt', 'gt', 'md', 'img', 'src', 'href',
])

/**
 * Tokenize text into lowercase word tokens (2–32 chars, alphanumeric + a few
 * CJK-friendly splits). Removes markdown syntax and stopwords.
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  // Strip markdown code blocks and inline code
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    // Strip image syntax but keep alt text
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1')
    // Link syntax: [label](url) → label
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
    // Strip HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Strip markdown punctuation
    .replace(/[#>*_~\-|+=\[\](){}"'`!?.;:,]/g, ' ')
    .toLowerCase()

  // Split on whitespace + CJK boundaries
  const tokens = cleaned
    .split(/[\s\u3000\uff00-\uffef\u4e00-\u9fff]+/)
    .filter(Boolean)

  return tokens.filter((t) => {
    if (t.length < 2 || t.length > 32) return false
    if (STOPWORDS.has(t)) return false
    // Must contain at least one letter or CJK char
    if (!/[a-z\u4e00-\u9fff]/.test(t)) return false
    return true
  })
}

/** Build a term-frequency map from a token list. */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1)
  }
  // Normalize by max term frequency for stability
  const max = Math.max(1, ...tf.values())
  for (const [k, v] of tf) {
    tf.set(k, v / max)
  }
  return tf
}

/**
 * Compute IDF weights from a corpus of tokenized documents.
 * idf(term) = log(N / (1 + df(term)))
 */
export function computeIdf(corpus: string[][]): Map<string, number> {
  const df = new Map<string, number>()
  const N = Math.max(1, corpus.length)
  for (const tokens of corpus) {
    const seen = new Set(tokens)
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    idf.set(term, Math.log(N / (1 + freq)) + 1) // +1 smoothing, never zero
  }
  return idf
}

/**
 * Compute the TF-IDF sparse vector for a document given IDF weights.
 * Returns a { [term]: weight } map.
 */
export function tfidfVector(
  tokens: string[],
  idf: Map<string, number>
): Record<string, number> {
  const tf = termFrequency(tokens)
  const vec: Record<string, number> = {}
  for (const [term, freq] of tf) {
    const weight = idf.get(term)
    if (weight !== undefined && weight > 0) {
      vec[term] = freq * weight
    }
  }
  return vec
}

/** Magnitude of a sparse vector (for cosine normalization). */
export function magnitude(vec: Record<string, number>): number {
  let sum = 0
  for (const k in vec) sum += vec[k] * vec[k]
  return Math.sqrt(sum)
}

/**
 * Cosine similarity between two sparse vectors.
 * O(min(|A|, |B|)) when iterating over the smaller vector.
 */
export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>
): number {
  const magA = magnitude(a)
  const magB = magnitude(b)
  if (magA === 0 || magB === 0) return 0
  // Iterate the smaller vector
  const [small, large] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a]
  let dot = 0
  for (const k in small) {
    const av = small[k]
    const bv = large[k]
    if (bv !== undefined) dot += av * bv
  }
  return dot / (magA * magB)
}

export interface VectorizedDoc {
  noteId: string
  title: string
  vector: Record<string, number>
}

/**
 * Build the full TF-IDF index for a set of notes.
 * Returns IDF weights + vectorized docs.
 */
export function buildIndex(
  notes: { id: string; title: string; contentPlainText: string }[]
): {
  idf: Map<string, number>
  docs: VectorizedDoc[]
} {
  const tokenized = notes.map((n) =>
    tokenize(`${n.title} ${n.contentPlainText}`)
  )
  const idf = computeIdf(tokenized)
  const docs = notes.map((n, i) => ({
    noteId: n.id,
    title: n.title,
    vector: tfidfVector(tokenized[i], idf),
  }))
  return { idf, docs }
}
