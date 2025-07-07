from ics import Calendar
import pytz
from datetime import datetime
from pytz import timezone
from collections import defaultdict
import requests

now_utc = datetime.now(pytz.UTC)

# Prompt user for timezone
print("Enter your timezone (e.g., 'America/Chicago', 'Europe/London'):")
user_tz_input = input().strip()

# Validate timezone
if user_tz_input not in pytz.all_timezones:
    print(f"Invalid timezone. Try one from {pytz.all_timezones}.")
    exit()

# URL of the ICS file
#all
#beginner-only
#intermediate
#advanced

ics_url = "https://cal.longislandcwclub.org/all"

# Download the ICS file content
response = requests.get(ics_url)
response.raise_for_status()  # raise error if download failed

# Parse the ICS calendar
calendar = Calendar(response.text)


user_tz = timezone(user_tz_input)

# Load ICS file

# Display events in user timezone
results = []
for event in calendar.events:
    start_utc = event.begin.astimezone(pytz.utc)
    end_utc = event.end.astimezone(pytz.utc)

    start_local = start_utc.astimezone(user_tz)
    end_local = end_utc.astimezone(user_tz)

    days_diff = (now_utc - event.begin).days
    # Friendly display

    # if days_diff < 0 and days_diff > -8:
    #     print(f"Event: {event.name}")
    #     print(f"Days Diff: {days_diff}")
    #     print(f"When: {start_local.strftime('%A, %B %d, %Y at %I:%M %p %Z')} ")
    #     print("-" * 50)
    if days_diff < 0 and days_diff > -8:
        if event.name[:1] != "[":  
            # not cancelled or summer break
            room = ""
            className = event.name
            if 'Zoom' in event.name: 
                room = event.name[-6:]
                className = event.name[:-8]
            results.append([className,[event.begin,room]])
    grouped = defaultdict(list)
    for key, value in results:
        grouped[key].append(value)
    calEvents = dict(sorted(grouped.items(),key=lambda item: item[0]))
    for key, values in calEvents.items():
        vals = sorted(values)
        print(key)
        for value in vals:
            start_utc = value[0].astimezone(pytz.utc)
            start_local = start_utc.astimezone(user_tz)

            print(f"    {start_local.strftime('%A, %B %d %I:%M %p %Z')} - {value[1]}")         

