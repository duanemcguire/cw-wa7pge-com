from flask import render_template
from app.books import bp
from flask import Blueprint

books = Blueprint('books', __name__)
@bp.route('/winnie')
def index():
    return render_template('books/winnie.html')