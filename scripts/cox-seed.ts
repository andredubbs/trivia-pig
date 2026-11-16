/** Idempotent account seed. All passwords come from scoped Doppler injection. */
import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '@prisma/client';
import { dbAdapter } from '../src/server/dbAdapter';
import { settingsSchema } from '../src/engine/types';
const db = new PrismaClient({adapter:dbAdapter()});
try {
 for (const [id,email,name,key,admin] of [
  ['cox-andrew','andrew@cox-classroom.invalid','Andrew','COX_ANDREW_PASSWORD',true],
  ['cox-kerik','kerik@cox-classroom.invalid','Kerik Cox','COX_KERIK_PASSWORD',false],
 ] as const) {
  const password=process.env[key]; if(!password) throw new Error(`Missing secret ${key}`);
  const defaults=settingsSchema.parse({mode:'team',maxPlayers:6,maxTeams:6,lobbyGame:false,audience:false,avatars:false,reactions:true,reclaimSeats:false,startCountdownSec:0,dailyDoublePlacement:'random',dailyDoublesSingle:2,sound:{master:0.25,muted:true,music:true,sfx:true,playerBuzzSound:false}});
  await db.user.upsert({where:{email},update:{gameDefaults:defaults as unknown as Prisma.InputJsonValue},create:{id,email,name,passwordHash:await bcrypt.hash(password,11),isAdmin:admin,gameDefaults:defaults as unknown as Prisma.InputJsonValue}});
 }
 await db.membership.upsert({where:{ownerId_memberId:{ownerId:'cox-andrew',memberId:'cox-kerik'}},update:{role:'COHOST'},create:{ownerId:'cox-andrew',memberId:'cox-kerik',role:'COHOST'}});
 console.log('Andrew and Kerik accounts ready; Kerik co-hosts Andrew’s canonical board. No secret values logged.');
} finally {await db.$disconnect();}
