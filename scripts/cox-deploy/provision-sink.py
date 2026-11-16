"""Fixed Air sink: scoped app token config + isolated DB. Input via fleet stdin."""
import json, os, pathlib, subprocess, sys
req=json.load(sys.stdin)
root=pathlib.Path.home()/'.config/cox-jeopardy-d'
root.mkdir(mode=0o700,exist_ok=True)
os.chmod(root,0o700)
target=root/'.doppler.yaml'
if target.exists(): raise SystemExit('App credential config already exists; reconcile before replay')
pw=req['dbPassword']; token=req['serviceToken']
assert token.startswith('dp.st.') and pw.isascii() and all(c.isalnum() or c in '_-' for c in pw)
sql="SET default_transaction_read_only=off;\nCREATE ROLE cox_trivia_d LOGIN PASSWORD '"+pw+"';\nALTER ROLE cox_trivia_d SET default_transaction_read_only=off;\nCREATE DATABASE cox_trivia_d OWNER cox_trivia_d ENCODING 'UTF8' TEMPLATE template0;\n"
p=subprocess.run(['/opt/homebrew/bin/docker','exec','-i','asus-postgres-fallback','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True)
if p.returncode: raise SystemExit('Database provisioning failed; inspect catalog before replay (values suppressed)')
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write('scoped:\n    /:\n        token: '+token+'\n')
print('Created isolated database role/database and private read-only Doppler config.')
