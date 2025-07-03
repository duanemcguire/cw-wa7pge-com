from flask import render_template, request
import os
from flask import Blueprint
import logging
log =  logging.getLogger(__name__)

books = Blueprint('books', __name__)
@books.route('/winnie')
def winnie():
    return render_template('books/winnie.html')

@books.route('/garden', methods=['GET', 'POST'])
def garden():
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = "../../static/garden_text"
    versedir = sorted([f for f in os.listdir(TEXT_FOLDER)])
    verses = []
    for f in versedir:
        el = []
        el.append(f)
        versename = f.split(".")[0]
        versename = versename.replace("_"," ").title()
        el.append(versename)
        verses.append(el)
    selectedVerse = request.form.get("verseSelect")
    selectedWPM = request.form.get("wpm")
    if not selectedWPM: 
        selectedWPM = "20"
    verseText = ""
    verseCW = ""
    if selectedVerse:
        versePath = os.path.join(TEXT_FOLDER,selectedVerse)
        try:
            with open(versePath, 'r') as f:
                verseText = f.read();
        except Exception as e:
            verseText = f"Error: selected verse not found."
            verseCW = "Error"
        verseCW = verseText.replace("\n","   ")        
    return render_template('books/garden.html', verses=verses, 
        verseText=verseText,
        verseCW=verseCW, 
        selectedVerse=selectedVerse,
        selectedWPM=selectedWPM*1
        )