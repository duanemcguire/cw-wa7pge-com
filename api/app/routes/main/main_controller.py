from flask import render_template
from flask import Blueprint
main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/user-guide')
@main.route('/user-guide/')
def user_guide():
    return render_template('user-guide.html')