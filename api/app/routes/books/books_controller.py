from flask import render_template
from flask import Blueprint

books = Blueprint('books', __name__)
@books.route('/winnie')
def index():
    return render_template('books/winnie.html')