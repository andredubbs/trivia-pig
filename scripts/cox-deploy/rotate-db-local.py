import json,pathlib,secrets,subprocess
pw=secrets.token_urlsafe(32)
p=subprocess.run([str(pathlib.Path.home()/'.local/bin/fleet-connect'),'run','--upload','scripts/cox-deploy/rotate-db-sink.py','/Users/andrewfuller/Projects/cox-trivia-d/rotate-db-sink.py','air','--','/opt/homebrew/bin/python3 ~/Projects/cox-trivia-d/rotate-db-sink.py'],input=json.dumps({'password':pw}).encode(),capture_output=True)
if p.returncode: raise SystemExit('Database rotation failed before store update; reconcile.')
p=subprocess.run(['doppler','secrets','set','DATABASE_URL','--project','cox-jeopardy-d','--config','prd','--silent'],input=('postgresql://cox_trivia_d:'+pw+'@127.0.0.1:15432/cox_trivia_d?connection_limit=5').encode(),capture_output=True)
if p.returncode: raise SystemExit('Doppler update failed after DB rotation; reconcile.')
print('Rotated database credential and updated Doppler (values suppressed).')
