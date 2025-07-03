from flask import render_template, request
import os
import random
from flask import Blueprint
import logging
log =  logging.getLogger(__name__)




phrases = Blueprint('phrases', __name__)

@phrases.route('/song-titles', methods=['GET', 'POST'])
def songtitles():

    
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = "text_files"

    wpm = request.form.get('wpm')
    wpm_options = [12,14,16,18,20,25,30,40]
    categories = sorted([f for f in os.listdir(TEXT_FOLDER)])
    log.debug(f"categories: {categories}")
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
                    line = line.replace("("," = ")
                    line = line.replace(")"," = ")
                    line = line.replace("’","'")
                    line = line.replace("&"," and ")
        except Exception as e:
            line = f"Error reading file: {e}"

    return render_template('phrases/song-cw-titles.html',
                           wpm_options=wpm_options, 
                           wpm=wpm, 
                           files=files,
                           categories=categories,
                           selected_category=selected_category, 
                           selected_file=selected_file, 
                           line=line)



@phrases.route('/song-titles-sending', methods=['GET', 'POST'])
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
    log.debug(f"selected_file: {selected_file}")
    if selected_file:
        file_path = os.path.join(category_dir, selected_file)
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    line = random.choice(lines).strip()
                    line = line.replace("’","'")
                    line = line.replace("&"," and ")
        except Exception as e:
            line = f"Error reading file: {e}"

    return render_template('phrases/song-titles-sending.html', 
        categories=categories,
        selected_category=selected_category,
        files=files, 
        selected_file=selected_file, 
        line=line)

