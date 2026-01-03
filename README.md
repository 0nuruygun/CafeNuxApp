# CafeNux Cafe System

## Setup
```ini
# .dotenv settings
DB_USER="sa"
DB_PWD="password"
DB_NAME="Cafe"
DB_SERVER="localhost"

DEBUG=true
PORT=3001

# Unused currently, captcha and user auth files refer to this.
CAPTCHA_SEC=""
AUTHURL=""
```

```bash
$ npm i        # install dependencies
$ node app.js  # or press F5 on project for debugging
$ # --------
> # If the app does not run, it could be that you are missing 'dotenv' package because someone force pushed or rebased or did a git something, to fix that :
> npm i dotenv 
```

## TODO
* [X] Trim date formatting to normal in date columns
* [X] Select name column for foreign key correpsonding ID owner tables
* * [X] Select displayValue column for primary table displays
* * [X] Select displayValue column for add/update dialogs (todo: bug test)
* [`-`] Add relational table interactions (basic)
* * [X] Implement FKeys for all Add and Update
* * [X] Fix 'datetime-local' not passing seconds (mssql is angry about it)
* * [X] Bug testing
* * [ ] Add checkbox on 'Delete' action form for removing all fkey references to the delete recipient so that the element can be deleted at all costs.
* * [ ] Add checkbox on 'Update' action form for changing all fkey values that refer to it. (note : needs to be done recursively for other tables, if other table's fkey reference that is being referred by other fkeys is changed then all of those should be changed, no data must be deleted)
* [ ] Optimizations
* * [ ] Load tables iteratively when scrolled (current version loads all values)
* * [ ] Cache table layouts
* * [ ] Improve interaction to the SQL database
* * [ ] Improve some code that does linear searches (either `new Map()` or binary search)
---
* [ ] Plan out better file structure for project (put all table views inside 'table/&lt;view name&gt;')
* [ ] Plan out a source generator (dynamically generate add/update/delete forms from code, cache the results. use JSDOM? or any XML parser for that matter, use partial modules)
* [ ] Add more complex table interactions (i.e refer a significant table value for the select fields, maybe create a foreign key table previewer inside &lt;select&gt;)
* * [ ] A userscript table unit test (or maybe JSDOM/selenium?)
