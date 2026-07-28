import { db } from '../src/lib/db'

async function main() {
  // Find all notes and show their content
  const notes = await db.note.findMany({
    select: { id: true, title: true, contentMarkdown: true, contentPlainText: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  
  // Group by title + content signature
  const groups = new Map<string, string[]>()
  for (const n of notes) {
    const sig = `${n.title}|||${n.contentMarkdown.slice(0, 50)}`
    const arr = groups.get(sig) ?? []
    arr.push(n.id)
    groups.set(sig, arr)
  }
  
  // Delete all but the first of each duplicate group
  const toDelete: string[] = []
  for (const [sig, ids] of groups) {
    if (ids.length > 1) {
      // Keep the first, delete the rest
      toDelete.push(...ids.slice(1))
    }
  }
  
  if (toDelete.length > 0) {
    await db.note.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${toDelete.length} duplicate notes`)
  }
  
  // Also delete notes with empty content
  const emptyDeleted = await db.note.deleteMany({
    where: {
      OR: [
        { contentMarkdown: '' },
        { contentPlainText: '' },
      ],
    },
  })
  console.log(`Deleted ${emptyDeleted.count} empty notes`)
  
  const remaining = await db.note.count()
  console.log(`Remaining notes: ${remaining}`)
  
  const finalNotes = await db.note.findMany({
    select: { title: true, contentMarkdown: true },
  })
  console.log('Final notes:')
  for (const n of finalNotes) {
    console.log(`  - ${n.title} (${n.contentMarkdown.length} chars)`)
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
