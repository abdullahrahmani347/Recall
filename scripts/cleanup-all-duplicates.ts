// Delete all duplicate/empty notes created by the autosave race condition.
// Keeps only notes that have actual content (non-empty contentMarkdown).
// For notes with the same title, keeps only the most recently updated one.
import { db } from '../src/lib/db'

async function main() {
  // First: delete all notes with empty content
  const emptyDeleted = await db.note.deleteMany({
    where: {
      AND: [
        { contentMarkdown: '' },
        { contentPlainText: '' },
      ],
    },
  })
  console.log(`Deleted ${emptyDeleted.count} empty notes`)

  // Second: for notes with the same title, keep only the most recently updated
  const allNotes = await db.note.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, contentMarkdown: true, updatedAt: true },
  })

  const seenTitles = new Set<string>()
  const toDelete: string[] = []

  for (const note of allNotes) {
    const key = note.title || 'Untitled'
    if (seenTitles.has(key)) {
      // This is a duplicate — mark for deletion
      toDelete.push(note.id)
    } else {
      seenTitles.add(key)
    }
  }

  if (toDelete.length > 0) {
    await db.note.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${toDelete.length} duplicate notes (kept most recent per title)`)
  }

  const remaining = await db.note.count()
  console.log(`Remaining notes: ${remaining}`)

  // Show what's left
  const finalNotes = await db.note.findMany({
    select: { title: true, contentMarkdown: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
  console.log('Final notes:')
  for (const n of finalNotes) {
    console.log(`  - "${n.title}" (${n.contentMarkdown.length} chars, updated ${n.updatedAt.toISOString()})`)
  }
}

main().catch(console.error).finally(() => process.exit(0))
