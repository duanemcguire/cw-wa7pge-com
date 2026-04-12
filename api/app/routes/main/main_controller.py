from flask import render_template, send_from_directory, make_response
from flask import Blueprint
import os
main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/user-guide')
@main.route('/user-guide/')
def user_guide():
    return render_template('user-guide.html')


@main.route('/sw.js')
def service_worker():
    """Serve the service worker from root scope with required headers."""
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'static'))
    resp = make_response(send_from_directory(static_dir, 'sw.js'))
    resp.headers['Content-Type'] = 'application/javascript'
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp
