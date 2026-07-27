export interface ApiNote {
  id: string
  userId: string
  notebookId: string | null
  title: string
  contentMarkdown: string
  contentPlainText: string
  isArchived: boolean
  isPinned: boolean
  createdAt: string
  updatedAt: string
  tags: ApiTag[]
  notebook?: ApiNotebook | null
  summaries?: ApiSummary[]
}

export interface ApiTag {
  id: string
  userId: string
  name: string
  color: string
  createdAt: string
}

export interface ApiNotebook {
  id: string
  userId: string
  name: string
  color: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiSummary {
  id: string
  noteId: string
  summaryText: string
  modelUsed: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ApiDeck {
  id: string
  userId: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
  _count?: { flashcards: number }
  dueCount?: number
}

export interface ApiFlashcard {
  id: string
  deckId: string
  sourceNoteId: string | null
  cardType: string
  front: string
  back: string
  createdAt: string
  updatedAt: string
  schedulingState?: ApiSchedulingState | null
}

export interface ApiSchedulingState {
  cardId: string
  dueDate: string
  stability: number
  difficulty: number
  interval: number
  repetitions: number
  lapses: number
  lastReviewedAt: string | null
}

export interface ApiReviewLog {
  id: string
  cardId: string
  userId: string
  reviewedAt: string
  grade: string
  previousInterval: number
  newInterval: number
  responseTimeMs: number
}

export interface ApiUser {
  id: string
  email: string
  name: string | null
  settings?: ApiSettings
}

export interface ApiSettings {
  theme: string
  reducedMotion: boolean
  dailyNewCardLimit: number
  dailyReviewLimit: number
  timezone: string
  aiProcessingOptOut: boolean
}

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface ApiSearchResult {
  notes: ApiNote[]
  cards: ApiFlashcard[]
}
