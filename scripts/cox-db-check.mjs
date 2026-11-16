import pg from 'pg';
const u=new URL(process.env.DATABASE_URL);
console.log('Checking scoped database',u.hostname,u.port,u.pathname);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:8000,max:1});
try { const res=await pool.query('select current_user, current_database(), current_setting(\'default_transaction_read_only\') as readonly'); console.log('PASS',res.rows[0]); }
catch(error) {console.error('Database failure code',error.code || error.constructor.name);process.exitCode=1;}
finally {await pool.end();}
