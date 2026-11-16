"""Run on VPS as root. Preserve all existing hostnames. Never restart Caddy."""
import datetime,pathlib,subprocess
p=pathlib.Path('/etc/caddy/Caddyfile')
raw=p.read_text(); block=pathlib.Path('/tmp/cox-d-caddy-site.txt').read_text()
if 'jeopardy.192-241-145-6.sslip.io {' in raw: raise SystemExit('Site already configured; inspect before replay')
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=p.with_name('Caddyfile.bak.'+stamp+'-cox-d'); backup.write_bytes(p.read_bytes());backup.chmod(0o600)
candidate=pathlib.Path('/etc/caddy/Caddyfile.cox-d-candidate'); candidate.write_text(raw+block)
subprocess.run(['caddy','validate','--config',str(candidate),'--adapter','caddyfile'],check=True)
p.write_text(candidate.read_text())
try: subprocess.run(['systemctl','reload','caddy'],check=True)
except Exception:
 p.write_bytes(backup.read_bytes());subprocess.run(['systemctl','reload','caddy'],check=True);raise
print('Caddy reloaded. Backup: '+str(backup))
