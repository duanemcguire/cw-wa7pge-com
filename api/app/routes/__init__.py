from .hello.hello_controller import hello
from .phrases.phrases_controller import phrases
from .callsigns.callsigns_controller import callsigns
from .books.books_controller import  books
from .main.main_controller import main
from flask import redirect
import logging

log = logging.getLogger(__name__)


def setup_routes(app):
    app.register_blueprint(hello, url_prefix="/hello")
    app.register_blueprint(main, url_prefix="/")
    app.register_blueprint(books, url_prefix="/books")
    app.register_blueprint(callsigns, url_prefix="/callsigns")
    app.register_blueprint(phrases, url_prefix="/phrases")



    
    log.info(app.url_map)
