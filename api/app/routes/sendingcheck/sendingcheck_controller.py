from flask import render_template, Blueprint

sendingcheck = Blueprint('sendingcheck', __name__)

@sendingcheck.route('/')
def index():
    return render_template('sendingcheck/sendingcheck.html',
                           page_title='CW Sending Check')
