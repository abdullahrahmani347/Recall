// Delete all notes with empty title AND empty body for the test user.
// Run with: bun run /home/z/my-project/scripts/cleanup-empty-notes.ts
import { db } from '../src/lib/db'

async function main() {
  // Delete notes that have a title but empty body — these are the duplicates
  // created by the autosave bug before the fix.
  const deleted = await db.note.deleteMany({
    where: {
      contentMarkdown: '',
      contentPlainText: '',
    },
  })
  console.log(`Deleted ${deleted.count} empty notes`)

  const remaining = await db.note.count()
  console.log(`Remaining notes: ${remaining}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
