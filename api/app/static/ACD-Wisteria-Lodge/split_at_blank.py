#!/usr/bin/env python3
import os
import sys

max_chars = 6000
out_prefix = "chunk_"

with open(sys.argv[1], "r", encoding="utf-8") as f:
    text = f.read()

pos = 0
i = 1
while pos < len(text):
    # find the split point
    split_at = pos + max_chars
    if split_at >= len(text):
        split_at = len(text)
    else:
        # look for next double newline after split_at
        next_break = text.find("\n\n", split_at)
        if next_break != -1:
            split_at = next_break + 2  # include the double newline

    # write chunk
    chunk = text[pos:split_at]
    with open(f"{out_prefix}{i:03d}.txt", "w", encoding="utf-8") as out:
        out.write(chunk)
    i += 1
    pos = split_at

