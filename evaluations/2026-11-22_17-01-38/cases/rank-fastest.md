# rank-fastest

- **Group:** G7-rank
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "get_enplanements",
      "optional": true
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Gives a ranked list with real growth figures",
    "Does NOT answer from general knowledge"
  ],
  "mustNot": [
    "Say figures are approximate/from memory",
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which large hub airports have grown the fastest since 2015?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"West Coast"})`, `find_airports_by_region({"region":"East Coast"})`, `find_airports_by_region({"region":"Midwest"})`, `find_airports_by_region({"region":"Southeast"})`, `find_airports_by_region({"region":"Southwest"})`, `find_airports_by_region({"region":"Mountain West"})`
  - find_airports_by_region → ok: {"region":"West Coast","matchedAs":"region","cities":["Seattle","Portland","San Francisco Bay Area","Los Angeles","San Diego"],"results":{"Seattle":{"matchedAs":"metro","airports":[{"code":"SEA","name":"Seattle-Tacoma International","city":"Seattle","state":"WA","hubType":"L","latestEnplanements":25414592,"secondary":false}]},"Portland":{"matchedAs":"metro","airports":[{"code":"PDX","name":"Portla…
  - find_airports_by_region → ok: {"region":"East Coast","matchedAs":"region","cities":["Boston","Providence","New York","Philadelphia","Baltimore","Washington DC","Norfolk","Charleston","Savannah","Jacksonville","Orlando","Miami","West Palm Beach"],"results":{"Boston":{"matchedAs":"metro","airports":[{"code":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","latestEnplanements":…
  - find_airports_by_region → ok: {"region":"Midwest","matchedAs":"region","cities":["Chicago","Detroit","Minneapolis","St. Louis","Kansas City","Indianapolis","Cleveland","Cincinnati","Columbus","Milwaukee","Omaha","Des Moines","Madison","Grand Rapids"],"results":{"Chicago":{"matchedAs":"metro","airports":[{"code":"ORD","name":"Chicago O'Hare International","city":"Chicago","state":"IL","hubType":"L","latestEnplanements":38575693…
  - find_airports_by_region → ok: {"region":"Southeast","matchedAs":"region","cities":["Atlanta","Charlotte","Raleigh-Durham","Nashville","Orlando","Tampa","Miami","Jacksonville","Charleston","Savannah","Birmingham","Memphis","Louisville","New Orleans","Fort Myers","West Palm Beach"],"results":{"Atlanta":{"matchedAs":"metro","airports":[{"code":"ATL","name":"Hartsfield/Jackson Atlanta International","city":"Atlanta","state":"GA","…
  - find_airports_by_region → ok: {"region":"Southwest","matchedAs":"region","cities":["Phoenix","Tucson","Albuquerque","Las Vegas","El Paso"],"results":{"Phoenix":{"matchedAs":"metro","airports":[{"code":"PHX","name":"Phoenix Sky Harbor International","city":"Phoenix","state":"AZ","hubType":"L","latestEnplanements":25595723,"secondary":false}]},"Tucson":{"matchedAs":"metro","airports":[{"code":"TUS","name":"Tucson International",…
  - find_airports_by_region → ok: {"region":"Mountain West","matchedAs":"region","cities":["Denver","Salt Lake City","Boise","Las Vegas","Phoenix","Albuquerque","Billings","Bozeman","Colorado Springs"],"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]},"Salt Lake City":{"matchedAs":"metro","ai…

**Agent answer:**

_(empty)_
