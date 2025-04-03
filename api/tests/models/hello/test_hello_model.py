# tests/test_hello_model.py
import os
import pytest
from datetime import datetime

# Import the functions you want to test.
from app.models.hello.hello_model import (
    create_tables_hello,
    log_user_encounter,
    count_user_encounters,
    top_visitors,
)
from app.lib.db import db

# A module-scoped fixture to set up the database tables once.
@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # Ensure that the hello-related tables exist.
    create_tables_hello()
    # Optionally, clean up the visitor table before starting tests.
    with open("/tmp/cleanup.sql", "w") as f:
        # Write your cleanup SQL commands, if needed.
        pass
    yield
    # Optionally, perform any teardown actions here.


@pytest.fixture(autouse=True)
def truncate_tables():
    """Clear the test db tables before each test to ensure isolation."""
    with db() as conn:
        conn.cursor().execute("TRUNCATE TABLE visitor RESTART IDENTITY;")
        conn.commit()
    yield


def test_log_and_count_user_encounter():
    username = "testuser"
    salutation = "hello"
    ip_address = "127.0.0.1"

    # First, ensure that the user has no prior encounters.
    initial_count = count_user_encounters(username)
    assert initial_count == 0, "User should start with zero encounters."

    # Log a new encounter.
    log_user_encounter(username, salutation, ip_address)

    # Now, the count should have increased by 1.
    new_count = count_user_encounters(username)
    assert (
        new_count == initial_count + 1
    ), "User encounter count should increment by one."

    # Log a new encounter.
    log_user_encounter(username, salutation, ip_address)

    # Now, the count should be 2.
    new_count = count_user_encounters(username)
    assert (
        new_count == initial_count + 2
    ), "User encounter count should have incremented twice."


def test_multiple_user_encounters():
    # Define multiple users with their corresponding salutation and IP.
    users = [
        ("alice", "hello", "127.0.0.1"),
        ("bob", "hi", "127.0.0.2"),
        ("charlie", "greetings", "127.0.0.3"),
    ]

    # Log one encounter for each user.
    for username, salutation, ip in users:
        log_user_encounter(username, salutation, ip)
        # After the first encounter, each user's count should be 1.
        assert (
            count_user_encounters(username) == 1
        ), f"{username} should have 1 encounter."

    # Log additional encounters for 'alice' to test sequential updates.
    for _ in range(2):
        log_user_encounter("alice", "hello", "127.0.0.1")
    # Now, alice should have 3 encounters in total.
    assert count_user_encounters("alice") == 3, "Alice should have 3 encounters."

    # Retrieve the top visitors list.
    visitors = top_visitors()

    # Verify each user's encounter count.
    expected_counts = {"alice": 3, "bob": 1, "charlie": 1}
    # Build a dictionary of user counts from the visitors list.
    visitor_counts = {
        entry["name"]: entry["total_visits"]
        for entry in visitors
        if entry["name"] in expected_counts
    }
    assert (
        visitor_counts == expected_counts
    ), f"Expected counts {expected_counts}, but got {visitor_counts}"


def test_top_visitors():
    username = "visitor1"
    salutation = "hi"
    ip_address = "127.0.0.1"

    # Log multiple encounters for this user.
    for _ in range(3):
        log_user_encounter(username, salutation, ip_address)

    # Call the function to get the top visitors.
    visitors = top_visitors()
    # Find our test user in the results.
    visitor_entry = next(
        (entry for entry in visitors if entry["name"] == username), None
    )
    assert (
        visitor_entry is not None
    ), "Test user should appear in the top visitors list."
    # Check that the total visits equals the expected number (3, or more if previous tests also logged for this user)
    assert (
        visitor_entry["total_visits"] >= 3
    ), "User's visit count should be at least 3."
