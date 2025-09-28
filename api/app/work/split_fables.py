#!/usr/bin/python
import os
import re

# Input and output setup
input_file = "fables.txt"   # your full collection file
output_dir = "fables_split" # folder to hold individual files
os.makedirs(output_dir, exist_ok=True)

with open(input_file, "r", encoding="utf-8") as f:
    text = f.read()

# Split fables by two or more blank lines before a title
# Titles are in ALL CAPS
fables = re.split(r"\n\s*\n(?=[A-Z][A-Z\s]+(?:\n|$))", text.strip())

for fable in fables:
    lines = fable.strip().splitlines()
    if not lines:
        continue
    title = lines[0].strip()

    # Clean filename (remove punctuation, collapse spaces to underscores)
    filename = re.sub(r"[^A-Za-z0-9]+", "_", title).strip("_") + ".txt"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as out:
        out.write(fable.strip() + "\n")

print(f"Done! Split {len(fables)} fables into {output_dir}/")

