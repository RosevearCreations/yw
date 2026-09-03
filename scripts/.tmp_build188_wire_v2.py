from pathlib import Path

source=Path('scripts/.tmp_build188_wire.py').read_text()
marker='# Full CI source gate.'
if marker not in source:
    raise SystemExit('missing Build 188 wiring marker')
prefix=source.split(marker,1)[0]
exec(compile(prefix,'scripts/.tmp_build188_wire.py','exec'))
