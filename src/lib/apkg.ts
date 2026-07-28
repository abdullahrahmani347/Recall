/**
 * .apkg (Anki Package) generator — Phase 2 export format.
 *
 * An .apkg file is a ZIP archive containing:
 *   - `media`: a JSON file mapping numeric media IDs to filenames (empty if no media)
 *   - `collection.anki21` (or `.anki2`): a SQLite database with the Anki schema
 *
 * The Anki SQLite schema is documented at:
 *   https://github.com/ankidocs/ankidocs/blob/master/pages/basics/database-structure.md
 *
 * We build a minimal valid collection with:
 *   - `col` table: one row with deck list, model list, and next card IDs
 *   - `notes` table: one row per flashcard front+back (Anki "note" = source data)
 *   - `cards` table: one row per scheduling instance (1 card per note for basic model)
 *   - `revlog` table: empty (we don't export review history to keep .apkg clean)
 *
 * Imported into Anki, the deck appears with all cards as "new" — the user
 * can then review them on Anki's own scheduler. This is the documented
 * interop path; we don't claim Anki endorsement (per §11 of the brief).
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { readFile } from 'fs/promises'
import path from 'path'

let SQL: SqlJsStatic | null = null

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  // Load the wasm from the local node_modules — the CDN approach fails in
  // server environments without outbound network access.
  const wasmPath = path.join(
    process.cwd(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  )
  const wasmBinary = await readFile(wasmPath)
  SQL = await initSqlJs({ wasmBinary })
  return SQL
}

const DECK_ID = 1
const MODEL_ID = 1
const FIELD_SEPARATOR = '\x1f' // Anki's internal field separator

interface ApkgCard {
  front: string
  back: string
  deckName: string
}

/**
 * Build a `collection.anki21` SQLite database from the given cards.
 * Cards are grouped by deckName into separate Anki decks.
 */
async function buildCollection(cards: ApkgCard[]): Promise<Uint8Array> {
  const SQL = await getSql()
  const db = new SQL.Database()

  // Anki schema (minimal but valid for import)
  db.run(`
    CREATE TABLE col (
      id INTEGER PRIMARY KEY,
      crt INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      scm INTEGER NOT NULL,
      ver INTEGER NOT NULL,
      dty INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      ls INTEGER NOT NULL,
      conf TEXT NOT NULL,
      models TEXT NOT NULL,
      decks TEXT NOT NULL,
      dconf TEXT NOT NULL,
      tags TEXT NOT NULL
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY,
      guid TEXT NOT NULL,
      mid INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      tags TEXT NOT NULL,
      flds TEXT NOT NULL,
      sfld TEXT NOT NULL,
      csum INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      nid INTEGER NOT NULL,
      did INTEGER NOT NULL,
      ord INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      type INTEGER NOT NULL,
      queue INTEGER NOT NULL,
      due INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      left INTEGER NOT NULL,
      odue INTEGER NOT NULL,
      odid INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE revlog (
      id INTEGER PRIMARY KEY,
      cid INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      ease INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      lastIvl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      time INTEGER NOT NULL,
      type INTEGER NOT NULL
    );
    CREATE INDEX ix_notes_usn ON notes (usn);
    CREATE INDEX ix_cards_usn ON cards (usn);
    CREATE INDEX ix_cards_nid ON cards (nid);
    CREATE INDEX ix_revlog_usn ON revlog (usn);
    CREATE INDEX ix_revlog_cid ON revlog (cid);
  `)

  // Group cards by deck
  const deckMap = new Map<string, ApkgCard[]>()
  for (const card of cards) {
    const arr = deckMap.get(card.deckName) ?? []
    arr.push(card)
    deckMap.set(card.deckName, arr)
  }

  // Build decks JSON
  const decks: Record<number, {
    id: number
    name: string
    mod: number
    usn: number
    desc: string
    dyn: number
    collapsed: number
    conf: number
    extendNew: number
    extendRev: number
    newToday: [number, number]
    revToday: [number, number]
    lrnToday: [number, number]
    timeToday: [number, number]
  }> = {
    1: {
      id: 1,
      name: 'Default',
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
      desc: '',
      dyn: 0,
      collapsed: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
    },
  }

  let deckIdCounter = 2
  const deckNameToId = new Map<string, number>([['Default', 1]])
  for (const name of deckMap.keys()) {
    if (name === 'Default') continue
    const id = deckIdCounter++
    deckNameToId.set(name, id)
    decks[id] = {
      id,
      name,
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
      desc: '',
      dyn: 0,
      collapsed: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
    }
  }

  // Basic model (front/back)
  const models: Record<number, {
    id: number
    name: string
    type: number
    mod: number
    usn: number
    sortf: number
    did: number
    tmpls: Array<{
      id: number
      name: string
      qfmt: string
      afmt: string
      bqfmt: string
      bafmt: string
      ord: number
      mod: number
      usn: number
    }>
    flds: Array<{
      id: number
      name: string
      ord: number
      sticky: number
      rtl: number
      font: string
      size: number
      media: unknown[]
    }>
    reqs: Array<[number, number, string, number, number]>
    tags: unknown[]
    vers: unknown[]
    css: string
    latexPre: string
    latexPost: string
  }> = {
    1: {
      id: 1,
      name: 'Recall Basic',
      type: 0,
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
      sortf: 0,
      did: 1,
      tmpls: [
        {
          id: 1,
          name: 'Card 1',
          qfmt: '{{Front}}',
          afmt: '{{Front}}<hr id="answer">{{Back}}',
          bqfmt: '',
          bafmt: '',
          ord: 0,
          mod: Math.floor(Date.now() / 1000),
          usn: -1,
        },
      ],
      flds: [
        { id: 1, name: 'Front', ord: 0, sticky: 0, rtl: 0, font: 'Inter', size: 20, media: [] },
        { id: 2, name: 'Back', ord: 1, sticky: 0, rtl: 0, font: 'Inter', size: 20, media: [] },
      ],
      reqs: [[0, 0, 'all', [0, 1], 0]],
      tags: [],
      vers: [],
      css: '.card { font-family: Inter, sans-serif; font-size: 20px; text-align: center; color: #1a1a1a; background-color: #fafafa; } hr { border: 1px solid #e0e0e0; }',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
    },
  }

  // Insert col row
  const nowSec = Math.floor(Date.now() / 1000)
  db.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
     VALUES (1, ?, ?, ?, 18, 0, -1, 0, '{}', ?, ?, '{}', '{}')`,
    [
      nowSec,
      nowSec,
      nowSec,
      JSON.stringify(models),
      JSON.stringify(decks),
    ]
  )

  // Insert notes + cards
  let noteIdCounter = Math.floor(Date.now())
  let cardIdCounter = noteIdCounter + 1
  let cardDueCounter = 1 // new cards get sequential due numbers

  for (const [deckName, deckCards] of deckMap) {
    const did = deckNameToId.get(deckName) ?? 1
    for (const card of deckCards) {
      const noteId = noteIdCounter++
      const cardId = cardIdCounter++

      // Generate a simple guid (hex of noteId)
      const guid = noteId.toString(16).padStart(13, '0').slice(0, 13)

      // Fields: front + separator + back
      const flds = `${card.front}${FIELD_SEPARATOR}${card.back}`

      // Compute a basic checksum (sum of char codes mod 2^31)
      let csum = 0
      for (let i = 0; i < flds.length; i++) {
        csum = (csum + flds.charCodeAt(i)) & 0x7fffffff
      }

      db.run(
        `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
         VALUES (?, ?, 1, ?, -1, '', ?, '', ?, 0, '')`,
        [noteId, guid, nowSec, flds, csum]
      )

      // Card: type=0 (new), queue=0 (new), due=sequential, ivl=0
      db.run(
        `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
         VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
        [cardId, noteId, did, nowSec, cardDueCounter++]
      )
    }
  }

  const bytes = db.export()
  db.close()
  return bytes
}

/**
 * Minimal ZIP archive builder.
 * We can't depend on jszip/fflate being installed, so we implement a
 * tiny store-only (no compression) ZIP writer. .apkg files import fine
 * with store-only compression in Anki.
 */
function crc32(data: Uint8Array): number {
  // Build CRC table once
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
}
function uint32(n: number): Uint8Array {
  return new Uint8Array([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ])
}

function makeZipFile(name: string, data: Uint8Array): Uint8Array {
  const encoder = new TextEncoder()
  const nameBytes = encoder.encode(name)
  const crc = crc32(data)
  const localHeader = new Uint8Array(30 + nameBytes.length)
  localHeader.set(uint32(0x04034b50), 0) // local file header signature
  localHeader.set(uint16(20), 4) // version needed
  localHeader.set(uint16(0), 6) // flags
  localHeader.set(uint16(0), 8) // compression method: store
  localHeader.set(uint16(0), 10) // mod time
  localHeader.set(uint16(0), 12) // mod date
  localHeader.set(uint32(crc), 14) // crc32
  localHeader.set(uint32(data.length), 18) // compressed size
  localHeader.set(uint32(data.length), 22) // uncompressed size
  localHeader.set(uint16(nameBytes.length), 26) // filename length
  localHeader.set(uint16(0), 28) // extra field length
  localHeader.set(nameBytes, 30)

  const centralHeader = new Uint8Array(46 + nameBytes.length)
  centralHeader.set(uint32(0x02014b50), 0) // central file header signature
  centralHeader.set(uint16(20), 4) // version made by
  centralHeader.set(uint16(20), 6) // version needed
  centralHeader.set(uint16(0), 8) // flags
  centralHeader.set(uint16(0), 10) // compression
  centralHeader.set(uint16(0), 12) // mod time
  centralHeader.set(uint16(0), 14) // mod date
  centralHeader.set(uint32(crc), 16) // crc32
  centralHeader.set(uint32(data.length), 20) // compressed size
  centralHeader.set(uint32(data.length), 24) // uncompressed size
  centralHeader.set(uint16(nameBytes.length), 28) // filename length
  centralHeader.set(uint16(0), 30) // extra field length
  centralHeader.set(uint16(0), 32) // file comment length
  centralHeader.set(uint16(0), 34) // disk number start
  centralHeader.set(uint16(0), 36) // internal file attributes
  centralHeader.set(uint32(0), 38) // external file attributes
  centralHeader.set(uint32(0), 42) // relative offset of local header
  centralHeader.set(nameBytes, 46)

  return { localHeader, centralHeader, data, crc }
  // Note: the caller assembles these in order
}

interface ZipPart {
  localHeader: Uint8Array
  centralHeader: Uint8Array
  data: Uint8Array
}

/**
 * Build the final .apkg file (a ZIP containing media + collection.anki21).
 * Returns the raw bytes ready to stream as a download.
 */
export async function buildApkg(cards: ApkgCard[]): Promise<Uint8Array> {
  const collectionBytes = await buildCollection(cards)
  const mediaJson = new TextEncoder().encode('{}')

  // Build each file's local + central parts
  const file1 = makeZipFile('media', mediaJson) as unknown as ZipPart & {
    localHeader: Uint8Array
    centralHeader: Uint8Array
    data: Uint8Array
  }
  const file2 = makeZipFile('collection.anki21', collectionBytes) as unknown as ZipPart & {
    localHeader: Uint8Array
    centralHeader: Uint8Array
    data: Uint8Array
  }
  const parts = [file1, file2]

  // Compute offsets
  let localOffset = 0
  const centralEntries: Uint8Array[] = []
  const localChunks: Uint8Array[] = []

  for (const part of parts) {
    // Rewrite the central header's offset field (bytes 42–45)
    const ch = new Uint8Array(part.centralHeader)
    const offsetView = uint32(localOffset)
    ch.set(offsetView, 42)

    localChunks.push(part.localHeader, part.data)
    centralEntries.push(ch)
    localOffset += part.localHeader.length + part.data.length
  }

  // End of central directory record
  const eocd = new Uint8Array(22)
  eocd.set(uint32(0x06054b50), 0) // EOCD signature
  eocd.set(uint16(0), 4) // disk number
  eocd.set(uint16(0), 6) // disk with central dir
  eocd.set(uint16(parts.length), 8) // entries on this disk
  eocd.set(uint16(parts.length), 10) // total entries
  const centralSize = centralEntries.reduce((s, e) => s + e.length, 0)
  eocd.set(uint32(centralSize), 12) // central dir size
  eocd.set(uint32(localOffset), 16) // central dir offset
  eocd.set(uint16(0), 20) // comment length

  // Concatenate everything
  const totalSize =
    localChunks.reduce((s, c) => s + c.length, 0) +
    centralEntries.reduce((s, e) => s + e.length, 0) +
    eocd.length

  const result = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of localChunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  for (const entry of centralEntries) {
    result.set(entry, offset)
    offset += entry.length
  }
  result.set(eocd, offset)

  return result
}
