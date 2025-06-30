from app.main import bp
from flask import render_template
from flask import Blueprint
main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')