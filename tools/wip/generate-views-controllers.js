// ---
// Title   : Generate Controller + Views + Code
// Purpose : Generate files for views from table editing templates.
//           Also creates the controller source. Only required thing is the query for gathering data.
// Note    : <none>
// Author  : B3X
// Run     : $ npm i -g mssql    # or install locally, omitting the '-g' tag.
//           $ # to provide database configuration / credientials, use arguments or a .env file.
//           > # EX: node generate-views-controllers.js --db-user sa --db-pass|--db-pwd secret --db-name Cafe --db-server localhost         --db-port 1433
//                                                                                                            [optional, default=localhost] [optional, default=1433]
//           $ # to provide the lists of names of the views to generate, use () and comma seperated values.
//           > # In the inside of the (), other () paired elements may exist. The table name and the view name can't contain '()' in their names (tool will error out)
//           > # EX: (table names has to match with what they corresspond to on the database. you can easily generate or write by hand a file for it)
//           $ node generate-views-controllers.js --views-map "((AssignmentsTable, AssignmentsView), (CategoriesTable, CategoriesView))"
//           > # With this, the controllers will be generated. You can also specify the outputs of the generated JS controllers codes. For JS default, it's stdout.
//           > # For the generated views EJS, it's path.resolve(process.cwd(), relevantViewFolder, relevantViewName);
//           > # EX: node generate-views-controllers.js --controllers-output views.controller.js                        --views-output
//                                                      [optional, default=stdout. anything else is considered fs name] [optional, default=viewName]
// TODO    : This script is a mess, but it ~~__works__~~ does not work.
//           Refactor it with better templatization, more abstracted away generators (like XMLDOMGenerator and JSRouteGenerator classes)
//           The documentation is outdated. Ctrl+F 'const options =' to find all the arguments and it's usage.
// ---

const optionalRequireErrors = {};
/**
 * @param {string} path
 * @returns {*}
 */
function requireOptional(path) {
    try {
        return require(path);
    } catch (e) {
        optionalRequireErrors[path] = e;
        return null;
    }
}

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const inspector = require("inspector");
const sql = require("mssql");
// optional requires.
requireOptional("dotenv")?.config();

// #region Util Import
// #region ANSI Escapes
/**s
 * Declares console output colors with ANSI escapes, for colorful output.
 *
 * The laziest but most cross platform way of doing it.
 *
 * Ex:
 * ```
 * console.log(outColor.bgWhite, outColor.fgBlack, "Hello world, but with white background and black text.", outColor.reset);
 * // Note : Don't forget to reset output after you are done with, as the output colors will carry over.
 * ```
 */
const outColor = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    fgBlack: "\x1b[30m",
    fgRed: "\x1b[31m",
    fgGreen: "\x1b[32m",
    fgYellow: "\x1b[33m",
    fgBlue: "\x1b[34m",
    fgMagenta: "\x1b[35m",
    fgCyan: "\x1b[36m",
    fgWhite: "\x1b[37m",
    fgGray: "\x1b[90m",

    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
    bgGray: "\x1b[100m",
};
// #endregion
// #region Fake System.Linq
/**
 * Linear O(N) search for matching 'predicate's condition for the elements of 'list'
 * @template T
 * @param {function(T):boolean} predicate
 * @param {T[]|ArrayLike<T>} list
 * @returns {boolean}
 */
function any(predicate, list) {
    if (!list) {
        return false;
    }

    for (let i = 0; i < list.length; i++) {
        if (predicate(list[i])) {
            return true;
        }
    }

    return false;
}

/**
 * Linear O(N^2) search for comparing values for the elements of 'list'
 * @template T
 * @param {T[]|ArrayLike<T>} elems
 * @param {T[]|ArrayLike<T>} list
 * @returns {boolean} true if 'elems' contain one same element inside 'list'
 */
function anyInArray(elems, list) {
    return any((v) => elems.includes(v), list);
}

/**
 * Linear O(N) search for comparing value for the elements of 'list'
 * @template T
 * @param {T} elem
 * @param {T[]|ArrayLike<T>} list
 * @returns {boolean} true if 'elem' is inside list.
 */
function singleInArray(elem, list) {
    return any((v) => elem === v, list);
}

/**
 * Linear O(N) search for finding first entry that matches 'predicate'
 * @template T
 * @param {function(T):boolean} predicate
 * @param {T[]|ArrayLike<T>} list
 * @returns {Number}
 */
function indexOf(predicate, list) {
    if (!list) {
        return -1;
    }

    for (let i = 0; i < list.length; i++) {
        if (predicate(list[i])) {
            return i;
        }
    }

    return -1;
}

/**
 * Get a list of the matching entries
 * @template T
 * @param {function(T):boolean} predicate
 * @param {T[]|ArrayLike<T>} list
 * @returns {T[]}
 */
function where(predicate, list) {
    let result = [];

    for (let i = 0; i < list.length; i++) {
        const value = list[i];
        if (predicate(value)) {
            result.push(value);
        }
    }

    return result;
}

/**
 * Returns an array range.
 * @template T
 * @param {T[]} list
 * @param {Number} start
 * @param {Number} end
 * @returns {T[]}
 */
function range(list, start, end) {
    if (start < 0) {
        start = 0;
    }
    if (end > list.length - 1) {
        end = list.length - 1;
    }

    const result = [];
    for (let i = start; i < end; i++) {
        result.push(list[i]);
    }

    return result;
}
// #endregion
// #region ReadLine
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * @param {string} response
 * @param {string} requireValidResponse Note : If this is false, the response is passed as is.
 * @returns {boolean}
 */
function getPromptResponseResult(response, requireValidResponse = true) {
    if (response) {
        const char = response.trimStart()[0].toLowerCase();
        if (char === "y") {
            return true;
        } else if (char === "n") {
            return false;
        }

        if (char === "t") {
            return true;
        } else if (char === "f") {
            return false;
        }
    }

    if (requireValidResponse) {
        throw new Error(`[!!] [get-unused-css::getPromptResponseResult] Failed to get prompt response result : response "${response}" is invalid.`);
    }

    return response;
}

/**
 * Is a recursive readline question with confirmation and a validation predicate.
 * @param {string} query
 * @param {function(string):boolean} responseValidPredicate
 * @param {string?} queryInvalidMsg
 * @returns {Promise<string>}
 */
function validatedPrompt(query, responseValidPredicate, queryInvalidMsg = null) {
    return new Promise((resolve) => {
        rl.question(query, (response) => {
            const responseValidity = responseValidPredicate(response);
            if (!responseValidity) {
                if (queryInvalidMsg) {
                    rl.write(`\n${queryInvalidMsg}\n`);
                }

                if (typeof responseValidity === "undefined") {
                    console.trace(outColor.fgYellow, '[validatedPrompt] Given response returned "undefined", this may be unintentional.', outColor.reset);
                }

                resolve(validatedPrompt(query, responseValidPredicate));
                return;
            }

            resolve(response);
        });
    });
}

/**
 * @param {string} query
 * @param {boolean} defaultResponse
 * @param {boolean} requireValidRes
 * @returns {Promise<boolean>} The 'y/n' response.
 */
async function ynPrompt(query, defaultResponse = false, requireValidRes = true) {
    let result = false;
    await validatedPrompt(
        query,
        (response) => {
            if (response) {
                const char = response.trimStart()[0].toLowerCase();
                if (char === "y") {
                    result = true;
                    return true;
                } else if (char === "n") {
                    result = false;
                    return true;
                }
            }

            result = defaultResponse;
            return !requireValidRes;
        },
        "Please write a valid response (Y/N) : "
    );

    return result;
}

/**
 * @typedef {Object} OptionArgumentGetSettings
 * @property {Number} optionCount
 * @property {boolean} throwIfOptionMismatch Whether to throw if the 'optionCount' doesn't match.
 * @property {string[]?} expectedValues Option strings to expect. Throws if the result does not match the results.
 * @property {boolean?} required Whether if the option is required for the argument to function. If argument is not found, an exception is thrown instead.
 */
/**
 * Gets the first match of 'argNames' options.
 * @param {string|string[]} argNames
 * @param {string[]} args
 * @param {OptionArgumentGetSettings} options
 * @param {Number} optionCount Count of the options.
 * @param {boolean} throwIfOptionless
 * @returns {string|string[]|undefined}
 */
function getOptionArgumentValue(
    argNames,
    args,
    options = {
        optionCount: 1,
        throwIfOptionMismatch: true,
        expectedValues: null,
        required: false,
    }
) {
    if (typeof options.optionCount === "undefined") {
        options.optionCount = 1;
    }
    if (typeof options.throwIfOptionMismatch === "undefined") {
        options.throwIfOptionMismatch = true;
    }

    const indexOfArgument = indexOf((v) => argNames.includes(v), args);
    let result = [];
    if (indexOfArgument > 0) {
        for (let i = 0; i < options.optionCount; i++) {
            const argIdx = indexOfArgument + 1 + i;
            if (argIdx >= args.length) {
                if (options.throwIfOptionMismatch || options.required) {
                    throw new Error(`[getOptionArgumentValue] Failed to get options for arguments ${argNames}, expected ${optionCount} count positional arguments.`);
                } else {
                    return undefined;
                }
            }

            const argResultPush = args[argIdx];
            if (options.expectedValues && !options.expectedValues.includes(argResultPush)) {
                throw new Error(
                    `[getOptionArgumentValue] Failed to get options for arguments ${argNames}, expected values ${options.expectedValues}, got ${argResultPush}.`
                );
            }

            result.push(argResultPush);
        }
    } else {
        if (options.required) {
            throw new Error(`[getOptionArgumentValue] ${argNames} is a required argument. Option Count:${options.optionCount}`);
        }
        return undefined;
    }

    return result.length === 1 ? result[0] : result;
}
// #endregion
// #region Debug
/**
 * Used for the debugging. Variable handle to dispose.
 */
let primaryInspector;
// #endregion
// #region String Util
/**
 * @param {string|null|undefined} value Value to "nicify". If this is null or undefined, the value is returned as is.
 * @returns {string|null|undefined} The result string.
 */
function nicifyString(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value !== "string") {
        value = new String(value);
    }

    let result = "";
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        // snake_case
        if (char === "_") {
            result += " ";
            continue;
        }

        // PascalCase
        const prevLower = i > 0 && /[a-z]/.test(value[i - 1]);
        if (prevLower && /[A-Z]/.test(char)) {
            result += " ";
        }

        result += char;
    }

    return result;
}

/**
 * @param {Number} times
 * @param {Number} spaceCount
 * @returns {string}
 */
function tab(times, spaceCount = 4) {
    if (!times || times <= 0) {
        return "";
    }
    if (!spaceCount || spaceCount <= 0) {
        return "";
    }

    return " ".repeat(spaceCount).repeat(times);
}

/**
 * @param {string} str
 * @param {string} char
 * @returns {string}
 */
function trimLeft(str, char) {
    if (!str) {
        return str;
    }

    let i = 0;
    while (str[i] === char) {
        i++;
    }

    return str.substring(i + 1);
}
/**
 * @param {string} str
 * @param {string} char
 * @returns {string}
 */
function trimRight(str, char) {
    if (!str) {
        return str;
    }

    let i = str.length - 1;
    while (str[i] === char) {
        i--;
    }

    return str.substring(0, i);
}
// #endregion
// #endregion

// #region GenFW Import
/**
 * @param {TemplateStringsArray|string} templateStrings 
 * @returns {string}
 */
function dedent(templateStrings) {
    var values = [];

    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }

    var matches = [];
    var strings = typeof templateStrings === 'string' ? [templateStrings] : templateStrings.slice();

    // 1. Remove trailing whitespace.
    strings[strings.length - 1] = strings[strings.length - 1].replace(/\r?\n([\t ]*)$/, '');

    // 2. Find all line breaks to determine the highest common indentation level.
    for (var i = 0; i < strings.length; i++) {
        var match = void 0;

        if (match = strings[i].match(/\n[\t ]+/g)) {
            matches.push.apply(matches, match);
        }
    }

    // 3. Remove the common indentation from all strings.
    if (matches.length) {
        var size = Math.min.apply(Math, matches.map(function (value) { return value.length - 1; }));
        var pattern = new RegExp("\n[\t ]{" + size + "}", 'g');

        for (var i = 0; i < strings.length; i++) {
            strings[i] = strings[i].replace(pattern, '\n');
        }
    }

    // 4. Remove leading whitespace.
    strings[0] = strings[0].replace(/^\r?\n/, '');

    // 5. Perform interpolation.
    var string = strings[0];

    for (var i = 0; i < values.length; i++) {
        string += values[i] + strings[i + 1];
    }

    return string;
};

// args
/**
 * @typedef {Object} ViewsMapCell
 * @property {string} name Name of the backing view.
 * @property {string} tableName Name of the backing table.
 */
/**
 * Parses the views map string, formatted like
 *
 * `((BackingTable, ViewName), (OtherBackingTable, SussyBakaView))`
 *
 * These are then converted into a 'ViewsMapCell[]'. If an incorrect string is given, this method throws.
 * @param {string} str
 * @returns {ViewsMapCell[]}
 */
function parseViewsMap(str) {
    if (!str) {
        throw new Error(`[parseViewsMap] Failed to parse ${str} : Value falsy.`);
    }
    if (typeof str !== "string") {
        console.warn(outColor.fgYellow, `[parseViewsMap] Value ${str} is not string. The parsing may fail.`, outColor.reset);
    }

    // this can be done in 1 line of regex, but i don't feel regex today.
    const result = [];
    const tkBegin = "(",
        tkEnd = ")",
        tkSeperator = ",";

    let cellTableName = "";
    let cellViewName = "";
    let started = false,
        startedCell = false,
        fillingTableName = false;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (!started) {
            if (/\s/.test(c)) {
                continue;
            }
            if (c === tkBegin) {
                started = true;
                continue;
            }

            throw new Error(`[parseViewsMap:start] Unexpected token '${c}' on string ${str}.`);
        }

        if (!startedCell) {
            if (/\s/.test(c)) {
                continue;
            }
            // begin
            if (c === tkBegin) {
                startedCell = true;
                fillingTableName = true;
                continue;
            }
            const isEnd = c === tkEnd;
            // push
            if (c === tkSeperator || isEnd) {
                cellTableName = cellTableName.trim();
                cellViewName = cellViewName.trim();
                if (!cellTableName || !cellViewName) {
                    throw new Error(`[parseViewsMap:cellStart|cellEnd] Blank table name or view name on string ${str}.`);
                }

                result.push({
                    name: cellViewName,
                    tableName: cellTableName,
                });

                cellTableName = "";
                cellViewName = "";

                if (isEnd) {
                    break;
                }

                continue;
            }

            throw new Error(`[parseViewsMap:cellStart] Unexpected token '${c}' on string ${str}.`);
        } else {
            // sep (mode change)
            if (c === tkSeperator) {
                if (!fillingTableName) {
                    throw new Error(`[parseViewsMap:cellInside] Excess seperator token for cell ${result.length} on string ${str}.`);
                }

                fillingTableName = false;
                continue;
            }
            // end of names
            if (c === tkEnd) {
                if (fillingTableName) {
                    throw new Error(`[parseViewsMap:cellInside] No view name declared for cell ${result.length} on string ${str}.`);
                }

                fillingTableName = false;
                startedCell = false;
                continue;
            }

            if (fillingTableName) {
                cellTableName += c;
            } else {
                cellViewName += c;
            }
        }
    }

    if (cellTableName || cellViewName) {
        throw new Error(
            `[parseViewsMap:cellInside] Primary contained elements declaration is unterminated ${str}.\nRemaining cellTableName:${cellTableName}, cellViewName:${cellViewName}`
        );
    }

    return result;
}

/**
 * Handles the SQL aliasing, according to the given columns and view name.
 *
 * ---
 * - `#ID_COLUMN#          ` : Name of the identity column.
 * - `#COLUMNS#            ` : Names of the columns, seperated w/ ','. For SELECT ALL, use SELECT *.
 * - `#COLUMNS_{N}#        ` : Names of the columns, seperated w/ ','.
 * - - N=`NLower..NUpper   ` : Range the column entries. One of the range entries can be omitted which in that case, the 0..len-1 index is used.
 * - `#FOREIGN_COLUMNS#    ` : Columns that are foreign keys.
 * - `#FOREIGN_COLUMNS_{N}#` : Columns that are foreign keys.
 * - - N=`NLower..NUpper   ` : Range the column entries. One of the range entries can be omitted which in that case, the 0..len-1 index is used.
 * 
 * ---
 * - `#VIEW_NAME#          ` : Name of the target view.
 * - `#TABLE_NAME#         ` : Name of the target table.
 * @param {TableInformativeColumn[]} columns
 * @param {string} str
 * @param {boolean?} recurse Whether to also call 'replaceSqlAliases' on the replaced result as well.
 * @param {ViewsMapCell} view Whether to also call 'replaceSqlAliases' on the replaced result as well.
 * @returns {string}
 */
function replaceSqlAliases(columns, view, str, recurse = false) {
    function rangeRegexSelector(name) {
        return new RegExp(`#${name}_{(\\d*)(..)?(\\d*)?}#`, "gm");
    }
    /**
     * @template T
     * @param {T[]} values
     */
    function rangeRegexCapture(values) {
        /**
         * @param {RegExpExecArray} capture
         */
        return (capture) => {
            // keep as is
            if (capture.length < 2) {
                return capture.input;
            }

            let startIndex = capture[0] ? Number.parseInt(capture[0]) : 0;
            let isRange = !!capture[1];
            let endIndex = capture[2] ? Number.parseInt(capture[2]) : values.length - 1;

            if (Number.isNaN(startIndex)) {
                startIndex = 0;
            }
            if (Number.isNaN(endIndex)) {
                endIndex = values.length - 1;
            }

            if (isRange) {
                return range(
                    values,
                    startIndex,
                    endIndex
                ).join(",");
            } else {
                return values[startIndex];
            }
        };
    }

    /**
     * List of the aliases for the columns.
     */
    const sqlAliases = {
        "#ID_COLUMN#": columns.find((c) => c.isIdentity || c.isPKey),
        "#COLUMNS#": columns.map((c) => c.name).join(","),
        [rangeRegexSelector("COLUMNS")]: rangeRegexCapture(columns.map((c) => c.name)),
        "#FOREIGN_COLUMNS#": where((c) => c.isFKey, columns).join(","),
        [rangeRegexSelector("FOREIGN_COLUMNS")]: rangeRegexCapture(where((c) => c.isFKey, columns).map((c) => c.name)),
        
        "#VIEW_NAME#": view?.name || "<!UNDEFINED VIEW_NAME!>",
        "#TABLE_NAME#": view?.tableName || "<!UNDEFINED TABLE_NAME!>",
    };

    for (const [key, value] of sqlAliases) {
        if (typeof key === "string") {
            let replaceValue = value;
            if (replaceValue instanceof Function) {
                replaceValue = replaceValue();
            }
            if (recurse) {
                replaceValue = replaceSqlAliases(replaceValue);
            }

            str.replaceAll(key, replaceValue);
        } else if (key instanceof RegExp) {
            const keyExecMatches = key.exec(str);
            if (!keyExecMatches) {
                continue;
            }

            let replaceValue = value;
            if (replaceValue instanceof Function) {
                replaceValue = replaceValue(keyExecMatches);
            }
            if (recurse) {
                replaceValue = replaceSqlAliases(replaceValue);
            }

            str.replaceAll(key, replaceValue);
        } else {
            throw new Error(`[replaceSqlAliases] Invalid type on key ${key}.`);
        }
    }
}

/**
 * TODO : Requires further optimizations, just handles indents for files. Does not check syntaxes as well, moves upon whitespace.
 */
class IndentedStringBuilder {
    /**
     * @param {string} content Content to build upon from.
     */
    constructor(content) {
        // content
        this.content = content;
        // settings
        // this.indentSize = 4; // default
        this.lineEndings = "\n";
        // buffer
        /** @type {string?} */
        this.replaceBuffer = undefined;
    }

    /**
     * Sets up the total indentation and the line to start on.
     * @private
     * @param {Number} position 
     * @param {Number?} size 
     */
    _beginReplaceBufferInternal(position, size) {
        this.replaceBuffer = "";
        this.replaceBufferPosition = position;
        // Get indent
        // The indent is the next line to non-ws char position.
        // Ex:
        // `        <br>#THING_TO_REPLACE#</br>` -> 8, go back or forward until we find non ws char.
        //              -> POSITION
        //             <-- Go back until ws, then start counter.
        let wsFindPosition = position;
        // Go back until we find a whitespace (that isn't '\n')
        while (this.content[wsFindPosition] !== "\n" && !/\s/.test(this.content[wsFindPosition]) && wsFindPosition >= 0) {
            wsFindPosition--;
        }
        // Go increment indent until non-whitespace char that isn't newline. (\n is checked for indenting til last line)
        for (
            this.replaceBufferIndent = 0;
            this.content[wsFindPosition] !== "\n" && /s/.test(this.content[wsFindPosition]) && wsFindPosition >= 0;
            this.replaceBufferIndent++
        ) {
            wsFindPosition--;
        }

        if (size > 0) {
            this.content = this.content.substring(0, this.replaceBufferPosition) + this.content.substring(this.replaceBufferPosition + size);
        }
    }

    /**
     * Starts the replacement buffer for a content replacer.
     * @param {Number|string} position Pattern or the position to start the replace buffer at.
     * @param {Number?} size Size of the replacement buffer, if 'position' is something string. Not needed if 'position' is string.
     */
    beginReplaceBuffer(position, size) {
        if (typeof this.replaceBuffer !== "undefined") {
            throw new Error(`[IndentedStringBuilder::beginReplaceBuffer] replaceBuffer has been already begin with ${this.replaceBuffer} in it.`);
        }

        if (typeof position !== "number") {
            if (!position) {
                throw new Error(`[IndentedStringBuilder::beginReplaceBuffer] Can't begin replaceBuffer with invalid pos : ${position}`);
            }
        }
        if (typeof position === "string") {
            position = this.content.indexOf(position);
            if (position < 0) {
                throw new Error(`[IndentedStringBuilder::beginReplaceBuffer] Can't find "${position}" on ViewTemplate with content\n${this.content}`);
            }

            if (!size || size < 0) {
                size = position.length;
            }
        }

        if (position < 0) {
            position = 0;
        }

        this._beginReplaceBufferInternal(position, size);
    }

    /**
     * Starts the replacement buffer for a content replacer.
     * @param {Number|string} position Pattern or the position to start the replace buffer at.
     * @param {Number?} size Size of the replacement buffer, if 'position' is something string. Not needed if 'position' is string.
     * @returns {boolean} Whether if the replace buffer had started successfully.
     */
    tryBeginReplaceBuffer(position, size) {
        if (typeof this.replaceBuffer !== "undefined") {
            return false;
        }

        if (typeof position !== "number") {
            if (!position) {
                return false;
            }
        }
        if (typeof position === "string") {
            position = this.content.indexOf(position);
            if (position < 0) {
                return false;
            }

            if (!size || size < 0) {
                size = position.length;
            }
        }

        if (position < 0) {
            position = 0;
        }

        this._beginReplaceBufferInternal(position, size);
        return true;
    }

    /**
     * Pushes a string block, respective to the current indentation. Each indentation is additively pushed forward.
     * @param {string} string String to push.
     */
    pushString(string) {
        this.pushIndentString(0, string);
    }
    /**
     * Pushes a string block, respective to the current indentation. Each indentation is additively pushed forward.
     * 
     * Note : This method, if no newlines are included, adds the given indent without base indent.
     * @param {Number} indent Indent to push.
     * @param {string} string String to push.
     */
    pushIndentString(indent, string) {
        if (!indent || Number.isNaN(indent)) {
            indent = 0;
        }

        // Indent rules and situations.
        // the 'replaceBuffer' is an isolated thing, that receives strings and such.
        // -------------
        // - Empty line:
        // indent + string + \n || indent + string
        // - Non-empty line:
        // prevContent + string + \n || prevContent + string
        // - Whitespace line:
        // prevContent + indent + string + \n (TODO : Determine the existing indent and replace until we reach the target indent)

        let block = "";
        if (string.includes(this.lineEndings)) {
            const lines = string.split(this.lineEndings);
            for (let i = 0; i < lines.length; i++) {
                if (i === 0) {
                    // If the current buffer last is not towards a whitespace, don't indent the first piece,
                    // just append + terminate the current line, which is probably indented.
                    let isNonWSLine = false;
                    for (let j = this.replaceBuffer.length - 1; j >= 0; j--) {
                        const bufChar = this.replaceBuffer[j];

                        if (bufChar === '\n') {
                            break;
                        }

                        if (!/\s/.test(bufChar)) {
                            isNonWSLine = true;
                            break;
                        }
                    }
                    if (isNonWSLine) {
                        block += `${lines[i]}${this.lineEndings}`;
                        continue;
                    }
                }

                block += `${tab(this.replaceBufferIndent + indent)}${lines[i]}${this.lineEndings}`;
            }
        } else {
            block = string;
        }

        this.replaceBuffer += block;
    }

    /**
     * Pushes the replace buffer inside content and ends the replacement buffer.
     */
    endReplaceBuffer() {
        this.content =
            this.content.substring(0, this.replaceBufferPosition) +
            this.replaceBuffer +
            this.content.substring(this.replaceBufferPosition + this.replaceBuffer.length);
        this.replaceBuffer = undefined;
        this.replaceBufferIndent = 0;
        this.replaceBufferPosition = 0;
    }

    /**
     * Debugging string reprensation.
     */
    toString() {
        return JSON.stringify(this, undefined, 4);
    }
}

/**
 * Specifies a EJS generation template. Handles pretty printing and other things.
 *
 * ---
 * TODO :
 * Should be able to be loaded from a file with header setting declarations or from JS file.
 */
class ViewTemplate extends IndentedStringBuilder {
    /**
     * @param {string} name Name of this template. Can be anything you like, but name it sensibly.
     * @param {string} content EJS file Content to serve.
     * @param {string[]|Object<string, string>?} serveQuery Query(ies) and it's results sent to the page to serve.
     * This can contain things like the view name, table name, etc. by using the aliases declared in 'replaceSqlAliases'.
     * @param {string?} extension Extension of the file. 'ejs' by default if undeclared.
     */
    constructor(name, content, serveQuery, extension) {
        super(content);

        this.name = name;
        // content
        /**
         * SQL query sent to serve generated content inside the page. Check the aliases declared in 'replaceSqlAliases'.
         *
         * Ex:
         * `SELECT * FROM #TABLE_NAME# WHERE #ID_COLUMN# = @idColumnValue`
         * 
         * This allows for basic controller generation without 'ControllerTemplate'.
         * 
         * @type {string[]|Object<string, string>} By default, the type is Object<string, string>, if no 'serveQuery' is given.
         */
        this.serveQueries = serveQuery ?? {};
        /** Name of the field that gives the 'serveQuery' data. Used whilst constructing the controller from template. */
        this.serveDataValueName = "data";
        /** @private */
        this._extension = extension;
    }

    /**
     * Get the extension. Not prefixed with '.'
     */
    get extension() {
        return this._extension ?? "ejs";
    }
    /**
     * Set extension. Don't prefix with '.'
     * @param {string} value
     */
    set extension(value) {
        if (value) {
            value = trimLeft(value, ".");
        }

        this._extension = value;
    }

    /**
     * Get a serve query for given view and it's columns GET request.
     * @param {ViewsMapCell} view
     * @param {TableInformativeColumn[]} columns
     * @returns {string[]|Object<string, string>|null}
     */
    getServeQueries(view, columns) {
        if (!this.serveQueries) {
            return null;
        }

        let result = structuredClone(this.serveQueries);

        for (const [key, query] of Object.entries(result)) {
            result[key] = replaceSqlAliases(columns, view, query);
        }

        return result;
    }
}

/**
 * TODO : Implement, needs to work in conjuction with the view generator.
 */
class ControllerTemplate extends IndentedStringBuilder {
    // * @param {ViewTemplate} viewTemplate Template to generate controller for.
    /**
     * @param {string} content EJS file Content to serve.
     * @param {string?} extension Extension of the file. 'js' by default if undeclared.
     */
    constructor(content, extension) {
        super(content);

        /** @private */
        this._extension = extension;
    }

    /**
     * Get the extension. Not prefixed with '.'
     */
    get extension() {
        return this._extension ?? "ejs";
    }
    /**
     * Set extension. Don't prefix with '.'
     * @param {string} value
     */
    set extension(value) {
        if (value) {
            value = trimLeft(value, ".");
        }

        this._extension = value;
    }
}

// #endregion

// #region SQL
/** @type {sql.ConnectionPool} */
let sqlPool;

/**
 * Get either the identity key or the primary key. If both doesn't exist in the table, unless 'neverReturnNull' is true, returns null.
 *
 * @param {string} tableName
 * @param {boolean} neverReturnNull Whether to not return null. This returns the first column if no results were found from the initial select.
 * @returns {Promise<{ name:string, actuallyId: boolean } | null>}
 */
async function sqlGetIdentityOrPK(tableName, neverReturnNull = false) {
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[sqlGetIdentityOrPK] sqlPool hasn't connected or has been initialized : ${JSON.stringify(sqlPool, undefined, 4)}`);
    }
    if (!tableName) {
        return null;
    }

    const request = sqlPool.request();
    request.input("table", tableName);

    const result = (
        await request.query(`(SELECT (C.name) AS ID_COLUMN, (K.COLUMN_NAME) PK_COLUMN
        FROM SYS.OBJECTS O
            INNER JOIN SYS.COLUMNS C ON O.object_id = C.object_id
            INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE K ON O.name = K.TABLE_NAME
            INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS TK ON O.name = TK.TABLE_NAME AND K.CONSTRAINT_NAME = TK.CONSTRAINT_NAME
        WHERE O.name = @table AND C.is_identity = 1 AND TK.CONSTRAINT_TYPE = 'PRIMARY KEY');
    `)
    ).recordset[0];

    if (result) {
        if (result.ID_COLUMN) {
            return {
                name: result.ID_COLUMN,
                actuallyId: true,
            };
        }

        if (result.PK_COLUMN) {
            return {
                name: result.PK_COLUMN,
                actuallyId: true,
            };
        }
    }

    if (neverReturnNull) {
        return {
            name: (await request.query(`SELECT TOP(1) COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table`)).recordset[0]?.COLUMN_NAME,
            actuallyId: false,
        };
    }

    return null;
}

/**
 * @param {string} tableName Name of the target table to check it's foreign key values.
 * @param {string?} targetTableName The foreign key targeting table name. Optional to give.
 * @returns {Promise<{
 *     column: string,
 *     fkName: string,
 *     referencedTable: string,
 *     referencedColumn: string,
 * }[]>} Result. Could be a zero length array if no foreign keys inside given 'tableName'
 */
async function sqlGetForeignKeys(tableName, targetTableName = undefined) {
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[sqlGetForeignKeys] sqlPool hasn't connected or has been initialized : ${JSON.stringify(sqlPool, undefined, 4)}`);
    }
    if (!tableName) {
        return [];
    }

    const request = sqlPool.request();
    let queryString = `SELECT col1.name AS [column],
    obj.name AS [fkName],
    tab2.name AS [referencedTable],
    col2.name AS [referencedColumn]
        FROM sys.foreign_key_columns fkc
            INNER JOIN sys.objects obj
                ON obj.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables tab1
                ON tab1.object_id = fkc.parent_object_id
            INNER JOIN sys.columns col1
                ON col1.column_id = parent_column_id AND col1.object_id = tab1.object_id
            INNER JOIN sys.tables tab2
                ON tab2.object_id = fkc.referenced_object_id
            INNER JOIN sys.columns col2
                ON col2.column_id = referenced_column_id AND col2.object_id = tab2.object_id
        WHERE tab1.name = @table`;

    request.input("table", tableName);
    if (targetTableName) {
        queryString += " AND tab2.name = @targetTable";
        request.input("targetTable", targetTableName);
    }

    const result = await request.query(queryString);
    return result.recordset;
}

/**
 * @typedef {Object} TableInformativeColumn An informative object that contains table information.
 * @property {string} name
 * @property {string} type
 * @property {boolean} isIdentity
 * @property {boolean} isPKey
 * @property {boolean} isFKey
 * @property {string} fkName
 * @property {string} fkRefTable
 * @property {string} fkRefColumn
 */

/**
 * Get the informative list of the columns.
 * @param {string} tableName
 * @returns {Promise<TableInformativeColumn[]>}
 */
async function sqlGetInformativeColumns(tableName) {
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[sqlGetInformativeColumns] sqlPool hasn't connected or has been initialized : ${JSON.stringify(sqlPool, undefined, 4)}`);
    }
    if (!tableName) {
        return null;
    }

    const request = sqlPool.request();
    request.input("table", tableName);

    /** @type {{ COLUMN_NAME:string, DATA_TYPE:string }[]} */
    const allCols = (await request.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table`)).recordset;
    const foreignKeys = await sqlGetForeignKeys(tableName);
    const identityKey = await sqlGetIdentityOrPK(tableName, true);

    /** @type {TableInformativeColumn[]} */
    const result = [];

    for (const column of allCols) {
        const columnName = column.COLUMN_NAME;
        /** @type {TableInformativeColumn} */
        const inputResult = {};

        inputResult.name = columnName;
        inputResult.type = column.DATA_TYPE;
        const fkResult = foreignKeys.find((v) => v.column === columnName);
        if (fkResult) {
            inputResult.isFKey = true;
            inputResult.fkName = fkResult.fkName;
            inputResult.fkRefTable = fkResult.referencedTable;
            inputResult.fkRefColumn = fkResult.referencedColumn;
        }

        inputResult.isPKey = identityKey.name === columnName;
        inputResult.isIdentity = identityKey.actuallyId && inputResult.isPKey;

        result.push(inputResult);
    }

    return result;
}

/**
 * Converts given typename to a HTML input name.
 * @param {string} typeName
 */
function sqlToHTMLType(typeName) {
    typeName = typeName.toLowerCase();

    switch (typeName) {
        // numeric
        case "tinyint":
        case "smallint":
        case "int":
        case "bigint":
        case "bit":
        case "decimal":
        case "numeric":
        case "money":
        case "smallmoney":
        // approx numeric
        case "float":
        case "real":
            return "number";
        case "date":
        case "time":
        case "datetime2":
        case "datetimeoffset":
        case "datetime":
        case "smalldatetime":
            // or "datetime"
            return "datetime-local";
        case "varchar":
        case "nvarchar":
        case "text":
            return "text";
        case "binary":
        case "varbinary":
            return "file";
        case "image":
            // note : image type is just a graphical submit button.
            return "file";
        default:
            return "text";
    }
}
// #endregion

/**
 * Options declared to setup things. Uses 'process.argv' to be able to access globally.
 */
const options = {
    // config
    /** @type {sql.config} */
    dbConfig: {
        user: getOptionArgumentValue(["--db-user"], process.argv) || process.env.DB_USER,
        password: getOptionArgumentValue(["--db-pwd", "--db-pass"], process.argv) || process.env.DB_PWD,
        database: getOptionArgumentValue(["--db-name"], process.argv) || process.env.DB_NAME,
        server: getOptionArgumentValue(["--db-server"], process.argv) || process.env.DB_SERVER || "localhost",
        port: getOptionArgumentValue(["--db-port"], process.argv),
        options: {
            encrypt: singleInArray("--db-encrypt", process.argv),
            trustServerCertificate: !singleInArray("--db-notrust-server-cert", process.argv),
        },
    },
    viewsMap: getOptionArgumentValue(["--views-map"], process.argv, {
        required: true,
    }),
    // general settings
    ignoreErrors: anyInArray(["--ignore-errors", "-ierr"], process.argv),
    cwd: getOptionArgumentValue(["--cwd"], process.argv),
    debug: anyInArray(["--debug", "-dbg"], process.argv),
    waitDebugger: anyInArray(["--wait-for-debug", "--wait-debug", "-wdbg"], process.argv),
    // paths for output
    viewsOutput: getOptionArgumentValue(["--views-output"], process.argv) || "views",
    controllersOutput: getOptionArgumentValue(["--controllers-output"], process.argv) || "stdout",
    // paths of the db controller
    dbModulePath: getOptionArgumentValue(["--db-module-path"], process.argv) || "../routers/db",
};

/**
 * @returns {Promise<ViewsMapCell[]>}
 */
async function mainSetup() {
    // --
    // Setup
    const reqErrors = Object.entries(optionalRequireErrors);
    for (const [k, v] of reqErrors) {
        console.error(outColor.fgRed, `[generate-views-controllers] Error on optional require("${k}")=\n${v}`, outColor.reset);
    }

    if (!options.cwd) {
        if (!(await ynPrompt(`[generate-views-controllers] Generation CWD is ${process.cwd()}, Continue? (Y/N) `))) {
            await validatedPrompt(
                "[generate-views-controller] Enter new CWD: ",
                (response) => {
                    try {
                        process.chdir(response);
                        return true;
                    } catch (e) {
                        console.error(outColor.fgYellow, "[generate-views-controller] chdir() Error occured : ", outColor.reset);
                        console.error(e);
                        return false;
                    }
                },
                "Invalid CWD, enter new (or Ctrl+C to suspend) : "
            );
        }
    } else {
        process.chdir(options.cwd);
        console.log(outColor.bright, outColor.fgCyan, `[generate-views-controller] --cwd = ${process.cwd()}`, outColor.reset);
    }

    // --
    // Parse viewsMap
    // If the 'viewsMap' is seemingly a file name, try reading it's content.
    // .. yes, this is inefficient but 'require("path")' seemingly doesn't contain it.
    if (fs.existsSync(options.viewsMap)) {
        options.viewsMap = fs.readFileSync(options.viewsMap);
    }
    const viewsMapList = parseViewsMap(options.viewsMap);

    // Connect SQL
    sqlPool = await sql.connect(options.dbConfig);
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[generate-views-controllers:sql] Failed to connect with configuration\n${JSON.stringify(options.dbConfig, undefined, 4)}`);
    }

    return viewsMapList;
}

async function main() {
    if (options.waitDebugger) {
        console.log(outColor.bgBlack, "[generate-table-pages] Waiting for debugger (--wait-for-debug), attach node debug.", outColor.reset);

        primaryInspector = inspector.open();
        inspector.waitForDebugger();
    }

    const viewsMapList = await mainSetup();

    // Table attribute management
    const actionAttrName = "table-action";
    const actionAttrTypeUpdate = "update:",
        actionAttrTypeRemove = "remove:";

    // Routing prefixes for the CRUD events.
    const actionFix = {
        update: "Update",
        remove: "Remove", // unused?
        add: "Add",
    };

    const aliasConfig = {
        /** @type {ViewsMapCell} */
        view: null,
        /** @type {TableInformativeColumn[]} */
        columns: null,
        /**
         * Configure the 'aliasConfig'.
         * @param {ViewsMapCell} view 
         * @param {TableInformativeColumn[]} columns 
         */
        config: function (view, columns) {
            aliasConfig.view = view;
            aliasConfig.columns = columns;
        },
    };

    /** An alias list built from view names and such. */
    const aliasList = {
        /**
         * Contains the base name of the view. (no prefixes)
         * @param {IndentedStringBuilder} builder The template builder.
         */
        "#VIEW_NAME#": function (builder) {
            builder.pushString(aliasConfig.view.name);
        },
        /**
         * Contains the primary CRUD table display.
         * @param {IndentedStringBuilder} builder The template builder.
         */
        "#TABLE_ELEMENT#": function (builder) {
            const idColumn = aliasConfig.columns.find((c) => c.isIdentity || c.isPKey);
            
            // Action buttons.
            // - Shows : [X] [🖊]
            // - TODO : Style better
            const actionButtonsHead = "İşlem";
            const actionButtons =
                `<i ${actionAttrName}="<%= "${actionAttrTypeUpdate}" + row.${idColumn.name} %>" class="fa fa-edit crud-table-update"></i>\n` +
                `<i ${actionAttrName}="<%= "${actionAttrTypeRemove}" + row.${idColumn.name} %>" class="fa fa-remove crud-table-remove"></i>\n`;

            // head
            builder.pushString(
                dedent
                `<thead>
                    <tr>
                `
            );
            for (const column of aliasConfig.columns) {
                // Display a font-awesome chain link for foreign keys and a padlock for primary keys.
                builder.pushIndentString(2, "<td");
                if (column.isIdentity || column.isPKey) {
                    builder.pushString(` class="fa fa-key"`);
                }
                if (column.isFKey) {
                    builder.pushString(` class="fa fa-chain"`);
                }
                builder.pushString(`> ${column.name} </td>\n`);
            }
            builder.pushIndentString(2, `<td>${actionButtonsHead}</td>\n`);
            builder.pushString(
                dedent
                `    </tr>
                </thead>
                `
            );

            // tbody (with view generation)
            builder.pushString(
                dedent
                `<tbody>
                    <% data.rows.forEach((row) => { %>
                        <tr>`
            );
            for (const column of aliasConfig.columns) {
                // add generation, from gathered view routing data.
                builder.pushIndentString(3, `<td><%= row.${column.name} %></td>\n`);
                // [!!] TODO : Generate Primary/Foreign special key displays.
                // |           on("click", () => {}) with a button on the table cell should redirect or
                // |           open a new tab to the exact referenced row highlighted.
            }
            builder.pushIndentString(3, actionButtons);
            builder.pushString(
                dedent
                `       </tr>
                    <% }); %>
                </tbody>
                `
            );
        },

        /**
         * Contains the primary form element that handles submission.
         * @param {IndentedStringBuilder | ViewTemplate} builder 
         */
        "#FORM_ELEMENT#": function (builder) {
            const idColumn = aliasConfig.columns.find((c) => c.isIdentity || c.isPKey);
            const fieldIdFix = "crudFormField";
            let fieldIndex = 0; // Field id for the '<input for=""' entries.
            const isBuilderViewTemplate = builder instanceof ViewTemplate;

            builder.pushString(
                dedent
                `<form action="${aliasConfig.view.name}${actionFix.add}Post" method="post">
                    <div class="modal-body">
                `
            );
            // * [??] Add an invisible insert for the identity? Not needed unless IDENTITY_INSERT is ON
            // if (idColumn) {
            //     builder.pushIndentString(2, `<input class="d-none" type="${sqlToHTMLType(idColumn.type)}" id="${fieldIdFix}${fieldIndex++}" name="${idColumn.name}">`);
            // }
            builder.pushIndentString(2, `<div class="col-6">\n`);
            for (const column of aliasConfig.columns) {
                if (column.name === idColumn.name) {
                    continue;
                }

                const idString = `${fieldIdFix}${fieldIndex++}`;
                builder.pushIndentString(3, `<label for="${idString}">${nicifyString(column.name)}</label><br>\n`);

                // noooo you can't do frontend using '<br/>', you need to use bootstrap 5.5.5 class wd-l-br-test-idk-w100-hhhgregg
                // haha <br> goes BRRRRRRRRRRRRRRRRRR
                if (column.isFKey) {
                    if (isBuilderViewTemplate) {
                        builder.serveQueries[column.fkRefColumn] = `SELECT ${column.fkRefColumn} FROM ${column.fkRefTable}`;
                    }

                    builder.pushIndentString(3,
                        dedent
                        `<select style="min-width: 300px;" id="${idString}" aria-label="Select from ${nicifyString(column.fkRefTable)}" name="${column.name}">
                            <% for (let i = 0; i < data.${column.fkRefColumn}.length; i++) { %>
                                <option> <%= data.${column.fkRefColumn}[i] %> </option>
                            <% } %>
                        </select> <br/>
                        `
                    );

                    continue;
                }

                // TODO : Requires 'data.{column.name}' value to be served in data, but requires unique routing as data is sent with jQuery
                // why are we even sending client data back to server that is most likely the same anyways, just to feed it back again?
                // i won't be questioning the API design, just fix and cleanup the source, so we can persistently generate views without any problems.
                builder.pushIndentString(3,
                    dedent
                    `<input class="w-100" type="${sqlToHTMLType(column.type)}" id="${idString}" name="${column.name}" 
                        <% if (data.formIntent === "update") { %>
                            value="<%= data.${column.name} %>"
                        <% } %>
                    /> <br/>`
                );
            }
            
            builder.pushIndentString(2, `</div>\n`);
            builder.pushString(
                dedent
                `    </div>
                    
                    <div class="modal-footer">
                        <input type="button" value="Close" class="btn btn-secondary" data-dismiss="modal" data-target="#crudModal">
                        <input type="submit" value="Submit" class="btn btn-primary">
                    </div>
                </form>
                `
            );
        },

        /**
         * 
         * @param {IndentedStringBuilder} builder 
         */
        applyTo: function (builder) {
            for (const [key, method] of Object.entries(aliasList)) {
                if (typeof key !== "string" || key === this.applyTo) {
                    continue;
                }

                while (builder.tryBeginReplaceBuffer(key)) {
                    method(builder);
                    builder.endReplaceBuffer();
                }
            }
        },
    };

    // TODO : Allow to get view templates from external files.
    // The header will be like (before or after <!DOCTYPE html>) :
    // <!-- === GENERATE-TEMPLATE === -->
    // <!-- "nameFix": { "value": "update", "position": "end" } -->
    // <!-- "otherSetting": { "value": true, "something": 42 } -->
    // <!-- === GENERATE-TEMPLATE === -->
    const defaultExtension = ".ejs";

    const templates = [
        new ViewTemplate(
            "Main",
            dedent
            `<!DOCTYPE html>
            <html class="no-js" lang="en">            
                <%- include(\`\${partials}/head\`) %>
                    
                <body>
                    <!-- Left NavBar -->
                    <%- include(\`\${partials}/nav\`) %>
                    
                    <!-- Right Panel -->
                    <div id="right-panel" class="right-panel">
                        <!-- Header-->
                        <%- include(\`\${partials}/header\`) %>
                        <!-- Header-->
                    
                        <%- include(\`\${partials}/breadcrumbs\`) %>
                    
                        <div class="content mt-3">
                            <div class="animated fadeIn">
                                <div class="row">
                                    <div class="col-md-12">
                                        <div class="card">
                                            <div class="card-header">
                                                <strong class="card-title">#VIEW_NAME#</strong>
                                                <button type="button" class="btn assAdd btn-secondary mb-1 float-right" data-toggle="modal" data-target="#crudModal" id="crudAddButton">
                                                    Add
                                                </button>
                                            </div>
                                            <div class="card-body">
                                                <table id="crud-table-main">
                                                    #TABLE_ELEMENT#
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- End Right Panel -->
                    
                    <!-- Action modal display -->
                    <div class="modal fade" id="crudModal" tabindex="-1" role="dialog" aria-labelledby="largeModalLabel" aria-hidden="true">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <!-- AJAX ile yüklenen modal içeriği buraya gelecek. -->
                            </div>
                        </div>
                    </div>
                    
                    <%- include(\`\${partials}/script\`) %>
                    
                    
                    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@10"></script>
                    
                    <!-- Table interact. -->
                    <script>
                        $("i[table-action]").on("click", function (e) {
                            const action = $(e.currentTarget).attr("table-action");
                            const removeNameIndex = action.indexOf("${actionAttrTypeRemove}");
                            const updateNameIndex = action.indexOf("${actionAttrTypeUpdate}");
                    
                            // serve delete view (embed inside script)
                            if (removeNameIndex > 0 && removeNameIndex <= 7) {
                                const rowID = action.substring(removeNameIndex + ${actionAttrTypeRemove.length});
                    
                                $("#crudModal .modal-content").html(\`
                                    <div class="modal-header">
                                        <h5 class="modal-title">#VIEW_NAME# Delete</h5>
                                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                            <span aria-hidden="true">&times;</span>
                                        </button>
                                    </div>
                                    <div class="modal-body">
                                        <p>Bu satırı silmek istediğinizden emin misiniz?</p>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Hayır</button>
                                        <button type="button" class="btn btn-danger" id="confirmRowDelete">Evet</button>
                                    </div>
                                    <form id="rowDeleteForm" action="/#VIEW_NAME#${actionFix.remove}Post" method="post" class="d-none">
                                        <input type="hidden" name="id" value="\${rowID}">
                                    </form>
                                \`);

                                $("#crudModal").modal("show");
                                $("#confirmRowDelete").on("click", function () {
                                    $("rowDeleteForm").submit();
                                });

                                return;
                            }
                            // thing that can be done with htmx in 2 seconds
                            if (updateNameIndex > 0 && updateNameIndex <= 7) {
                                const rowID = action.substring(updateNameIndex + ${actionAttrTypeUpdate.length});

                                $.ajax({
                                    url: "/#VIEW_NAME#${actionFix.update}",
                                    type: "GET",
                                    data: {
                                        id: rowID,
                                    },
                                    success: function (data) {
                                        $("#crudModal .modal-content").html(data);
                                        $("#crudModal").modal("show");
                                    },
                                    error: function (error) {
                                        console.error(error);
                                    },
                                });

                                return;
                            }

                            console.group(\`[#VIEW_NAME#] Invalid action attribute : \${action} for element : \`);
                            console.error(e.currentTarget);
                            console.groupEnd();
                        });
                        // Add button
                        $("#crudAddButton").on("click", function () {
                            $.ajax({
                                url: "/#VIEW_NAME#${actionFix.add}",
                                type: "GET",
                                success: function (data) {
                                    $("#crudModal .modal-content").html(data);
                                    $("#crudModal").modal("show");
                                },
                                error: function (error) {
                                    console.error(error);
                                },
                            });
                        });

                        // Handle URL changes
                        const urlParams = new URLSearchParams(window.location.search);
                        const myParam = urlParams.get("success");

                        if (myParam == "true") {
                            Swal.fire({
                                position: "top-end",
                                icon: "success",
                                title: "İşlem Başarılı",
                                showConfirmButton: false,
                                timer: 1500,
                            });
                            window.history.pushState("", "", "../#VIEW_NAME#");
                        }
                        if (myParam == "false") {
                            Swal.fire({
                                position: "top-end",
                                icon: "error",
                                title: "İşlem Başarısız",
                                showConfirmButton: false,
                                timer: 1500,
                            });
                            window.history.pushState("", "", "../#VIEW_NAME#");
                        }
                    </script>
                </body>
            </html>`,
            [ "SELECT * FROM #TABLE_NAME#" ]
        ),
        new ViewTemplate("Form",
            dedent
            `<div class="modal-dialog modal-lg" role="dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Modal title</h5>
                        <button type="button" class="close" data-dismiss="modal" data-target="#crudModal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    #FORM_ELEMENT#
                </div>
            </div>
            `
            // - By Default: formIntent: "add" | "update", but sent by the AJAX paramters.
            // - fKeyValues: { ColumnName: [values] }
            // Note : this requires a non-basic building, so the #FORM_ELEMENT# alias checks if the generated builder is instanceof ViewTemplate.
            // - If so, the foreign keys are added to the serving of this view.
        ),
    ];

    for (const view of viewsMapList) {
        // Get informative columns.
        /** @type {TableInformativeColumn[] | undefined} */
        let columns;
        try {
            columns = await sqlGetInformativeColumns(view.tableName);
            if (columns.length <= 0) {
                throw new Error(`[generate-views-controller] No columns on ${view.tableName}.`);
            }
        } catch (err) {
            console.error(
                outColor.fgRed,
                `[generate-views-controller] Failed to call 'sqlGetInformativeColumns' on ${view.tableName} with exception:`,
                outColor.reset
            );
            console.error(err);
            console.error(outColor.fgRed, "[generate-views-controller] This could mean that the table may not exist on the db.", outColor.reset);

            if (options.ignoreErrors) {
                console.warn(outColor.fgYellow, "[generate-views-controller] Continuing generation (--ignore-errors)", outColor.reset);
                continue;
            }

            if (!(await ynPrompt("[generate-views-controller:generate] Continue generating? (Y/N) : "))) {
                throw "[generate-views-controller:generate] Exiting (non-fatal error).";
            } else {
                continue;
            }
        }

        if (options.debug) {
            console.log(`[generate-views-controller:debug] View ${view.tableName} columns is :\n${JSON.stringify(columns, undefined, 4)}`);
        }

        // Generate page views.
        for (const viewT of templates) {
            aliasConfig.config(view, columns);

            const mutableTemplate = new ViewTemplate(viewT.name, viewT.content, viewT.serveQueries, viewT.extension);
            if (!mutableTemplate.content) {
                console.warn(
                    outColor.fgYellow,
                    `[generate-views-controllers] Invalid entry on template(s) list : `,
                    outColor.fgWhite,
                    outColor.bgBlack,
                    "\n",
                    viewT,
                    outColor.reset
                );
                continue;
            }

            // Generate view content.
            aliasList.applyTo(mutableTemplate);

            // TODO : Append the generated controller for this view.
            // controllerResult += generateControllerFor(t, columns) + "\n";

            // File
            /** @type {string} */
            let fileName = (view.name ?? "") + mutableTemplate.name + "." + (mutableTemplate.extension || defaultExtension);

            console.log("\n[generate-views-controllers] ===");
            console.log(`File     : ${fileName}`);
            console.log(`Template : `);

            if (options.viewsOutput.toLowerCase() === "stdout") {
                console.log(mutableTemplate.content);
            } else {
                // anything else is '==' "file path"
                // create root ./views/viewName/viewName-prefix.ejs
                // TODO : Create root output path. For now, just create the './viewName/viewName-prefix.ejs'
                const outputPath = path.resolve(process.cwd(), options.viewsOutput);
                if (!fs.existsSync(outputPath)) {
                    fs.mkdirSync(outputPath);
                }

                fs.writeFileSync(path.resolve(outputPath, fileName), mutableTemplate.content);
            }
        }
    }
}

/**
 * Cleans up the application handles.
 * Yes, node does clean up when exiting, but if ran through the terminal as single app.
 */
function cleanup() {
    rl.close();

    if (primaryInspector) {
        inspector.close();
        primaryInspector = null;
    }
    if (sqlPool) {
        sqlPool.close().then(() => {
            sqlPool = null;
        });
    }
}

main()
    .then(() => {
        cleanup();
        process.exit(0);
    })
    .catch((exitError) => {
        // non-fatal exits should throw a bare string.
        if (exitError) {
            if (typeof exitError !== "string") {
                console.error(outColor.bgRed, outColor.fgBlack, "[!!] [generate] Begin Fatal or Uncaught Error ====", outColor.reset);
                console.error(exitError);
                console.error(outColor.bgRed, outColor.fgBlack, "[!!] [generate] End Fatal or Uncaught Error ====", outColor.reset);
            } else {
                console.error(outColor.fgRed, "[!!] [generate] Exit :", exitError, outColor.reset);
            }
        }

        try {
            cleanup();
        } catch (e) {
            console.error(outColor.bgBlack, outColor.fgWhite, "[!!] [generate] 'cleanup' Error. This must not happen.", outColor.reset);
            console.error(e);
        }

        process.exit(1);
    });
