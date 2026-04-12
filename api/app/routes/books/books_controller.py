from flask import render_template, request, jsonify
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


def verses(text_dir, verse_term, book_title, book_key):
    verse_list, TEXT_FOLDER = get_verse_files(text_dir)
    selectedWPM = request.values.get("wpm", "20")
    selectedWS = request.values.get("ws", "1")
    ws_options = ["1","1.2","1.4","1.6","1.8","2","2.2","2.4","2.6","2.8","3.0"]
    return render_template('books/garden.html',
        verses=verse_list,
        ws_options=ws_options,
        book_title=book_title,
        verse_term=verse_term,
        book_key=book_key,
        selectedWPM=selectedWPM,
        selectedWS=selectedWS,
        page_title="CW " + book_title
        )


@books.route('/')
def index():
    return render_template('books/index.html', page_title = "CW Books")

@books.route('/garden', methods=['GET', 'POST'])
def garden():
    return verses('garden_text', 'Verse', "A Child's Garden of Verses", 'garden')

@books.route('/princess_of_mars', methods=['GET', 'POST'])
def princess():
    return verses('princess_of_mars_text', 'Chapter/Part', "The Princess of Mars", 'princess_of_mars')

@books.route('/wisteria', methods=['GET', 'POST'])
def wisteria():
    return verses('ACD-Wisteria-Lodge', 'Part', "Wisteria Lodge - Arthur Conan Doyle", 'wisteria')

@books.route('/peter_pan', methods=['GET', 'POST'])
def peterpan():
    return verses('peter_pan_text', 'Part', "Peter Pan -- J.M. Barrie", 'peter_pan')

@books.route('/aesops_fables', methods=['GET', 'POST'])
def aesop():
    return verses('aesops_fables', 'Fable', "Aesop's Fables", 'aesops_fables')


# ── Offline / PWA API ─────────────────────────────────────────────────────────

_BOOK_CONFIGS = [
    ('garden',           'garden_text',          'Verse',        "A Child's Garden of Verses"),
    ('aesops_fables',    'aesops_fables',         'Fable',        "Aesop's Fables"),
    ('peter_pan',        'peter_pan_text',        'Part',         "Peter Pan"),
    ('wisteria',         'ACD-Wisteria-Lodge',    'Part',         "Wisteria Lodge"),
    ('princess_of_mars', 'princess_of_mars_text', 'Chapter/Part', "The Princess of Mars"),
]


@books.route('/api/index')
def api_index():
    result = []
    for key, text_dir, verse_term, title in _BOOK_CONFIGS:
        verse_list, _ = get_verse_files(text_dir)
        result.append({
            'key': key,
            'title': title,
            'verse_term': verse_term,
            'verses': [{'file_name': v.file_name, 'display_name': v.display_name}
                       for v in verse_list],
        })
    return jsonify({'books': result})


@books.route('/api/data')
def api_data():
    book_key = request.args.get('book', '')
    verse_file = request.args.get('verse', '')
    text_dir_map = {key: td for key, td, _, _ in _BOOK_CONFIGS}
    text_dir = text_dir_map.get(book_key)
    if not text_dir:
        return jsonify({'error': 'Unknown book'}), 404
    _, TEXT_FOLDER = get_verse_files(text_dir)
    abs_folder = os.path.realpath(TEXT_FOLDER)
    abs_file = os.path.realpath(os.path.join(TEXT_FOLDER, verse_file))
    if not abs_file.startswith(abs_folder + os.sep):
        return jsonify({'error': 'Invalid path'}), 400
    try:
        with open(abs_file, 'r') as f:
            text = f.read()
        cw = text.replace('\n', '   ').replace('"', '')
        return jsonify({'text': text, 'cw': cw})
    except FileNotFoundError:
        return jsonify({'error': 'Verse not found'}), 404
