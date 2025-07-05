from flask import render_template, request
import os
import random
from flask import Blueprint
import unicodedata
import logging
log =  logging.getLogger(__name__)


def simplify_accents(text):
    nfkd_form = unicodedata.normalize('NFKD', text)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def simplify_cw_line(line):
    line = line.replace("("," = ")
    line = line.replace(")"," = ")
    line = line.replace("’","'")
    line = line.replace("&"," and ")
    line = line.replace("~"," ")
    line = simplify_accents(line)
    return line


def simplify_display_line(line):
    line = line.replace("’","'")
    line = line.replace("~","<BR/>")
    line = simplify_accents(line)
    return line

phrases = Blueprint('phrases', __name__)

## COPYING

@phrases.route('/song-titles', methods=['GET', 'POST'])
def deprecated1():
    return songtitles()

@phrases.route('/', methods=['GET', 'POST'])
def songtitles():
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = "text_files"

    wpm = request.form.get('wpm')
    wpm_options = [12,14,16,18,20,25,30,40]
    categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
    if len(request.form) > 0:
        newCategory = request.form.get('newCategory')
        selected_category = request.form.get('category')
        selected_file = request.form.get('filename')
        collections_path = os.path.join(TEXT_FOLDER, selected_category)
        collections = sorted([f for f in os.listdir(collections_path)])
        if newCategory == "1":
            selected_file = collections[0]
        category_dir = os.path.join(TEXT_FOLDER, selected_category)
        file_path = os.path.join(category_dir, selected_file)
        lines = []
        try:
            with open(file_path, 'r') as f:
                for line in f:    
                    line = simplify_cw_line(line)
                    lines.append(line)
        except Exception as e:
            line = f"Error reading file: {e}"
    else:
        # form has not yet been submitted.
        # get the first category and collection  and go with that. 
        categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
        selected_category = categories[0]
        collections_path = os.path.join(TEXT_FOLDER, selected_category)
        collections = sorted([f for f in os.listdir(collections_path)])
        selected_file = collections[0]
        file_path = os.path.join(collections_path, selected_file)
        try:
            lines=[]
            with open(file_path, 'r') as f:
                for line in f: 
                    line = simplify_cw_line(line)
                    lines.append(line)
        except Exception as e:
            line = f"Error reading file: {e}"

    return render_template('phrases/copying.html',
                           wpm_options=wpm_options, 
                           wpm=wpm, 
                           categories=categories,
                           files=collections,
                           selected_category=selected_category, 
                           selected_file=selected_file, 
                           lines=lines)


## SENDING

@phrases.route('/song-titles-sending', methods=['GET', 'POST'])
def deprecated2():
    return song_titles_sending()
    
@phrases.route('/sending', methods=['GET', 'POST'])
def song_titles_sending():
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = "text_files"

    categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
    selected_category = request.form.get('category')
    selected_file = request.form.get('filename')
    newCategory = request.form.get('newCategory')
    if newCategory == "1":
        selected_file = None
    if not selected_category:
        selected_category = categories[0];

    files=None
    line=None
    category_dir = os.path.join(TEXT_FOLDER, selected_category)
    files = sorted([f for f in os.listdir(category_dir)])
    if selected_file:
        file_path = os.path.join(category_dir, selected_file)
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    line = random.choice(lines).strip()
                    line = simplify_display_line(line)
        except Exception as e:
            line = f"Error reading file: {e}"
    return render_template('phrases/sending.html', 
        categories=categories,
        selected_category=selected_category,
        files=files, 
        selected_file=selected_file, 
        line=line)

