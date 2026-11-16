import json,subprocess,sys
pw=json.load(sys.stdin)['password']
assert all(c.isalnum() or c in '_-' for c in pw)
sql="SET default_transaction_read_only=off;\nALTER ROLE cox_trivia_d PASSWORD '"+pw+"';\n"
p=subprocess.run(['/opt/homebrew/bin/docker','exec','-i','asus-postgres-fallback','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True)
if p.returncode: raise SystemExit('Role rotation failed; values suppressed')
print('Isolated database password rotated.')
