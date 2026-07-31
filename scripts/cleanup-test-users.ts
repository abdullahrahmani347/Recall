import { db } from '../src/lib/db'
async function main() {
  // Delete the brandnew user and all their data
  const deleted = await db.user.deleteMany({ where: { email: 'brandnew@recall.app' } })
  console.log(`Deleted ${deleted.count} test users`)
}
main().catch(console.error).finally(() => process.exit(0))
