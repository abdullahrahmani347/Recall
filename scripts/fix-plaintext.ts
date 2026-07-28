import { db } from '../src/lib/db'

function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const notes = await db.note.findMany()
  let fixed = 0
  for (const n of notes) {
    if (n.contentPlainText === '' && n.contentMarkdown !== '') {
      await db.note.update({
        where: { id: n.id },
        data: { contentPlainText: markdownToPlainText(n.contentMarkdown) },
      })
      fixed++
    }
  }
  console.log(`Fixed ${fixed} notes`)
}
main().catch(console.error).finally(() => process.exit(0))
