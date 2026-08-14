import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/privacy/data-map
 *
 * Returns a comprehensive map of all user data stored in the system.
 * Shows what data is stored, where, and when it was last updated.
 * This powers the "Your Data" privacy dashboard.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const [
    notes, notebooks, tags, decks, cards, reviewLogs,
    articles, highlights, comments, summaries, attachments,
    embeddings, onboarding, settings,
  ] = await Promise.all([
    db.note.count({ where: { userId: user!.id } }),
    db.notebook.count({ where: { userId: user!.id } }),
    db.tag.count({ where: { userId: user!.id } }),
    db.deck.count({ where: { userId: user!.id } }),
    db.flashcard.count({ where: { deck: { userId: user!.id } } }),
    db.reviewLog.count({ where: { userId: user!.id } }),
    db.article.count({ where: { userId: user!.id } }),
    db.highlight.count({ where: { userId: user!.id } }),
    db.comment.count({ where: { userId: user!.id } }),
    db.summary.count({ where: { note: { userId: user!.id } } }),
    db.attachment.count({ where: { note: { userId: user!.id } } }),
    db.embedding.count({ where: { note: { userId: user!.id } } }),
    db.onboarding.count({ where: { userId: user!.id } }),
    db.settings.count({ where: { userId: user!.id } }),
  ])

  // Get user account info
  const userRecord = await db.user.findUnique({
    where: { id: user!.id },
    select: { email: true, name: true, authProvider: true, createdAt: true, avatarUrl: true },
  })

  const dataCategories = [
    {
      category: 'Account',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, encrypted at rest',
      items: [
        { name: 'Email', count: 1, retained: 'Until account deletion' },
        { name: 'Display name', count: userRecord?.name ? 1 : 0, retained: 'Until account deletion' },
        { name: 'Auth provider', count: 1, retained: 'Until account deletion' },
        { name: 'Avatar URL', count: userRecord?.avatarUrl ? 1 : 0, retained: 'Until account deletion' },
      ],
    },
    {
      category: 'Notes & Notebooks',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, encrypted at rest',
      items: [
        { name: 'Notes', count: notes, retained: 'Until you delete them' },
        { name: 'Notebooks', count: notebooks, retained: 'Until you delete them' },
        { name: 'Tags', count: tags, retained: 'Until you delete them' },
        { name: 'Attachments', count: attachments, retained: 'Until note deletion' },
      ],
    },
    {
      category: 'Flashcards & Reviews',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, encrypted at rest',
      items: [
        { name: 'Decks', count: decks, retained: 'Until you delete them' },
        { name: 'Flashcards', count: cards, retained: 'Until you delete them' },
        { name: 'Review logs', count: reviewLogs, retained: 'Indefinitely (for analytics)' },
        { name: 'Scheduling state', count: cards, retained: 'Until card deletion' },
      ],
    },
    {
      category: 'Articles & Highlights',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, encrypted at rest',
      items: [
        { name: 'Articles', count: articles, retained: 'Until you delete them' },
        { name: 'Highlights', count: highlights, retained: 'Until article deletion' },
      ],
    },
    {
      category: 'AI-Generated Content',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, sent to LLM only when you trigger AI features',
      items: [
        { name: 'Summaries', count: summaries, retained: 'Until note deletion' },
        { name: 'Embeddings (TF-IDF vectors)', count: embeddings, retained: 'Until note deletion' },
      ],
    },
    {
      category: 'Collaboration',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side, shared with collaborators',
      items: [
        { name: 'Comments', count: comments, retained: 'Until you delete them' },
      ],
    },
    {
      category: 'Preferences',
      storage: 'PostgreSQL/SQLite database',
      location: 'Server-side',
      items: [
        { name: 'Settings', count: settings, retained: 'Until account deletion' },
        { name: 'Onboarding data', count: onboarding, retained: 'Until account deletion' },
      ],
    },
    {
      category: 'Local Browser Storage',
      storage: 'IndexedDB (Dexie)',
      location: 'Your browser only — not sent to server unless synced',
      items: [
        { name: 'Cached notes (offline)', count: 'Varies', retained: 'Until you clear browser data or log out' },
        { name: 'Sync queue', count: 'Varies', retained: 'Until synced or cleared' },
      ],
    },
    {
      category: 'Cookies',
      storage: 'Browser cookies',
      location: 'Your browser only',
      items: [
        { name: 'Auth tokens (httpOnly)', count: 2, retained: '15 min (access) / 30 days (refresh)' },
      ],
    },
  ]

  return NextResponse.json({
    user: userRecord,
    dataCategories,
    totalItems: notes + notebooks + tags + decks + cards + reviewLogs + articles + highlights + comments + summaries + attachments + embeddings,
    accountCreated: userRecord?.createdAt,
  })
}
