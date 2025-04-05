from flask import request, session, abort
from flask_openapi3 import APIBlueprint, Tag
from pydantic import BaseModel
import logging

log = logging.getLogger(__name__)

book = APIBlueprint("book", __name__)
book_tag = Tag(name="book", description="Some Book")


class BookQuery(BaseModel):
    age: int
    author: str


@book.get("/", summary="get books", tags=[book_tag])
def get_book(query: BookQuery):
    """
    get all books
    """
    return {
        "code": 0,
        "message": "ok",
        "data": [
            {"bid": 1, "age": query.age, "author": query.author},
            {"bid": 2, "age": query.age, "author": query.author},
        ],
    }
