import initSqlJs from 'sql.js'
import { readFile } from 'fs/promises'

async function main() {
  const SQL = await initSqlJs({ wasmBinary: await readFile('node_modules/sql.js/dist/sql-wasm.wasm') })
  const buf = await readFile('/tmp/apkg-test/collection.anki21')
  const db = new SQL.Database(buf)
  
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
  console.log('Tables:', tables[0]?.values?.map(v => v[0]))
  
  const cardCount = db.exec('SELECT count(*) FROM cards')
  console.log('Cards:', cardCount[0]?.values?.[0]?.[0])
  
  const noteCount = db.exec('SELECT count(*) FROM notes')
  console.log('Notes:', noteCount[0]?.values?.[0]?.[0])
  
  const sampleCard = db.exec('SELECT flds FROM notes LIMIT 3')
  console.log('Sample notes:')
  for (const row of sampleCard[0]?.values ?? []) {
    console.log('  ', String(row[0]).slice(0, 100))
  }
  
  db.close()
}
main().catch(console.error).finally(() => process.exit(0))
