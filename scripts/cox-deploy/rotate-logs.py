"""Hourly copy/truncate preserves launchd's open file descriptors; keep two archives."""
import pathlib,shutil
root=pathlib.Path.home()/'Projects/cox-trivia-d'
for name in ['service.log','service-error.log','backup.log','backup-error.log']:
 p=root/name
 if not p.exists() or p.stat().st_size<=262144:continue
 first=p.with_name(name+'.1');second=p.with_name(name+'.2')
 if first.exists():first.replace(second)
 shutil.copyfile(p,first);first.chmod(0o600)
 with p.open('r+b') as f:f.truncate(0)
