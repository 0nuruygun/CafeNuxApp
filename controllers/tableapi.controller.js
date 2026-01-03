const db = require("../routers/db");
const snt = require("../utils/sanitize");
const tutil = require("../utils/type");
const onlineUsers = require("../utils/global");

/**
 * @typedef {import("express").Request} EJSRequest
 * @typedef {import("express").Response} EJSResponse
 * @typedef {import("express").NextFunction} EJSNextFunction
 */

// #region Date Util
function convertDateToDMY(inputFormat) {
    function pad(s) { return (s < 10) ? '0' + s : s; };
    const d = inputFormat instanceof Date ? inputFormat : new Date(inputFormat);
    return [pad(d.getDate()), pad(d.getMonth()+1), d.getFullYear()].join('/');
}
// #endregion

// #region ExpressJS Util
/**
 * The default catch handler for Promise<>'s
 * 
 * @param {EJSNextFunction} next Next function of the ExpressJS.
 * @returns {function(any):void} The function that handles it.
 */
function defaultErrorHandler(next) {
    return (error) => {
        // console.error(error);
        if (!next) {
            console.error("=== dCatchHandler ===");
            console.trace("[!] next function not supplied.");
            console.error("=== dCatchHandler ===");
        } else {
            next(error);
        }
    };
}
// #endregion

/**
 * Get the list of the relational fields, if table is relational.
 *
 * @param {string} tableName
 * 
 * @returns {Promise<import("mssql").IRecordSet<{
 *     column: string,
 *     referencedTable: string,
 *     referencedColumn: string,
 * }>>}
 */
async function sqlGetForeignKeyReferences(tableName) {
    // First recordset is the one that's considered, as the 'SELECT' query is just once
    return (await db.execsql(`SELECT * FROM [dbo].[getForeignKeyReferences](${snt.toSqlString(tableName)})`))[0];
}

/**
 * Returns the formatted values to serve into the serving EJS value.
 * 
 * @param {ArrayLike<{
 *     column: string,
 *     referencedTable: string,
 *     referencedColumn: string,
 * }> | string} fkeys Values of the foreign keys. Either pass the result of `sqlGetForeignKeyReferences` 
 * or a string of the table name to get it's fkey references.
 * @param {(Object<string, string> | Map)?} tableDisplayColumnMap Table names paired with their column SELECT.
 * 
 * This is used to show display values.
 * If no display value was selected for the following foreign key, both values are set to be the same, with no alias specified.
 * 
 * @returns {Promise<Object<string, import("mssql").IRecordSet<{
 *     value: any,
 *     displayValue: any,
 * }>>>} Possible values for columns, with their pretty display names.
 */
async function sqlGetPossibleValuesForForeignKeys(fkeys, tableDisplayColumnMap, room) {
    if (typeof fkeys === "string") {
        // assume it's a table name and get the fkey refs
        fkeys = await sqlGetForeignKeyReferences(fkeys);
    }

    /** @type {(function(any):any)?} */
    let getDisplayColumnMapEntries;
    if (tableDisplayColumnMap) {
        if (!(tableDisplayColumnMap instanceof Map)) {
            getDisplayColumnMapEntries = function (key) {
                return tableDisplayColumnMap.find(([k, _v]) => k === key);
            };
        } else {
            // This requires the object reference, because in JS, 'this' refers to the callee object making assigning a function to a variable makes 'this' the variable that contains the function.
            // So we need to allocate more garbage, yay!
            // Thanks to the inefficient design that passes a whole object with a new delegate instead of just giving us a damn function pointer.
            getDisplayColumnMapEntries = (k) => tableDisplayColumnMap.get(k);
        }
    }

    let query = "";
    for (let i = 0; i < fkeys.length; i++) {
        const fkey = fkeys[i];
        const fkeyDisplay = getDisplayColumnMapEntries ? getDisplayColumnMapEntries(fkey.referencedTable) : undefined;

        const genTable = (fkey.referencedTable == 'TableStatus' || 
                          fkey.referencedTable == 'QuantityType' || 
                          fkey.referencedTable == 'PermissionsType'|| 
                          fkey.referencedTable == 'QuantityType' || 
                          fkey.referencedTable == 'OrderStatus' || 
                          fkey.referencedTable == 'MessageStatus') ? '' : `where Room='${room.roomId}'`
        
        if (fkeyDisplay) {
            query += `SELECT [${fkey.referencedColumn}] AS value, [${fkeyDisplay}] AS displayValue FROM ${fkey.referencedTable} ${genTable};\n`;
        } else {
            query += `SELECT [${fkey.referencedColumn}] AS value FROM ${fkey.referencedTable} ${genTable};\n`;
        }
    }


    /** @type {import("sql").IRecordSet<{ value: any, displayValue: any? }>} */
    const recordsets = await db.execsql(query);

    const result = {};
    for (let i = 0; i < recordsets.length; i++) {
        if (!recordsets[i].displayValue) {
            recordsets[i].displayValue = `value=${recordsets[i].value}`;
        }

        result[fkeys[i].column] = recordsets[i];
    }

    return Promise.resolve(result);
}
// #endregion

// #region Preset Route Handler
/**
 * @callback ColumnHandler
 * @param {string} column Name of the column.
 * @param {any | string} value Value of the column. Often times a string.
 * @param {number} index Index of the column.
 * @returns {any} Substitute value for the given column handler.
 */

/**
 * Handle given values from HTML dates.
 * 
 * @template T
 * @param {T} value
 * 
 * @returns {T} New date value that can be pushed to mssql. If not converted, same as previous.
 */
function HTMLDate2SQLDate(value) {
    // time portion : (\d{4})(?:-)?(\d{2})(?:-)?(\d{2})         => Group: 0..2
    // date portion : (?:T(\d{2})(?::)?(\d{2})(?::)?(\d{2})?)?  => Group: 3..5 (optional)
    // yes i let the cat walk on top of the keyboard :) It makes sense once you look into it though..
    const isRFC3339LikeTimeRegex = /(\d{4})(?:-)?(\d{2})(?:-)?(\d{2})(?:T(\d{2})(?::)?(\d{2})(?::)?(\d{2})?)?/; 

    // --
    // TODO : Get field types of the update/add form elements, when submitted, to make this faster, as this regex is O(N).
    // As a bandaid fix, just don't process strings longer than 20 chars. It should be good enough, but getting date intent will also help with conversion (probably)
    // --
    // When date formats are being INSERTed, MSSQL is very picky about those.. wasn't a database meant to help?
    // Yay, one more conversion, always wanted those.. Convert time to something that MSSQL understands.
    // Since we really don't know the underlying column type, always assume 'datetime', which is the worst.
    // Unless a 'date' entry is sent to us.
    // https://stackoverflow.com/questions/14119133/conversion-failed-when-converting-date-and-or-time-from-character-string-while-i
    // --
    // The date we get is already like iso8601 / rfc3339 like so we can just get it's values.
    // No extra processes are required for the string, we just need to correct it, so that's why i disassemble the time.
    if (value.length && value.length <= 20) {
        const isTimeValue = isRFC3339LikeTimeRegex.exec(value);
        if (isTimeValue) {
            // time/date
            const year = isTimeValue[1];
            const month = isTimeValue[2];
            const day = isTimeValue[3];
            // datetime-local
            let hour = isTimeValue[4];
            let min = isTimeValue[5];
            let sec = isTimeValue[6];

            if (!hour && !min && !sec) {
                // dashless date for mssql, becuase dashes are locale dependent for some reason.
                value = `${year}${month}${day}`;
            } else {
                // assume datetime-local and fill the undefined hh:mm:ss
                // As all time measures shall exist.
                hour = hour || "00";
                min = min || "00";
                sec = sec || "00";

                value = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
            }
        }
    }

    return value;
}

/**
 * @type {Map<string, string>}
 */
const getFmtSelectQueriesCache = new Map();
/**
 * Constructs the dynamic query string with formatted date formats. This is because SQL.
 * 
 * Use if formatted date is required. Results are to be cached if speed is required.
 * 
 * @param {string} tableName
 * 
 * @returns {Promise<string?>} This method is specifically noexcept. If an error occurs, it is outputted and null is returned
 */
async function constructFormattedSelectQuery(tableName, limit, selectAppend, room) {
    /** @type {import("mssql").IRecordSet<{ COLUMN_NAME: string, DATA_TYPE: string }>} */
    let columns;
    try {
        
        columns = (await db.execsql(
            `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ${snt.toSqlString(tableName)}`
        ))[0];
    } catch (err) {
        console.error(err);
        return null;
    }

    let result = "SELECT TOP(20)";
    for (let i = 0; i < columns.length; i++) {
        const column = columns[i];

        // Special formatting cases for certain data types..
        // SQL is bad, why we can't intercept default date formatting for wildcards...
        if (column.DATA_TYPE.includes("date")) {
            // oh wow, this converts actual SQL DATE into JS Date when served with mssql.
            // such api, much wow.
            result += `CONVERT(DATE, ${column.COLUMN_NAME}) AS ${column.COLUMN_NAME}`;
        } else {
            result += column.COLUMN_NAME;
        }

        if (i < (columns.length - 1)) {
            result += ",";
        } else {
            result += " ";
        }
    }
    if(limit){limit = `WHERE ${columns[0].COLUMN_NAME} < ${limit} and Room=${room.roomId}`}
    else{ limit =`WHERE Room='${room.roomId}'`}

    if (selectAppend) {limit += `and ${columns[0].COLUMN_NAME} = ${selectAppend}` ;}
    else{ limit+= `ORDER BY ${columns[0].COLUMN_NAME} DESC` }

    //Son eklenen kayıt en üstte çıkması gerektiği içi PK desc yapıldı //  ORDER BY ${columns[0].COLUMN_NAME} DESC
    result += `FROM ${snt.toSqlLiteral(tableName)} ${limit} `;
    return result;
}

/**
 * Serves select with custom format casting.
 * 
 * Also handles caching.
 * 
 * @param {function(string, boolean?):(Promise<void> | void)} serveFn The serve method that gets the `SELECT` query as it's parameter.
 * 
 * - This method either could be async or not be async but it's always `await`ed regardless.
 * - The serve's return value is ignored, but errors are handled for retrying.
 * - Second parameter basically states whether if it's in the fallback mode (usually wildcard `SELECT` query is given as main/first parameter)
 * @param {EJSNextFunction} next Error or middleware 
 * @param {string} tableName Name of the table.
 * @param {string | null | undefined} selectAppend String to append into the select query.
 * 
 * @returns {void} The method is self contained, handles most things.
 * 
 * It calls 'serveFn' when ready and handles it's errors.
 */
function serveFormattedSelect(serveFn, next, tableName, selectAppend, room, limit) {
    // 2 Methods to get formatted date from SQL :
    // - A : Specify the columns explicitly
    // - B : Weird stuff (https://stackoverflow.com/questions/25163529/how-to-format-a-wildcard-query-for-dates-in-ms-sql), which has no relation with what i am trying to do.
    // ---
    const literalTableName = snt.toSqlLiteral(tableName);
    let queryString = getFmtSelectQueriesCache.get(literalTableName);

    async function tryServe() {
        // The price i have to pay to make this api fool proof.. (against myself :/)
        // I apologize for this bad code. But it's better than how it was in it's previous state.
        try {
            // Iter 1
            await serveFn(queryString, false);
        } catch {
            try {
                // Iter 2, invalidate cache and try again
                const newQueryString = await constructFormattedSelectQuery(tableName, limit, selectAppend, room);
                queryString = newQueryString;
                
                getFmtSelectQueriesCache.set(literalTableName, queryString);

                await serveFn(queryString, false);
            } catch (error) {
                // Fail (Iter 3), wildcard mode
                // Don't handle this iteration's error. It is on the responsibility of the caller now.
                console.error(error);
                console.error("[tableapi::serveFormattedSelect] A second error has occured. Serving wildcard.\nThis will certainly break some things.");
            
                await serveFn(`SELECT * FROM ${literalTableName}`, true);
            }
        }
    }

    // We go with the method A, which contains the table columns.
    // It is also cached, if the query fails, construct and cache again.
    // If the query fails for the second time, with the newly constructed query,
    // use wildcard as fallback.
    //bura
    if (/*typeof queryString === "undefined"*/true) {
        constructFormattedSelectQuery(tableName,limit,selectAppend, room).then((newQueryString) => {
            queryString = newQueryString;

            getFmtSelectQueriesCache.set(literalTableName, queryString);
        
            tryServe().catch(defaultErrorHandler(next));
        });
    } else {
        tryServe().catch(defaultErrorHandler(next));
    }
}

/**
 * Get the main page for this table controller.
 * 
 * @param {string} renderViewPath
 * @param {string} tableName
 * @param {boolean} isRelational
 * @param {Object<string, string> | Map} tableDisplayColumnMap
 * 
 * @returns {function(EJSRequest, EJSResponse, EJSNextFunction):void}
 */


function getMain(renderViewPath, tableName, isRelational, tableDisplayColumnMap) {
    tutil.assertString("[tableapi::getMain] One of the arguments isn't string : #ARGS#", renderViewPath, tableName);

    return async (_req, res, next) => {
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === _req.sessionID);
 
        let limit =_req.query.lastId
        // PERF : Not performant :/, but we cannot set a 'global date format'.
        //        MSSQL returns anything that it thinks is good.
        /**
         * Primary serving method for flow control.
         * 
         * @param {string} queryString
         * @returns {Promise<void>}
         */
        async function serve(queryString) {
            // Gather the main columns
            const result = await db.execsql(queryString);
            let data = {};
            data.columnData = result[0];

            /** @type {Object<string, import("mssql").IRecordSet<{ value: any, displayValue: any }>> | undefined} */
            let possibleFKeyValues;
            if (isRelational && tableDisplayColumnMap) {
                possibleFKeyValues = await sqlGetPossibleValuesForForeignKeys(tableName, tableDisplayColumnMap, room);
            }

            // TODO : Very rudimentary fix, why doesn't sql return date as JS Date by default is beyond me.
            for (let i = 0; i < data.columnData.length; i++) {
                const row = data.columnData[i];
                const rowEntries = Object.entries(row);
                for (let j = 0; j < rowEntries.length; j++) {
                    const [rowKey, rowVal] = rowEntries[j];
                    
                    // TODO : Serve date as is to the '.ejs' handler.
                    if (rowVal instanceof Date) {
                        row[rowKey] = convertDateToDMY(rowVal);
                    }
                
                    // If one of the column data is a foreign key (isRelational), 
                    // apply alias columns for it's foreign keys,after getting potential values
                    // PERF : This won't be fast on larger sets.
                    // TODO : Perhaps serve the actual value to the handler '.ejs' to be able to sort by value on the DataTables?
                    if (possibleFKeyValues) {
                        const correspondingFKValue = possibleFKeyValues[rowKey]?.find((fKey) => fKey.value === rowVal);
                        if (correspondingFKValue) {
                            row[rowKey] = correspondingFKValue.displayValue;
                        }
                    }
                }
            }
            if(limit){
                res.send( JSON.stringify(data) );
            }
            else{
                //res.cookie('Lang','tr', { maxAge: 900000, httpOnly: true });
                //res.setHeader('Set-Cookie', '1111111=22222222; HttpOnly');
                data.name = _req.session.name + " " + _req.session.lastname
                res.render(renderViewPath, { data });
            }
            
        }

        serveFormattedSelect(serve, next, tableName, undefined, room, limit);
    };
}

/**
 * @param {string} renderViewPath
 * @param {string} tableName Name of the table
 * @param {boolean?} isRelational Whether if the table is relational. If that is the case, extra relational fields from other referenced tables are served.
 * 
 * Set this true if the table is expected to have foreign keys.
 * @param {Object<string, string> | Map} tableDisplayColumnMap
 * 
 * @returns {function(EJSRequest, EJSResponse, EJSNextFunction):void}
 */
function getAddForm(renderViewPath, tableName, isRelational, tableDisplayColumnMap) {
    tutil.assertString("[tableapi::getAddForm] renderViewPath isn't string", renderViewPath);
    if (isRelational) {
        tutil.assertString("[tableapi::getAddForm] tableName isn't string", tableName);
    }

    // Since the layout of the table is not expected to change (as it's very difficult to alter table)
    // Maybe cache the results?
    // Well, better safe than sorry so no results are cached. This will be slower for some add forms

    return (_req, res, next) => {
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === _req.sessionID);
        let data;
        function serve() {
            res.render(renderViewPath, { data });
        }

        if (isRelational) {
            data = {};

            sqlGetPossibleValuesForForeignKeys(tableName, tableDisplayColumnMap, room).then((result) => {
                data.fkValues = result;
                serve();
            }).catch(defaultErrorHandler(next));
        } else {
            serve();
        }
    };
}
/**
 * @param {string} tableName Name of the table to insert into.
 * @param {string} redirectTarget URL to redirect to.
 * @param {ColumnHandler} columnHandler Custom column handler to change the added value.
 * 
 * @returns {function(EJSRequest, EJSResponse):void}
 */
function postDynamicAdd(tableName, redirectTarget, columnHandler) {
    tutil.assertString("[tableapi::postDynamicAdd] One of the arguments isn't string : #ARGS#", tableName, redirectTarget);

    return (req, res) => {
        
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
        req.body.Room = room.roomId;
        const entries = Object.entries(req.body);
        // construct a dynamic query depending on the request.
        let query = `INSERT INTO ${tableName}`;
        query += " (";
        for (let i = 0; i < entries.length; i++) {
            const key = entries[i][0];
            query += snt.toSqlLiteral(key);
        
            if (i < (entries.length - 1)) {
                query += ", ";
            }
        }
        query += ") VALUES (";
        for (let i = 0; i < entries.length; i++) {
            let value = entries[i][1];
            // handle conversion
            value = HTMLDate2SQLDate(value);
            if (columnHandler) {
                value = columnHandler(entries[i][0], value, i);
            }

            query += snt.toSqlString(value);
        
            if (i < (entries.length - 1)) {
                query += ", ";
            }
        }
        query += ")";

        db.execsql(query).then((_result) => {
            res.redirect(`${redirectTarget}/?success=true`);
        }).catch((error) => {
            console.error(error);
            res.redirect(`${redirectTarget}/?success=false`);
        });
    };
}

/**
 * @param {string} renderViewPath
 * @param {string} tableName
 * @param {string} idColumn 
 * @param {boolean?} isRelational
 * @param {Object<string, string>} tableDisplayColumnMap Column displays to show for the foreign keys.
 * 
 * Used to map table and column names for the foreign keys. If nothing is present, the value is passed as is.
 * 
 * @returns {function(EJSRequest, EJSResponse, EJSNextFunction):void}
 */
function getUpdateForm(renderViewPath, tableName, idColumn, isRelational, tableDisplayColumnMap) {
    tutil.assertString("[tableapi::getUpdateForm] One of the arguments isn't string : #ARGS#", renderViewPath, tableName, idColumn);

    
    return (req, res, next) => {
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);

        // !! : Only for 'GET' requests.
        const url = req.url.toLowerCase();
        const id = req.body.ID || url.substring(url.indexOf("?id=") + 4);
        let data = {};
        
        function serve(queryString) {
            db.execsql(queryString).then((result) => {
                data.values = result[0][0]; // First recordset > First column (TOP(1) anyways)
                res.render(renderViewPath, { data });
            }).catch(defaultErrorHandler(next));
        }

        // We need to pass extra data, then run the main query.
        if (isRelational) {
            sqlGetPossibleValuesForForeignKeys(tableName, tableDisplayColumnMap, room).then((result) => {
                data.fkValues = result;
                serveFormattedSelect(serve, next, tableName, id, room);
            }).catch(defaultErrorHandler(next));
        } else {
            serveFormattedSelect(serve, next, tableName, id, room);
        }
    };
}
/**
 * @param {string} tableName Name of the table to update.
 * @param {string} idColumn Name of the id column to target.
 * @param {string} redirectTarget URL to redirect to.
 * @param {ColumnHandler} columnHandler Callback to manipulate column values given for the key.
 * 
 * @returns {function(EJSRequest, EJSResponse):void}
 */
function postDynamicUpdate(tableName, idColumn, redirectTarget, columnHandler) {
    tutil.assertString("[tableapi::postDynamicUpdate] One of the arguments isn't string : #ARGS#", tableName, idColumn, redirectTarget);

    return (req, res) => {
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
        const ID = req.body[".ID"];
        req.body.Room = room.roomId;
        const entries = Object.entries(req.body);
        
        let query = `UPDATE ${tableName} SET `;
        for (let i = 0; i < entries.length; i++) {
            let [key, value] = entries[i];
            if (key === idColumn || key === ".ID") {
                continue;
            }
            // handle conversion/handlers
            value = HTMLDate2SQLDate(value);
            if (columnHandler) {
                value = columnHandler(key, value, i);
            }
            
            query += `[${snt.toSqlLiteral(key)}] = ${snt.toSqlString(value)}`;
        
            if (i < (entries.length - 1)) {
                query += ", ";
            }
        }
        query += ` WHERE [${idColumn}]=${snt.toSqlString(ID)}`;
    
        db.execsql(query).then((_result) => {
            res.redirect(`${redirectTarget}/?success=true`);
        }).catch((error) => {
            //bura
            console.error(error);
            res.redirect(`${redirectTarget}/?success=false`);
        });
    };
}

/**
 * @param {string} tableName Name of the table to update.
 * @param {string} idColumn Name of the id column to target.
 * @param {string} redirectTarget URL to redirect to.
 * 
 * @returns {function(EJSRequest, EJSResponse):void}
 */
function postDelete(tableName, idColumn, redirectTarget) {
    tutil.assertString("[tableapi::postDelete] One of the arguments isn't string : #ARGS#", tableName, idColumn, redirectTarget);

    return (req, res) => {
        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
        let ID = parseInt(req.body.ID);
        let query = `DELETE TOP(1) FROM ${tableName} WHERE [${idColumn}]=${ID} and Room = '${room.roomId}'`;
    
        db.execsql(query).then((_result) => {
            res.send(true)
        }).catch((err)=>{
            res.status(500).send('Something broke!')
        })
    };
}
// #endregion

/**
 * @template {function(EJSRequest, EJSResponse, EJSNextError?):(Promise<any>|void)} THandler
 * @typedef {Object} URLRoutedController A controller that can be iteratively registered, with it's own specified route.
 * 
 * @property {string} routeURL Route URL to use.
 * @property {string?} method Method to use. If this is falsy, assume GET.
 * @property {THandler} handler Handler that handles the expressJS route.
 */

/**
 * @typedef {Object} RoutedControllerConfig
 * @property {string} routeName Name of the route. This is used for the file name, the route name and other things that isn't the table.
 * @property {string?} routeURL URL of the route. This specifies the base url for the route. If left blank, is same as 'routeName'
 * @property {string?} routeRootURL Root of this route. Leaving blank means root is '/'.
 * 
 * @property {string} tableName Name of the table. Used for the table actions.
 * @property {string} tableIdColumn ID column of the table. This shouldn't be left blank, because async export is not possible.
 * @property {boolean?} tableIsRelational Whether if table contains foreign keys. Omitting or passing false means no.
 * @property {(Object<string, string> | Map)?} tableDisplayColumnMap The column mapping used for the foreign key displays, to show the mapped target column's values on the &lt;select&gt; tag.
 * 
 * @property {{ matchTable: string | function(string):boolean, previewColumn: string }} relationalSelectPreview
 * Preview column value to show into the relational table selection values.
 * 
 * The version that uses a function is to get the name columns, if plausible. `deprecated` Scratch that for now.
 * 
 * @property {ColumnHandler} columnHandler A default custom column handler. Used as substitute for all, but no intention is known in this handler.
 * @property {ColumnHandler} addColumnHandler A custom column handler for the 'postDynamicAdd'
 * @property {ColumnHandler} updateColumnHandler A custom column handler for the 'postDynamicUpdate'
 */

/**
 * Creates a routed URL controller for given view name and table name.
 * 
 * Uses the conventions of this project, so it is a rigid structure.
 * @param {RoutedControllerConfig} c Config to use.
 * @returns {Object<string, URLRoutedController<function(EJSRequest, EJSResponse, EJSNextError?):(Promise<any>|void)>>}
 */
function createRoutedController(c) {
    // Set route root to be an empty string.
    if (!c.routeRootURL || (c.routeRootURL && c.routeRootURL.trim() === "/")) {
        c.routeRootURL = "";
    }
    if (!c.routeURL) {
        c.routeURL = c.routeName;
    }
    if (!c.tableIdColumn) {
        throw new Error(`[createRoutedControllerFor] No 'tableIdColumn' was declared for ${c.tableName}.`);
    }

    return {
        main: {
            routeURL: `${c.routeRootURL}/${c.routeURL}`,
            handler: getMain(`${c.routeName}/${c.routeName}.ejs`, c.tableName, c.tableIsRelational, c.tableDisplayColumnMap),
        },
        add: {
            routeURL: `${c.routeRootURL}/${c.routeURL}Add`,
            handler: getAddForm(`${c.routeName}/${c.routeName}Add.ejs`, c.tableName, c.tableIsRelational, c.tableDisplayColumnMap),
        },
        addPost: {
            routeURL: `${c.routeRootURL}/${c.routeURL}AddPost`,
            method: "POST",
            handler: postDynamicAdd(c.tableName, `${c.routeRootURL}/${c.routeName}`, c.addColumnHandler || c.columnHandler),
        },
        update: {
            routeURL: `${c.routeRootURL}/${c.routeURL}Update`,
            handler: getUpdateForm(`${c.routeName}/${c.routeName}Update.ejs`, c.tableName, c.tableIdColumn, c.tableIsRelational, c.tableDisplayColumnMap),
        },
        updatePost: {
            routeURL: `${c.routeRootURL}/${c.routeURL}UpdatePost`,
            method: "POST",
            handler: postDynamicUpdate(c.tableName, c.tableIdColumn, `${c.routeRootURL}/${c.routeName}`, c.updateColumnHandler || c.columnHandler),
        },
        deletePost: {
            routeURL: `${c.routeRootURL}/${c.routeURL}DeletePost`,
            method: "POST",
            handler: postDelete(c.tableName, c.tableIdColumn, `${c.routeRootURL}/${c.routeName}`),
        }
    };
}

/**
 * Handles checkbox columns.
 * 
 * This is required, because for some reason the people designing at HTML5
 * thought it's a good idea to not send anything if &lt;input type="checkbox"&gt; element is not checked.
 * 
 * This handles the &lt;input type="hidden"&gt; hack.
 * 
 * @param {string|string[]} cbColNames Names of the column(s). Can be a singular name.
 * 
 * @returns {ColumnHandler} The created column handler predicate.
 */
function checkboxColumnHandler(cbColNames) {
    const isArrayMode = Array.isArray(cbColNames);
    return (col, v) => {
        const isColumnCheckbox = isArrayMode ? cbColNames.includes(col) : col === cbColNames;

        if (isColumnCheckbox) {
            // ExpressJS passes the value of multiple same key form submits as array.
            // i.e. :
            // 2 form elements with same name are sent as "key:value1, value2"
            // ExpressJS turns it into an array, after unescaping ofc.
            // ---
            if (Array.isArray(v)) {
                v = v[0];
            }
            switch (v) {
                case "on":
                    v = 1;
                    break;
                case "off":
                    v = 0;
                    break;
            }
        }

        return v;
    };
}

const routeRoot = "";
/**
 * Names used for the display column name for the foreign key value selections.
 * 
 * This can also be an Object<string, string>, at the cost of performance.
 */
const tableDisplayColumns = new Map();
tableDisplayColumns.set("Categories", "CategoryName");
tableDisplayColumns.set("Channels", "ChannelName");
tableDisplayColumns.set("Companies", "CompanyName");
tableDisplayColumns.set("GeneralStatus", "GeneralStatusName");
tableDisplayColumns.set("MessageStatus", "MessageStatusName");
tableDisplayColumns.set("OrderStatus", "OrderStatusName");
tableDisplayColumns.set("PermissionsType", "PermissionsTypeName");
tableDisplayColumns.set("Positions", "PositionsTitle");
tableDisplayColumns.set("Products", "ProductName");
tableDisplayColumns.set("QuantityType", "QuantityTypeName");
tableDisplayColumns.set("Suppliers", "SuppliersName");
tableDisplayColumns.set("TableInfo", "TableInfoName");
tableDisplayColumns.set("TableSession", "TableSession");    // this is apparently the name for this table.. what?
tableDisplayColumns.set("TableStatus", "TableStatusName");
//tableDisplayColumns.set("Users", "UsersName");

const assignment = createRoutedController({
    routeName: "assignment",
    routeRootURL: routeRoot,

    tableName: "Assignment",
    tableIdColumn: "AssignmentID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const categories = createRoutedController({
    routeName: "categories",
    routeRootURL: routeRoot,

    tableName: "Categories",
    tableIdColumn: "CategoryID",
    tableIsRelational: false,
});
const channels = createRoutedController({
    routeName: "channels",
    routeRootURL: routeRoot,

    tableName: "Channels",
    tableIdColumn: "ChannelsID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const companies = createRoutedController({
    routeName: "companies",
    routeRootURL: routeRoot,

    tableName: "Companies",
    tableIdColumn: "CompanyID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const financial = createRoutedController({
    routeName: "financial",
    routeRootURL: routeRoot,

    tableName: "FinancialTransactions",
    tableIdColumn: "TransactionID",
    tableIsRelational: false,
});
const messages = createRoutedController({
    routeName: "messages",
    routeRootURL: routeRoot,

    tableName: "Messages",
    tableIdColumn: "MessagesID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const notifications = createRoutedController({
    routeName: "notifications",
    routeRootURL: routeRoot,

    tableName: "Notifications",
    tableIdColumn: "NotificationID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const orders = createRoutedController({
    routeName: "orders",
    routeRootURL: routeRoot,

    tableName: "Orders",
    tableIdColumn: "OrderID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
    
    columnHandler: checkboxColumnHandler("OrderOnline"),
});
const payment = createRoutedController({
    routeName: "payment",
    routeRootURL: routeRoot,

    tableName: "Payment",
    tableIdColumn: "PaymentID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const positions = createRoutedController({
    routeName: "positions",
    routeRootURL: routeRoot,
    tableName: "Positions",
    tableIdColumn: "PositionID",
    tableIsRelational: false,
});
const products = createRoutedController({
    routeName: "products",
    routeRootURL: routeRoot,
    tableName: "Products",
    tableIdColumn: "ProductID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,

    columnHandler: checkboxColumnHandler("ProductIsActive"),
});
const permissions = createRoutedController({
    routeName: "permissions",
    routeRootURL: routeRoot,

    tableName: "UsersPermissions",
    tableIdColumn: "UsersPermissionsID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const suppliers = createRoutedController({
    routeName: "suppliers",
    routeRootURL: routeRoot,

    tableName: "Suppliers",
    tableIdColumn: "SuppliersID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const tableInfo = createRoutedController({
    routeName: "tableinfo",
    routeRootURL: routeRoot,

    tableName: "TableInfo",
    tableIdColumn: "TableInfoID",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns,
});
const userLevel = createRoutedController({
    routeName: "userlevel",
    routeRootURL: routeRoot,

    tableName: "UserLevel",
    tableIdColumn: "UserLevelID",
    tableIsRelational: false,
});

const reservations = createRoutedController({
    routeName: "reservations",
    routeRootURL: routeRoot,
    tableName: "Reservations",
    tableIdColumn: "ReservationId",
    tableIsRelational: true,
    tableDisplayColumnMap: tableDisplayColumns
});


/** @type {Object<string, Object<string, URLRoutedController<function(EJSRequest, EJSResponse, EJSNextError?):(Promise<any>|void)>>} */
module.exports = {
    assignment,
    categories,
    channels,
    companies,
    financial,
    messages,
    notifications,
    orders,
    payment,
    permissions,
    positions,
    products,
    suppliers,
    tableInfo,
    userLevel,
    reservations
};
