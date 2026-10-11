#!/usr/bin/env python3
"""Turn line-delimited text into an Obsidian-style .md split by '---'.

Usage: lines2md.py input.txt [output.md]

Each non-blank input line becomes its own block, separated (and closed) by a
'---' fence.  Blocks are emitted in random order.  Defaults the output name to
the input's stem + '.md'.
"""
import os
import random
import sys

if len(sys.argv) < 2:
    sys.exit(__doc__.splitlines()[2])

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + '.md'

with open(src) as f:
    lines = [line.strip() for line in f if line.strip()]

random.shuffle(lines)

with open(dst, 'w') as out:
    out.write('\n')
    for line in lines:
        out.write(line + '\n\n---\n')
