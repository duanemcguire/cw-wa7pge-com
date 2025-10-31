from flask import render_template, request
import os
import random
from flask import Blueprint
import unicodedata
import logging
log =  logging.getLogger(__name__)
ttr = Blueprint('ttr', __name__)
remove_yuk_chars = True

def simplify_accents(text):
    nfkd_form = unicodedata.normalize('NFKD', text)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def remove_yucky(line):
    yuk = "{}[];:\\|-_+*&^%$#@!<>"
    for ltr in yuk:
        line = line.replace(ltr," ")
    return line


def simplify_cw_line(line):
    line = line.replace("’","'")
    line = line.replace("&"," and ")
    line = simplify_accents(line)
    if remove_yuk_chars == True:
        line = remove_yucky(line)
    return line



def getPhraseAttr():
    attr = {}
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = "text_files"

    categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
    
    if len(request.values) > 0:
        newCategory = 0
        selected_category = request.values.get('category')
        collections_path = os.path.join(TEXT_FOLDER, selected_category)
        collections = sorted([f for f in os.listdir(collections_path)])
        selected_file = collections[0]
        if 'newCategory' in request.values:
            newCategory = request.values.get('newCategory')
        if 'filename' in request.values:
            selected_file = request.values.get('filename')
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
    attr['collections'] = collections
    attr['categories'] = categories
    attr['selected_category'] = selected_category
    attr['selected_file'] = selected_file
    attr['lines'] = lines
    return attr


## COPYING

@phrases.route('/song-titles', methods=['GET', 'POST'])
def deprecated1():
    return songtitles()

@phrases.route('/', methods=['GET', 'POST'])
def songtitles():

    wpm = request.values.get('wpm')
    wpm_options = [12,14,16,18,20,22,25,27,30,31,40]

    attr = getPhraseAttr()
    try:
        attr['categories'].remove('Pangram') # not really appropriate for copying
    except ValueError:
        pass

    return render_template('phrases/copying.html',
                           wpm_options=wpm_options, 
                           wpm=wpm, 
                           categories=attr['categories'],
                           files=attr['collections'],
                           selected_category=attr['selected_category'], 
                           selected_file=attr['selected_file'], 
                           lines=attr['lines'])


## SENDING

@phrases.route('/song-titles-sending', methods=['GET', 'POST'])
def deprecated2():
    return song_titles_sending()
    
@phrases.route('/sending', methods=['GET', 'POST'])

def song_titles_sending():
    attr = getPhraseAttr()

    return render_template('phrases/sending.html',
                           categories=attr['categories'],
                           files=attr['collections'],
                           selected_category=attr['selected_category'], 
                           selected_file=attr['selected_file'], 
                           lines=attr['lines'])

