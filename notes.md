Command to count phrases:
cd api/app/routes/phrases/text_files
```
find .   -type d \( -name "Word" \) -prune   -o -type f -exec wc -l {} + 
```

2/12/26 result: 
```
    99 ./Saying/American Proverbs
   101 ./Saying/Aphorisms
    99 ./Saying/British Proverbs
    99 ./Saying/Biblical Proverbs
    49 ./Saying/Benjamin Franklin
   100 ./Brand Slogan/1970s
   103 ./Brand Slogan/1960s
   101 ./Brand Slogan/1950s
   104 ./Brand Slogan/1940s
   102 ./Brand Slogan/1990s
   101 ./Brand Slogan/1980s
    76 ./Limerick/Set 1
    19 ./Rhyming Couplet/Shakespeare
    93 ./Rhyming Couplet/Generic
    98 ./TV Show/1970s
    99 ./TV Show/1960s
    36 ./TV Show/TV Catchphrases
   100 ./TV Show/1990s
    99 ./TV Show/1980s
   100 ./TV Show/2000s
    53 ./Song Title/The Beatles
   100 ./Song Title/1930s
   100 ./Song Title/1970s
   100 ./Song Title/1960s
    70 ./Song Title/1910s
   102 ./Song Title/1950s
   103 ./Song Title/Classical
   100 ./Song Title/1940s
    31 ./Song Title/Neil Diamond
   188 ./Song Title/Tom Petty
   100 ./Song Title/1920s
     6 ./Song Title/Iggy Pop
   100 ./Song Title/1990s
   100 ./Song Title/1980s
    99 ./Song Title/1900s
    98 ./Song Title/Johnny Cash
   104 ./Song Title/1890s
    81 ./Song Title/Lyle Lovett
   100 ./Song Title/2000s
   211 ./Song Title/Jazz Standards
    44 ./Pangram/All
   103 ./Movie/Catch Phrases
   102 ./Movie/1970s
   102 ./Movie/1960s
    99 ./Movie/1950s
   100 ./Movie/1940s
   100 ./Movie/1990s
   101 ./Movie/1980s
   100 ./Movie/2000s
   100 ./Experimental/Address
   299 ./Experimental/Vehicle ID number
   100 ./Experimental/Math Problem
    97 ./Person/Modern
    99 ./Person/Historical
   102 ./Book Title/Thriller
   103 ./Book Title/Crime
   102 ./Book Title/Classics
   102 ./Book Title/Literary Fiction
   102 ./Book Title/Science Fiction
   100 ./Book Title/Ham Radio
   100 ./Book Title/Mystery
   100 ./Book Title/Historical Fiction
   100 ./Book Title/Fantasy
    48 ./Common Phrase/Level I
   100 ./Common Phrase/Level II
   100 ./Common Phrase/Level III
   189 ./Sentence/3-letter words
   199 ./Sentence/5-letter words - I
   199 ./Sentence/5-letter words - II
   199 ./Sentence/5-letter words - III
   400 ./Binomial Phrase/Level I
    99 ./Binomial Phrase/Level II
  7714 total
```cd 

Google Analytics: 
What was implemented
Template	Event	Parameters
copying.html	cw_session_start on first phrase	tool, wpm, category, collection
sending.html	cw_session_start on first phrase	tool, category, collection
ttr.html	cw_session_start on Play	tool, wpm, collection
ttr.html	cw_session_stop on Stop	tool, wpm, collection, duration_seconds
phrase-flow.html	cw_session_start on Play	tool, wpm, category, collection
phrase-flow.html	cw_session_stop on Stop	tool, wpm, category, collection, duration_seconds
callsign-trainer.html	cw_session_start on Start	tool, wpm
callsign-trainer.html	cw_session_stop on Stop	tool, wpm, duration_seconds
garden.html	cw_session_start on Play	tool, book, verse, wpm
In GA4 you'll find these under Events → cw_session_start / cw_session_stop. You can then use tool as a dimension to break down which tools are used, and wpm as a metric/dimension to see what speeds people practice at. The duration_seconds on stop events lets you build engagement time charts for the flow-style tools.

are these events collected when the user is offline?
No. When the user is offline, GA events are silently dropped.

Here's why: the service worker in sw.js:166 only handles same-origin requests. GA hits go to google-analytics.com (cross-origin), so the SW passes them straight to the network — and when there's no network, they fail and disappear with no retry.

For a practice tool where offline use is a feature, this means any session that happens fully offline produces no GA data at all.

The fix would be Background Sync: intercept failed GA requests in the service worker, store them in IndexedDB, and replay them when connectivity returns. It's non-trivial to implement correctly, and GA4 may also reject hits that arrive with a significant timestamp delay.

For a CW practice app, the data loss is probably acceptable — you'll still get good signal from online sessions, and the usage patterns (which tools, which WPM) are unlikely to differ systematically between online and offline users. I'd hold off on implementing Background Sync unless you find the offline population is large enough to skew your data.

The events should start showing up in GA4 within a day or two under Explore → Free Form with event_name as a dimension.