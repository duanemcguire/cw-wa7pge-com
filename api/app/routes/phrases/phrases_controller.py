from flask import render_template, request, jsonify
import os
import random
from flask import Blueprint
import unicodedata
import logging
log =  logging.getLogger(__name__)
phrases = Blueprint('phrases', __name__)
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
    attr['wpm'] = 20
    attr['ws'] = '1'
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    print(f"request.path: {request.path}")
    os.chdir(current_dir)
    TEXT_FOLDER = "text_files"
    

    categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
    
    if len(request.values) > 0:
        newCategory = 0
        if request.path[0:12] == '/phrases/ttr':
            selected_category = 'Word'
        else:
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
        if 'wpm' in request.values:
            attr['wpm'] = int(request.values.get('wpm'))    
        if 'ws' in request.values:
            attr['ws'] = request.values.get('ws')    
        if 'repititions' in request.values:
            attr['repititions'] = request.values.get('repititions')    

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
        attr['repititions'] = "1"
        categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
        selected_category = categories[0]
        if request.path[0:12] == '/phrases/ttr' :
            selected_category = 'Word'
            newCategory = 1 
        if request.path[0:20] == '/phrases/phrase-flow' :
            selected_category = 'Common Phrase'
            newCategory = 1 



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
    attr['wpm_options'] =  [12,14,16,18,20,22,25,27,30,31,40]
    attr['ws_options'] = ["1","1.2","1.4","1.6","1.8","2","2.2","2.4","2.6","2.8","3.0"]
    
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
                           ws=attr['ws'],
                           ws_options=attr['ws_options'],
                           categories=attr['categories'],
                           files=attr['collections'],
                           selected_category=attr['selected_category'],
                           selected_file=attr['selected_file'],
                           lines=attr['lines'],
                           page_title = 'CW Phrase Copy Practice')


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
                           lines=attr['lines'],
                           page_title = 'CW Phrase Sending Practice')


@phrases.route('/ttr2', methods=['GET', 'POST'])
@phrases.route('/ttr', methods=['GET', 'POST'])
def ttr():
    attr = getPhraseAttr()

    return render_template('phrases/ttr.html',
                           categories=attr['categories'],
                           files=attr['collections'],
                           selected_category=attr['selected_category'], 
                           selected_file=attr['selected_file'], 
                           lines=attr['lines'],
                           attr = attr,
                           page_title = 'CW Word Flow Practice')


@phrases.route('/phrase-flow', methods=['GET', 'POST'])
def phrase_flow():
    attr = getPhraseAttr()

    return render_template('phrases/phrase-flow.html',
                           categories=attr['categories'],
                           files=attr['collections'],
                           selected_category=attr['selected_category'],
                           selected_file=attr['selected_file'],
                           lines=attr['lines'],
                           attr = attr,
                           page_title = 'CW Phrase Flow Practice')


# ── Offline / PWA API ─────────────────────────────────────────────────────────

def _text_folder():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'text_files')


@phrases.route('/api/index')
def api_index():
    tf = _text_folder()
    categories = sorted(os.listdir(tf))
    files_by_category = {}
    for cat in categories:
        cat_path = os.path.join(tf, cat)
        if os.path.isdir(cat_path):
            files_by_category[cat] = sorted(os.listdir(cat_path))
    return jsonify({'categories': categories, 'files_by_category': files_by_category})


@phrases.route('/api/data')
def api_data():
    category = request.args.get('category', '')
    filename = request.args.get('file', '')
    tf = _text_folder()
    file_path = os.path.realpath(os.path.join(tf, category, filename))
    if not file_path.startswith(os.path.realpath(tf) + os.sep):
        return jsonify({'error': 'Invalid path'}), 400
    try:
        lines = []
        with open(file_path, 'r') as f:
            for line in f:
                lines.append(simplify_cw_line(line).rstrip('\n'))
        return jsonify({'lines': lines, 'category': category, 'file': filename})
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404

