/**
 * FSRS-4.5 — Free Spaced Repetition Scheduler
 * MIT-licensed algorithm, implemented from public spec.
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki
 *
 * We store per-card: stability, difficulty, interval, repetitions, lapses.
 * On each review we compute the next interval based on the grade.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const GRADE_VALUES: Record<Grade, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
}

// Default FSRS-4.5 parameters (19 weights)
export const DEFAULT_PARAMS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655,
  0.6621,
]

export interface SchedulingState {
  dueDate: Date
  stability: number
  difficulty: number
  interval: number // days
  repetitions: number
  lapses: number
  lastReviewedAt: Date | null
}

export interface ReviewResult {
  state: SchedulingState
  previousInterval: number
  newInterval: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function initStability(params: number[], grade: Grade): number {
  const g = GRADE_VALUES[grade]
  return params[g - 1]
}

function initDifficulty(params: number[], grade: Grade): number {
  const g = GRADE_VALUES[grade]
  const d = params[4] - (g - 3) * params[5]
  return clamp(d, 1, 10)
}

function nextDifficulty(d: number, params: number[], grade: Grade): number {
  const g = GRADE_VALUES[grade]
  const nextD = d - params[5] * (g - 3)
  // Mean reversion toward default 5
  return clamp(params[4] * (1 - params[6]) + nextD * params[6], 1, 10)
}

function nextStabilityAfterFail(d: number, s: number, params: number[]): number {
  return params[11] * Math.pow(d, -params[12]) * (Math.pow(s + 1, params[13]) - 1) * Math.exp(-(1 - params[14]) * s)
}

function nextStabilityAfterRecall(d: number, s: number, r: number, grade: Grade, params: number[]): number {
  const hardPenalty = grade === 'hard' ? params[15] : 1
  const easyBonus = grade === 'easy' ? params[16] : 1
  return s * (1 + Math.exp(params[8]) * (11 - d) * Math.pow(s, -params[9]) * (Math.exp((1 - r) * params[10]) - 1) * hardPenalty * easyBonus)
}

function shortTermStability(s: number, params: number[], grade: Grade): number {
  // When the user fails immediately (lapse within a day), use short-term formula.
  if (grade === 'again') return s * params[17]
  if (grade === 'hard') return s * params[17] * 1.2
  if (grade === 'good') return s * params[18]
  return s * params[18] * 1.2
}

function retrievability(elapsedDays: number, stability: number): number {
  // FSRS power forgetting curve: R = (1 + t/(9*s))^(-1)
  return Math.pow(1 + elapsedDays / (9 * stability), -1)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Compute the next scheduling state given a current state and a grade.
 * If `state` is null, this is the card's first review.
 */
export function review(
  state: SchedulingState | null,
  grade: Grade,
  now: Date = new Date(),
  params: number[] = DEFAULT_PARAMS
): ReviewResult {
  const previousInterval = state?.interval ?? 0

  // First review
  if (!state || state.repetitions === 0) {
    const initS = initStability(params, grade)
    const initD = initDifficulty(params, grade)
    const intervalDays = initS // first interval ≈ stability in days
    const nextDue = new Date(now.getTime() + Math.max(intervalDays, 0.001) * MS_PER_DAY)
    return {
      previousInterval: 0,
      newInterval: intervalDays,
      state: {
        dueDate: nextDue,
        stability: initS,
        difficulty: initD,
        interval: intervalDays,
        repetitions: grade === 'again' ? 0 : 1,
        lapses: grade === 'again' ? 1 : 0,
        lastReviewedAt: now,
      },
    }
  }

  const elapsedDays = Math.max(
    0,
    (now.getTime() - (state.lastReviewedAt ?? now).getTime()) / MS_PER_DAY
  )
  const r = retrievability(elapsedDays, state.stability)

  let newStability: number
  let newDifficulty: number
  let newRepetitions: number
  let newLapses: number

  if (grade === 'again') {
    // Lapse
    newStability = nextStabilityAfterFail(state.difficulty, state.stability, params)
    // Apply short-term correction if elapsed < 1 day
    if (elapsedDays < 1) {
      newStability = shortTermStability(state.stability, params, grade)
    }
    newDifficulty = nextDifficulty(state.difficulty, params, grade)
    newRepetitions = 0
    newLapses = state.lapses + 1
  } else {
    newStability = nextStabilityAfterRecall(state.difficulty, state.stability, r, grade, params)
    if (elapsedDays < 1) {
      newStability = shortTermStability(state.stability, params, grade)
    }
    newDifficulty = nextDifficulty(state.difficulty, params, grade)
    newRepetitions = state.repetitions + 1
    newLapses = state.lapses
  }

  // Compute next interval — round to whole days, minimum 1 day for recalls
  let nextIntervalDays: number
  if (grade === 'again') {
    // Lapsed cards come back soon (10 min in Anki terms → ~0.01 day)
    nextIntervalDays = 0.01
  } else {
    nextIntervalDays = Math.max(1, Math.round(newStability))
  }

  const nextDue = new Date(now.getTime() + nextIntervalDays * MS_PER_DAY)

  return {
    previousInterval,
    newInterval: nextIntervalDays,
    state: {
      dueDate: nextDue,
      stability: newStability,
      difficulty: newDifficulty,
      interval: nextIntervalDays,
      repetitions: newRepetitions,
      lapses: newLapses,
      lastReviewedAt: now,
    },
  }
}

/**
 * Format an interval (in days) as a human-readable string.
 */
export function formatInterval(days: number): string {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60)
    if (minutes < 60) return `${Math.max(1, minutes)}m`
    return `${Math.round(minutes / 60)}h`
  }
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}
