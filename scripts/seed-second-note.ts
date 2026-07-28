// Seed a second note about the spacing effect so the Related Notes
// widget has something to match against the existing "My first note"
// about spaced repetition.
import { db } from '../src/lib/db'

async function main() {
  const user = await db.user.findFirst({
    where: { email: 'test@recall.app' },
  })
  if (!user) {
    console.error('Test user not found')
    process.exit(1)
  }

  // Check if the note already exists
  const existing = await db.note.findFirst({
    where: { userId: user.id, title: 'The spacing effect in cognitive psychology' },
  })
  if (existing) {
    console.log('Note already exists, updating content...')
    await db.note.update({
      where: { id: existing.id },
      data: {
        contentMarkdown: `# The Spacing Effect

The spacing effect is a cognitive psychology phenomenon where information is better retained when study sessions are spaced out over time rather than massed together in a single session.

## Key findings

- Hermann Ebbinghaus first documented this in 1885 using nonsense syllables.
- Spaced practice typically yields 2-3x better long-term retention than cramming.
- The effect is robust across age groups, materials, and domains.

## Why it works

Each review strengthens the memory trace. When reviews are spaced, the brain must work harder to retrieve the information, which itself consolidates the memory. Cramming doesn't give the forgetting curve time to descend, so retrieval is too easy and the trace isn't strengthened.`,
      },
    })
  } else {
    await db.note.create({
      data: {
        userId: user.id,
        title: 'The spacing effect in cognitive psychology',
        contentMarkdown: `# The Spacing Effect

The spacing effect is a cognitive psychology phenomenon where information is better retained when study sessions are spaced out over time rather than massed together in a single session.

## Key findings

- Hermann Ebbinghaus first documented this in 1885 using nonsense syllables.
- Spaced practice typically yields 2-3x better long-term retention than cramming.
- The effect is robust across age groups, materials, and domains.

## Why it works

Each review strengthens the memory trace. When reviews are spaced, the brain must work harder to retrieve the information, which itself consolidates the memory. Cramming doesn't give the forgetting curve time to descend, so retrieval is too easy and the trace isn't strengthened.`,
      },
    })
  }

  // Also create a third unrelated note
  const note3 = await db.note.upsert({
    where: { id: 'seed-cooking-note' },
    update: {},
    create: {
      id: 'seed-cooking-note',
      userId: user.id,
      title: 'French onion soup recipe',
      contentMarkdown: `# French Onion Soup

## Ingredients
- 4 large yellow onions, thinly sliced
- 2 tbsp butter
- 1 tbsp olive oil
- 6 cups beef broth
- 1 cup dry white wine
- 4 slices French bread
- 1 cup Gruyère cheese, grated

## Method
1. Caramelize onions slowly in butter and oil for 45 minutes.
2. Deglaze with wine, then add broth. Simmer 30 minutes.
3. Ladle into bowls, top with bread and cheese, broil until bubbly.`,
    },
  })

  console.log(`Seeded notes. Total: ${await db.note.count()}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
