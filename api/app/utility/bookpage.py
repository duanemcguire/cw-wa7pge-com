#!/usr/bin/env python
import sys
infile = '../winnie.txt'
reps = 100
outfile = 'bookpage-outfile.txt'
if len(sys.argv) > 1:
    fn = sys.argv[1]
if len(sys.argv) > 2:
    reps = int(sys.argv[2])    
if len(sys.argv) > 3:
    outfile = sys.argv[3]

lines = []
#truncate if exists.
with open(outfile, 'w'): pass
outfile = open(outfile, 'w')
page = 0
linecount = 0
with open(infile, 'r') as file:
    outfile.writelines([f"Page 0", "\n\n"])
    for line in file:
        linecount = linecount + 1
        lines.append(line)
        if linecount > reps:
            page = page + 1
            outfile.writelines(lines)
            outfile.writelines([f"PAGE {page}", "\n\n"])   
            linecount = 0
            lines = []
outfile.close()