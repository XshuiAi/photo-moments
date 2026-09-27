#!/usr/bin/env python3
"""Create a new, verified Photo Moments copy; never overwrite existing output."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import uuid

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / 'assets' / 'template'
RESERVED = {'con', 'prn', 'aux', 'nul', *(f'com{i}' for i in range(10)), *(f'lpt{i}' for i in range(10))}

def no_links(path):
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('Symbolic links are not accepted')

def create(name):
    # Complete validation happens before any output is created.
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,47}', name) or name in RESERVED:
        raise ValueError('Use a new lowercase name containing only letters, numbers and hyphens')
    cwd = Path.cwd()
    no_links(cwd)
    if cwd == SKILL or cwd.is_relative_to(SKILL):
        raise ValueError('Run from a separate task workspace, outside the installed skill')
    root = cwd / 'photo-moments-output'
    dest = root / name
    no_links(dest)
    if dest.exists() or (root.exists() and not root.is_dir()):
        raise ValueError('Output already exists; choose a different name. No overwrite is supported')
    no_links(TEMPLATE)
    manifest = json.loads((SKILL / 'template-manifest.json').read_text())
    checked = []
    for relative, expected in manifest.items():
        p = Path(relative)
        if p.is_absolute() or '..' in p.parts or '\\' in relative or p.as_posix() != relative:
            raise ValueError('Invalid template path')
        source = TEMPLATE / p
        no_links(source)
        if not source.resolve().is_relative_to(TEMPLATE.resolve()) or not source.is_file():
            raise ValueError('Template file missing or outside template')
        data = source.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Template checksum mismatch: ' + relative)
        checked.append((p, data))
    if not checked:
        raise ValueError('Empty template')
    root.mkdir(exist_ok=True)
    # Recheck before mutation; only a new exclusive staging directory is written.
    no_links(root)
    stage = root / ('.' + name + '-' + uuid.uuid4().hex)
    stage.mkdir()
    for relative, data in checked:
        target = stage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as f:
            f.write(data)
    with (stage / '.photo-moments-output.json').open('x') as f:
        json.dump({'tool': 'photo-moments', 'version': '1.0.2'}, f)
    # Reserve the destination exclusively. Never rename over an existing directory.
    dest.mkdir()
    for child in stage.iterdir():
        os.rename(child, dest / child.name)
    stage.rmdir()  # only the empty directory created by this invocation
    return dest

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--name', default='my-moments')
    args = parser.parse_args()
    try:
        print(create(args.name))
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
