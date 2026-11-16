/** Migrate legacy answer URLs in persisted boards/history/snapshots. No text changes. */
import { readFile } from 'node:fs/promises';
import { PrismaClient, type Prisma } from '@prisma/client';
import { dbAdapter } from '../src/server/dbAdapter';
const mapping = JSON.parse(await readFile('scripts/cox-data/answer-assets.json','utf8')) as Record<string,string>;
let changed = 0;
function protect(value: unknown): unknown {
  if (typeof value === 'string') {
    const m = value.match(/^\/cox\/composites\/([0-4]-[0-4]-a)\.(?:svg|png)$/);
    if (m && mapping[m[1]]) { changed++; return '/api/cox-media/' + mapping[m[1]]; }
    return value;
  }
  if (Array.isArray(value)) return value.map(protect);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,protect(v)]));
  return value;
}
const db = new PrismaClient({adapter:dbAdapter()});
try {
  let rows=0;
  for(const row of await db.board.findMany()) {
    const before=changed,content=protect(row.content) as Prisma.InputJsonValue;
    if(changed>before){await db.board.update({where:{id:row.id},data:{content,rev:{increment:1}}});rows++;}
  }
  for(const row of await db.boardVersion.findMany()) {
    const before=changed,content=protect(row.content) as Prisma.InputJsonValue;
    if(changed>before){await db.boardVersion.update({where:{id:row.id},data:{content}});rows++;}
  }
  for(const row of await db.game.findMany()) {
    const before=changed,setup=protect(row.setup) as Prisma.InputJsonValue,actions=protect(row.actions) as Prisma.InputJsonValue;
    if(changed>before){await db.game.update({where:{id:row.id},data:{setup,actions}});rows++;}
  }
  console.log(`Protected ${changed} legacy answer references in ${rows} persisted rows; source text untouched.`);
} finally {await db.$disconnect();}
