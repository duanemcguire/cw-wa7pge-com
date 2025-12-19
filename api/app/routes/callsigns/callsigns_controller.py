from flask import render_template
from flask import Blueprint

callsigns = Blueprint('callsigns', __name__)

@callsigns.route('/trainer')
def index():
    return render_template('callsigns/callsign-trainer.html',
        page_title = 'CW Callsign Practice')