import { db } from '../src/lib/db'
async function main() {
  const deleted = await db.user.deleteMany({ where: { email: { contains: 'isolated' } } })
  console.log(`Deleted ${deleted.count} isolated users`)
}
main().catch(console.error).finally(() => process.exit(0))
