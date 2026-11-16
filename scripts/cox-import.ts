/** Idempotent import into an existing host's account, without creating credentials.
 * npx tsx scripts/cox-import.ts --owner-email host@example.com
 * npx tsx scripts/cox-import.ts --check
 * Optional --file, --board-id. Existing content is versioned before changes.
 */
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Prisma } from '@prisma/client';
import { boardFromJson } from '../src/shared/importBoard';
import { dbAdapter } from '../src/server/dbAdapter';

const { values } = parseArgs({ options: {
  'owner-email': { type: 'string' },
  'board-id': { type: 'string', default: 'cox-plant-pathology-2026' },
  file: { type: 'string', default: fileURLToPath(new URL('./cox-data/board.json', import.meta.url)) },
  check: { type: 'boolean', default: false },
}});
const imported = boardFromJson(JSON.parse(await readFile(values.file!, 'utf8')));
if (imported.content.rounds.length !== 1 || imported.content.rounds[0].categories.length !== 5 ||
    imported.content.rounds[0].categories.some(c => c.clues.length !== 5) || imported.content.final) {
  throw new Error('The Cox board must have exactly 25 clues and no invented Final.');
}
const compositeCount = imported.content.rounds.flatMap(r => r.categories).flatMap(c => c.clues)
  .reduce((sum, clue) => sum + Number(!!clue.media) + Number(!!clue.answerMedia), 0);
if (compositeCount !== 16) throw new Error('Expected exactly 16 clue/answer composites.');
if (values.check) {
  console.log('Valid Cox board: 5 categories, 25 clues, 16 clue/answer composites, no Final.');
} else {
  if (!values['owner-email']) throw new Error('--owner-email is required; the importer never creates users or credentials.');
  const prisma = new PrismaClient({ adapter: dbAdapter() });
  try {
    const result = await prisma.$transaction(async tx => {
      const owner = await tx.user.findUnique({ where: { email: values['owner-email']! } });
      if (!owner) throw new Error('The specified host account does not exist.');
      const existing = await tx.board.findUnique({ where: { id: values['board-id']! } });
      if (existing && existing.ownerId !== owner.id) throw new Error('Board ID belongs to another account; pass a different --board-id.');
      const content = imported.content as unknown as Prisma.InputJsonValue;
      const metadata = { title: imported.title!, description: imported.description ?? '', tags: imported.tags ?? [] };
      if (existing && isDeepStrictEqual(existing.content, content) &&
          existing.title === metadata.title && existing.description === metadata.description &&
          isDeepStrictEqual(existing.tags, metadata.tags)) return 'unchanged';
      if (existing) {
        await tx.boardVersion.create({ data: { boardId: existing.id, title: existing.title,
          content: existing.content as Prisma.InputJsonValue, label: 'Before Cox source reimport' } });
        await tx.board.update({ where: { id: existing.id }, data: { ...metadata, content, rev: { increment: 1 } } });
        return 'updated (previous version retained)';
      }
      await tx.board.create({ data: { id: values['board-id']!, ownerId: owner.id, ...metadata, content } });
      return 'created';
    }, { maxWait: 15_000, timeout: 30_000 });
    console.log(`Cox board ${values['board-id']}: ${result}.`);
  } finally { await prisma.$disconnect(); }
}
