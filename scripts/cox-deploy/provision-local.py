"""Run once on Pro, no secrets written locally or printed. No automatic write retries."""
import json,pathlib,secrets,subprocess
project='cox-jeopardy-d'
def run(args,**kw): return subprocess.run(args,check=True,capture_output=True,**kw)
existing=run(['doppler','secrets','--project',project,'--config','prd','--only-names','--json']).stdout
if b'AUTH_SECRET' in existing: raise SystemExit('Secrets already provisioned. Inspect state before replay.')
pw=secrets.token_urlsafe(32)
values={'AUTH_SECRET':secrets.token_urlsafe(48),'DATABASE_URL':'postgresql://cox_trivia_d:'+pw+'@127.0.0.1:15432/cox_trivia_d?connection_limit=5','COX_ANDREW_PASSWORD':secrets.token_urlsafe(24),'COX_KERIK_PASSWORD':secrets.token_urlsafe(24)}
for name,value in values.items(): run(['doppler','secrets','set',name,'--project',project,'--config','prd','--silent'],input=value.encode())
token=run(['doppler','configs','tokens','create','cox-air-runtime-20261115','--project',project,'--config','prd','--access','read','--max-age','336h','--plain']).stdout.decode().strip()
run([str(pathlib.Path.home()/'.local/bin/fleet-connect'),'run','--upload','scripts/cox-deploy/provision-sink.py','/Users/andrewfuller/Projects/cox-trivia-d/provision-sink.py','air','--','/opt/homebrew/bin/python3 ~/Projects/cox-trivia-d/provision-sink.py'],input=json.dumps({'dbPassword':pw,'serviceToken':token}).encode())
print('Provisioned 4 secrets in Doppler cox-jeopardy-d/prd; isolated Air DB and read-only token expiring in 14 days.')
