"""App-only compressed Postgres backup. Values never reach argv/logs. Run on Air."""
import datetime,os,pathlib,subprocess,urllib.parse
url=urllib.parse.urlparse(os.environ['DATABASE_URL'])
assert url.hostname=='127.0.0.1' and url.path=='/cox_trivia_d' and url.username=='cox_trivia_d'
root=pathlib.Path.home()/'Projects/cox-trivia-d/backups';root.mkdir(mode=0o700,exist_ok=True);os.chmod(root,0o700)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target=root/('cox-trivia-d-'+stamp+'.dump'); temp=target.with_suffix('.partial')
env=dict(os.environ,PGHOST=url.hostname,PGPORT=str(url.port),PGUSER=url.username,PGPASSWORD=url.password,PGDATABASE='cox_trivia_d')
os.umask(0o077)
p=subprocess.run(['/opt/homebrew/opt/libpq/bin/pg_dump','--format=custom','--no-owner','--file',str(temp)],env=env,capture_output=True)
if p.returncode: temp.unlink(missing_ok=True);raise SystemExit('Database backup failed (private diagnostics suppressed)')
temp.replace(target)
subprocess.run(['/opt/homebrew/opt/libpq/bin/pg_restore','--list',str(target)],check=True,stdout=subprocess.DEVNULL)
for old in sorted(root.glob('cox-trivia-d-*.dump'))[:-7]: old.unlink()
print('Validated compressed app-only backup '+target.name+' ('+str(target.stat().st_size)+' bytes).')
