import { db } from '../src/lib/db'
async function main() {
  const d = await db.user.deleteMany({ where: { email: 'onbtest@recall.app' } })
  console.log(`Deleted ${d.count} users`)
}
main().catch(console.error).finally(() => process.exit(0))
