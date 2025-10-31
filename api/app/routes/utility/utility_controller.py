from flask import render_template, request
from flask import Blueprint
import logging
from ics import Calendar
import pytz
from datetime import datetime
from pytz import timezone
from collections import defaultdict
import requests
import re

log =  logging.getLogger(__name__)
utility = Blueprint('utility', __name__)

def remove_html(text):
    """
    Removes HTML tags from a string using regular expressions.
    """
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)


@utility.route('/licw-classes', methods=['GET','POST'])
def licw_classes():
    now_utc = datetime.now(pytz.UTC)

    # URL of the ICS file
    #all
    #beginner-only
    #intermediate
    #advanced
    calEvents = {}
    caltype = ""
    user_tz = "America/New_York"
    tz_choices = ["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Phoenix"]
    if len(request.form) > 0:
        caltype = request.form.get('caltype')
        user_tz = request.form.get('user_tz')
        ics_url = f"https://cal.longislandcwclub.org/{request.form.get('caltype')}"

        # Download the ICS file content
        response = requests.get(ics_url)
        response.raise_for_status()  # raise error if download failed

        # Parse the ICS calendar
        calendar = Calendar(response.text)


        # Display events in user timezone
        results = []
        for event in calendar.events:
            start_utc = event.begin.astimezone(pytz.utc)
            start_local = start_utc.astimezone()
            days_diff = (now_utc - event.begin).days
            if days_diff < 0 and days_diff > -8:
                # getting next 7 days
                if event.name[:1] != "[": 
                    log.debug(event.name) 
                    log.debug(" ")
                    # not cancelled or summer break
                    room = ""
                    className = event.name.strip()
                    if 'Zoom' in event.name: 
                        room = event.name[-6:]
                        className = event.name.strip()[:-8]
                    results.append([className, event.begin.datetime.astimezone(pytz.timezone(user_tz)), room, remove_html(event.description.replace("\\",""))])
        results.sort()
        results2 = []
        for row in results:
            row2 = [row[0], [f"{row[1].strftime('%A, %B %d %I:%M %p %Z')} - {row[2]} ", row[3]]]           
            results2.append(row2)
        calEvents = defaultdict(list)
        for key, value in results2:
            calEvents[key].append(value)
        
    


 
    return render_template('utility/licw_classes.html',
                calEvents=calEvents,
                caltype=caltype,
                tz_choices=tz_choices,
                user_tz=user_tz)

