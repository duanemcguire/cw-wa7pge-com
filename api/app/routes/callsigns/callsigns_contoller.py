from flask import render_template
from app.callsigns import bp

@bp.route('/trainer')
def index():
    return render_template('callsigns/callsign-trainer.html')