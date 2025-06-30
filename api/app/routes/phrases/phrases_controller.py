from flask import Flask, render_template, request, current_app
import os, sys
import random
import logging
from flask import Blueprint

phrases = Blueprint('phrases', __name__)
TEXT_FOLDER = '/static/text_files'

@phrases.route('/song-titles', methods=['GET', 'POST'])
def songtitles():
    files = sorted([f for f in os.listdir(TEXT_FOLDER)])
    selected_file = request.form.get('filename')
    wpm = request.form.get('wpm')
    wpm_options = [12,14,16,18,20,25,30,40]
    line = None

    if selected_file:
        file_path = os.path.join(TEXT_FOLDER, selected_file)
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    line = random.choice(lines).strip()
        except Exception as e:
            line = f"Error reading file: {e}"

    return render_template('phrases/song-cw-titles.html',
                           wpm_options=wpm_options, 
                           wpm=wpm, 
                           files=files, 
                           selected_file=selected_file, 
                           line=line)



@phrases.route('/song-titles-sending', methods=['GET', 'POST'])
def song_titles_sending():
    files = sorted([f for f in os.listdir(TEXT_FOLDER)])
    selected_file = request.form.get('filename')
    line = None

    if selected_file:
        file_path = os.path.join(TEXT_FOLDER, selected_file)
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    line = random.choice(lines).strip()
        except Exception as e:
            line = f"Error reading file: {e}"

    return render_template('phrases/song-titles-sending.html', files=files, selected_file=selected_file, line=line)

