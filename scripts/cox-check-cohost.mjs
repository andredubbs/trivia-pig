// Read-only public account/access check; credentials/cookies never logged.
const base='https://jeopardy.192-241-145-6.sslip.io';
const password=process.env.COX_KERIK_PASSWORD;
if(!password) throw new Error('Missing scoped COX_KERIK_PASSWORD');
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'kerik@cox-classroom.invalid',password})});
if(!login.ok) throw new Error('Kerik password sign-in failed: '+login.status);
const cookie=login.headers.get('set-cookie')?.split(';')[0];
if(!cookie) throw new Error('No session established');
const response=await fetch(base+'/api/boards/cox-plant-pathology-2026',{headers:{cookie}});
if(!response.ok) throw new Error('Kerik canonical board access failed: '+response.status);
const board=await response.json();
if(board.content.rounds.flatMap(r=>r.categories.flatMap(c=>c.clues)).length!==25) throw new Error('Unexpected canonical board');
console.log('PASS Kerik signs in with scoped password and accesses the canonical25-clue board as co-host.');
const answers=board.content.rounds.flatMap(r=>r.categories.flatMap(c=>c.clues)).map(q=>q.answerMedia).filter(Boolean);
for(const media of answers) {
 const image=await fetch(base+media.url,{headers:{cookie}});
 if(image.status!==200 || !image.headers.get('cache-control')?.includes('no-store')) throw new Error('Co-host protected answer image denied or cacheable');
 await image.arrayBuffer();
}
console.log('PASS Kerik can preview all8 protected answer images as co-host, without public reveal.');
await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie}});
