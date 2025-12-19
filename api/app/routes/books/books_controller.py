from flask import render_template, request
import os
from flask import Blueprint
import logging
import re
log =  logging.getLogger(__name__)

books = Blueprint('books', __name__)

class Verse:
    def __init__(self, key="", file_name="", display_name=""):
        self.key = key
        self.file_name = file_name
        self.display_name = display_name

    def __repr__(self):
        return f"Verse(name='{self.name}', key={self.key}, file_name={self.file_name}, display_name={self.display_name})"

def get_verse_files(text_dir):
    current_file = os.path.abspath(__file__)
    current_dir = os.path.dirname(current_file)
    os.chdir(current_dir)
    TEXT_FOLDER = f"../../static/{text_dir}"
    versedir = os.listdir(TEXT_FOLDER)
    verses = []
    match text_dir:
        case "garden_text" | "aesops_fables":
            versedir = os.listdir(TEXT_FOLDER)
            for f in versedir:
                verse = Verse()
                verse.key = f
                verse.file_name = f
                versename = f.split(".")[0]
                versename = versename.replace("_"," ").title()
                verse.display_name = versename
                verses.append(verse)
            verses.sort(key=lambda verse: verse.key)            
        case "princess_of_mars_text":
            versedir = os.listdir(TEXT_FOLDER)
            for f in versedir:
                log.debug(f)
                verse = Verse()
                verse.file_name = f
                fn = f.split(".")[0]
                pieces = fn.split("_")
                chapter = ""
                part = ""
                chapter_display = ""
                if pieces[1] == 'foreword':
                    chapter = "000"
                    chapter_display = "Forward"
                else:
                    chapter = re.findall(r'\d+',pieces[1])[0]
                    chapter_display = f"Chapter {chapter}"
                    chapter = chapter.zfill(3)
                part = re.findall(r'\d+',pieces[2])[0]
                part_display = f"Part {part}"
                part = part.zfill(3) 
                verse.key = chapter + part
                verse.display_name = f"{chapter_display} {part_display}"    
                verses.append(verse)
                log.debug(verse.__str__)
            verses.sort(key=lambda v: v.key) 
        case "ACD-Wisteria-Lodge" | "peter_pan_text":
            versedir = os.listdir(TEXT_FOLDER)
            for f in versedir:
                if f.endswith(".txt"):
                    verse = Verse()
                    verse.key = f
                    verse.file_name = f
                    versename = f.split(".")[0]
                    versename = versename.replace("_"," ").title()
                    verse.display_name = versename
                    verses.append(verse)
            verses.sort(key=lambda verse: verse.key)            


        case _:
            verses.append(Verse())    
        
    
    return verses, TEXT_FOLDER



def verses(text_dir,verse_term,book_title):
    verses, TEXT_FOLDER = get_verse_files(text_dir)
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
        verseCW = verseText.replace("\n","   ").replace('"','')
    return render_template('books/garden.html', 
        verses=verses, 
        verseText=verseText,
        verseCW=verseCW, 
        selectedVerse=selectedVerse,
        selectedWPM=selectedWPM*1,
        book_title=book_title,
        verse_term=verse_term,
        page_title = "CW " + book_title
        )    

@books.route('/winnie')
def winnie():
    return render_template('books/winnie.html', page_title = "CW Winnie The Pooh")

@books.route('/garden', methods=['GET', 'POST'])
def garden():
    return verses('garden_text','Verse',"A Child's Garden of Verses")

@books.route('/princess_of_mars', methods=['GET', 'POST'])
def princess():
    return verses('princess_of_mars_text','Chapter/Part',"The Princess of Mars")

@books.route('/wisteria', methods=['GET','POST'])
def wisteria():
    return verses('ACD-Wisteria-Lodge','Part',"Wisteria Lodge - Arthur Conan Doyle")

@books.route('/peter_pan', methods=['GET','POST'])
def peterpan():
    return verses('peter_pan_text','Part',"Peter Pan -- J.M. Barrie")

@books.route('/aesops_fables', methods=['GET', 'POST'])
def aesop():
    return verses('aesops_fables','Fable',"Aesop's Fables")


