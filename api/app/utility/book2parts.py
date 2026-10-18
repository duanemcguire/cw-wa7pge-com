#!/usr/bin/env python3
"""Split a Project Gutenberg book into CW practice files of a fixed play time.

Usage: book2parts.py input.txt outdir [--wpm 20] [--minutes 5]

Front matter (license, contents, introduction, etc.) is stripped; output
starts with the book title and Chapter 1.  Each chapter is broken into parts
at sentence boundaries, keeping paragraph breaks, so that each part plays for
roughly --minutes at --wpm with standard spacing.  Files are named
chapter_01_part_01.txt, etc.
"""
import argparse
import os
import re
import sys
import textwrap

MORSE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
    '!': '-.-.--', '-': '-....-',
}

CHAPTER_RE = re.compile(r'^Chapter ([IVXLC]+)\.?\s*$')
END_RE = re.compile(r'^\*\*\* END OF THE PROJECT GUTENBERG')
MIN_TAIL = 0.3  # merge a chapter's last part if shorter than this fraction


def roman_to_int(s):
    vals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}
    total = 0
    for i, c in enumerate(s):
        v = vals[c]
        if i + 1 < len(s) and vals[s[i + 1]] > v:
            total -= v
        else:
            total += v
    return total


def clean(text):
    text = text.replace('’', "'").replace('‘', "'")
    text = re.sub(r'[“”"]', '', text)
    text = text.replace('—', ' - ')
    text = re.sub(r'[;:]', ',', text)
    text = re.sub(r"[^A-Za-z0-9 .,?'!\-\n]", '', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r' +([.,?!])', r'\1', text)
    return '\n'.join(line.strip() for line in text.split('\n'))


def dits(text):
    """Dit units to send text at standard spacing."""
    units = 0
    for word in text.split():
        codes = [MORSE[c] for c in word.upper() if c in MORSE]
        for code in codes:
            units += sum(1 if x == '.' else 3 for x in code) + len(code) - 1
        units += 3 * max(len(codes) - 1, 0) + 7
    return units


def load_chapters(path):
    """Return (title, [(chapter_number, heading, [paragraph, ...]), ...])."""
    with open(path, encoding='utf-8-sig') as f:
        lines = [line.rstrip() for line in f]

    end = next((i for i, l in enumerate(lines) if END_RE.match(l)), len(lines))
    lines = lines[:end]

    # Chapter headings are "Chapter I" on its own line, followed by the title.
    # Contents entries are indented and include the title, so they don't match.
    starts = [i for i, l in enumerate(lines) if CHAPTER_RE.match(l)]
    if not starts:
        sys.exit('No chapter headings found')

    title = next(l.strip() for l in reversed(lines[:starts[0]]) if l.strip())

    chapters = []
    for n, start in enumerate(starts):
        stop = starts[n + 1] if n + 1 < len(starts) else len(lines)
        number = roman_to_int(CHAPTER_RE.match(lines[start]).group(1))
        body = lines[start + 1:stop]
        while body and not body[0].strip():
            body.pop(0)
        name = body.pop(0).strip() if body else ''
        heading = f"Chapter {number}. {name}" if name else f"Chapter {number}"
        paragraphs = [clean(p).strip() for p in re.split(r'\n\s*\n', '\n'.join(body))]
        paragraphs = [p for p in paragraphs if p and not re.fullmatch(r'[\W_]*', p)]
        chapters.append((number, clean(heading), paragraphs))
    return clean(title), chapters


# Words ending in a period that don't end a sentence: titles, abbreviated
# names, and single-letter initials (excluding "I", which often ends one).
ABBREV_RE = re.compile(
    r'(?:^|\s)(?:Mr|Mrs|Ms|Messrs|Mme|Dr|St|Capt|Col|Gen|Lt|Sgt|Rev|Prof|'
    r'Sr|Jr|Mt|Robt|Wm|Geo|Chas|Jas|Thos|Jno|[A-HJ-Z])\.$')


def sentences(paragraph):
    pieces = re.split(r'(?<=[.?!])\s+', ' '.join(paragraph.split()))
    merged = []
    for piece in pieces:
        if merged and (ABBREV_RE.search(merged[-1]) or
                       (re.search(r'(?:^|\s)No\.$', merged[-1]) and piece[:1].isdigit())):
            merged[-1] += ' ' + piece
        else:
            merged.append(piece)
    return merged


def split_parts(paragraphs, budget):
    """Fill each part up to budget a sentence at a time, keeping paragraph breaks.

    Returns a list of parts; each part is a list of paragraphs, each a list of
    sentences.
    """
    parts, current, used = [], [], 0
    for paragraph in paragraphs:
        current.append([])
        for s in sentences(paragraph):
            cost = dits(s)
            if used and used + cost > budget:
                parts.append([p for p in current if p])
                current, used = [[]], 0
            current[-1].append(s)
            used += cost
    current = [p for p in current if p]
    if current:
        if parts and used < budget * MIN_TAIL:
            parts[-1].extend(current)
        else:
            parts.append(current)
    return parts


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('infile')
    ap.add_argument('outdir')
    ap.add_argument('--wpm', type=float, default=20)
    ap.add_argument('--minutes', type=float, default=5)
    args = ap.parse_args()

    budget = args.wpm * 50 * args.minutes  # PARIS: 50 dit units per word
    title, chapters = load_chapters(args.infile)
    os.makedirs(args.outdir, exist_ok=True)

    count = 0
    for number, heading, paragraphs in chapters:
        lead = [title, heading] if number == chapters[0][0] else [heading]
        parts = split_parts(lead + paragraphs, budget)
        for p, part in enumerate(parts, 1):
            text = '\n\n'.join(textwrap.fill(' '.join(s), 70) for s in part)
            fn = os.path.join(args.outdir, f"chapter_{number:02d}_part_{p:02d}.txt")
            with open(fn, 'w') as out:
                out.write(text + '\n')
            count += 1
            print(f"{fn}  {dits(text) / (args.wpm * 50):.1f} min")
    print(f"{count} files written to {args.outdir}")


if __name__ == '__main__':
    main()
