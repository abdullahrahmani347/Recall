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
  // Phase 2: reminders
  reminderTime: string | null
  reminderEmailEnabled: boolean
  reminderEmail: string | null
}

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface ApiSearchResult {
  notes: ApiNote[]
  cards: ApiFlashcard[]
}

// Phase 2 types

export interface SuggestedCard {
  front: string
  back: string
}

export interface SemanticSearchResult {
  id: string
  title: string
  contentPlainText: string
  updatedAt: string
  score: number
  tags: ApiTag[]
}

export interface RelatedNote {
  id: string
  title: string
  contentPlainText: string
  updatedAt: string
  score: number
  tags: ApiTag[]
}

export interface DayBucket {
  date: string
  reviewed: number
  correct: number
  again: number
  newCards: number
}

export interface GradeDistribution {
  again: number
  hard: number
  good: number
  easy: number
}

export interface DeckStat {
  id: string
  name: string
  color: string
  totalCards: number
  dueCards: number
  matureCards: number
  youngCards: number
}

export interface Analytics {
  range: string
  days: number
  dailyBuckets: DayBucket[]
  retentionRate: number
  totalReviews: number
  gradeDistribution: GradeDistribution
  streak: number
  avgResponseTimeMs: number
  deckStats: DeckStat[]
}

// Phase 3 types

export interface ApiCollaborator {
  id: string
  notebookId: string
  userId: string
  name: string | null
  email: string
  role: 'editor' | 'viewer'
  createdAt: string
}

export interface ApiComment {
  id: string
  noteId: string
  userId: string
  userName: string | null
  body: string
  anchorText: string | null
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export interface PresenceUser {
  userId: string
  name: string
  color: string
  cursor: { line: number; col: number } | null
}

export interface ApiOnboarding {
  completed: boolean
  studyGoal: string | null
  experienceLevel: string | null
  interests: string[]
  dailyGoalMinutes: number
}
