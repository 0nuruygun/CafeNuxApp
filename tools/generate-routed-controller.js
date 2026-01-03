// --
// Name    : Generate 'createRoutedControllerFor', from the database.
// Purpose : To streamline the generation. Views generation is still TODO, because i cannot parse or do string manipulation. That requires an IQ above room temprature, which i don't have.
// Usage   : $ # With the current existing visible views, this is how the generate looks like.
//           $ node .\tools\generate-routed-controller.js -include "(Assignment, Categories, Channels, Companies, FinancialTransactions, Messages, Notifications,
//           > Orders, Payment, UsersPermissions, Positions, Products, Suppliers, TableInfo, UserLevel, Users)" --route-root "routeRoot" # or null
//           ... output ...
//           $ # To get more information about the args, see 'const options = '
// --

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
const sql = require("mssql");
// optional requires.
requireOptional("dotenv")?.config();

// #region Util Import
/**
 * @template T
 * @param {T[]} array
 * @param {T[]|T} elem
 * @returns {boolean}
 */
function any(array, elem) {
    const isElemArray = Array.isArray(elem);

    for (const v of array) {
        if (isElemArray) {
            for (const e of elem) {
                if (v === e) {
                    return true;
                }
            }
        } else {
            if (v === elem) {
                return true;
            }
        }
    }

    return false;
}

// #region ANSI Escapes
/**
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

// #region ReadLine
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

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
// #endregion

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
    if (!args) {
        return;
    }

    if (typeof options.optionCount === "undefined") {
        options.optionCount = 1;
    }
    if (typeof options.throwIfOptionMismatch === "undefined") {
        options.throwIfOptionMismatch = true;
    }

    const indexOfArgument = args.indexOf(args.find((v) => argNames.includes(v)));
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
 * @param {TemplateStringsArray|string} templateStrings
 * @returns {string}
 */
function dedent(templateStrings) {
    var values = [];

    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }

    var matches = [];
    var strings = typeof templateStrings === "string" ? [templateStrings] : templateStrings.slice();

    // 1. Remove trailing whitespace.
    strings[strings.length - 1] = strings[strings.length - 1].replace(/\r?\n([\t ]*)$/, "");

    // 2. Find all line breaks to determine the highest common indentation level.
    for (var i = 0; i < strings.length; i++) {
        var match = void 0;

        if ((match = strings[i].match(/\n[\t ]+/g))) {
            matches.push.apply(matches, match);
        }
    }

    // 3. Remove the common indentation from all strings.
    if (matches.length) {
        var size = Math.min.apply(
            Math,
            matches.map(function (value) {
                return value.length - 1;
            })
        );
        var pattern = new RegExp("\n[\t ]{" + size + "}", "g");

        for (var i = 0; i < strings.length; i++) {
            strings[i] = strings[i].replace(pattern, "\n");
        }
    }

    // 4. Remove leading whitespace.
    strings[0] = strings[0].replace(/^\r?\n/, "");

    // 5. Perform interpolation.
    var string = strings[0];

    for (var i = 0; i < values.length; i++) {
        string += values[i] + strings[i + 1];
    }

    return string;
}
// #endregion

// #endregion

// #region SQL
/** @type {sql.ConnectionPool} */
let sqlPool;

/**
 * Get all of the primary keys for tables.
 *
 * Tables should exist on the main schema.
 *
 * @returns {Promise<sql.IRecordSet<{
 *     TABLE_NAME: string,
 *     ID_COLUMN: string,
 *     PK_COLUMN: string,
 * }>>}
 */
async function sqlGetAllIDOrPKey() {
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[sqlGetIdentityOrPK] sqlPool hasn't connected or has been initialized : ${JSON.stringify(sqlPool, undefined, 4)}`);
    }

    const request = sqlPool.request();
    return (
        await request.query(`(SELECT (K.TABLE_NAME) AS TABLE_NAME, (C.name) AS ID_COLUMN, (K.COLUMN_NAME) PK_COLUMN
            FROM SYS.OBJECTS O
                INNER JOIN SYS.COLUMNS C ON O.object_id = C.object_id
                INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE K ON O.name = K.TABLE_NAME
                INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS TK ON O.name = TK.TABLE_NAME AND K.CONSTRAINT_NAME = TK.CONSTRAINT_NAME
            WHERE C.is_identity = 1 AND TK.CONSTRAINT_TYPE = 'PRIMARY KEY')
        `)
    ).recordset;
}

/**
 * @param {string} tableName
 * @returns {Promise<sql.IRecordSet<{ name: string }>>}
 */
async function sqlGetAllForeignKeyTables() {
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[sqlHasForeignKeys] sqlPool hasn't connected or has been initialized : ${JSON.stringify(sqlPool, undefined, 4)}`);
    }

    const request = sqlPool.request();
    return (
        await request.query(`SELECT DISTINCT name FROM sys.foreign_key_columns fkc
            INNER JOIN sys.tables tbl ON tbl.object_id = fkc.parent_object_id`)
    ).recordset;
}
// #endregion

// TODO : Add alias feature
// The alias feature allows you to change view name to something else and make it not gathered naively from the database table list.

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
            encrypt: process.argv.includes("--db-encrypt"),
            trustServerCertificate: !process.argv.includes("--db-notrust-server-cert"),
        },
    },

    // general settings
    debug: any(process.argv, ["--debug", "-d"]),
    // expected to be in format of "[elem, some other elem, idk] or (same thing, really)"
    includeList: getOptionArgumentValue(["-i", "-include", "--include-list"], process.argv),
    excludeList: getOptionArgumentValue(["-e", "-exclude", "--exclude-list"], process.argv),
    tableDisplayColumnsMap: getOptionArgumentValue(["-d-col-map", "--display-columns-map"]),
    routeRootName: getOptionArgumentValue(["--route-root", "-rroot"], process.argv),
    // paths for output
    useConstructedFunction: any(process.argv, ["--use-construct-function", "-use-c-func"]),
    output: getOptionArgumentValue(["--output"]) || "stdout",
};

/**
 * Gets a value in the format of `[something, something 2]` and exports the values.
 *
 * Also applies to `(something, something 2)` as well.
 *
 * @param {string} v
 *
 * @returns {string[]?}
 */
function getListValues(v) {
    if (!v) {
        return v;
    }

    const match = /[\[\(]([\S\s]*)[\]|\)]/.exec(v);
    const values = match && match[1] ? match[1].split(",") : null;
    if (values) {
        values.forEach((elem, i) => {
            values[i] = elem.trim();
        });
    }

    return values;
}

async function main() {
    const reqErrors = Object.entries(optionalRequireErrors);
    for (const [k, v] of reqErrors) {
        console.error(outColor.fgRed, `[generate-routed-controller] Error on optional require("${k}")=\n${v}`, outColor.reset);
    }

    sqlPool = await sql.connect(options.dbConfig);
    if (!sqlPool || !sqlPool.connected) {
        throw new Error(`[generate-routed-controller:sql] Failed to connect with configuration\n${JSON.stringify(options.dbConfig, undefined, 4)}`);
    }

    // includeList overrides excludeList
    const includeList = getListValues(options.includeList);
    const excludeList = getListValues(options.excludeList);
    // TODO : got too hairy, implement proper parsing and stacking
    // // Used to map foreign key value selects to have a pretty display.
    // const tableDisplayColumnMap = {};
    // // This is also a map on it's own rights, so append.
    // for (const displayColumnPair of getListValues(options.tableDisplayColumnsMap)) {
    //     // DisplayColumnPair is to be expected on the format of
    //     // (ownerRelationalTable, [(fkReferencedTable, DisplayColumn), ()])
    //     // const pairRegex = /[\(\[]([^,]*)[\s,]*[(]([^,]*)[\s,]*([^,]*)[)][\)\]]/;
    //     const pairRegex = /[\(\[]([^,]*)[\s,]*[(](.*)[)][\)\]]/;
    //     const pairResult = pairRegex.exec(displayColumnPair);
    //     if (!pairResult || pairResult.length < 4) {
    //         console.error(outColor.fgRed, `[generate-routed-controller:--display-columns-map] Invalid argument entry : ${displayColumnPair}`, outColor.reset);
    //     }

    //     const ownerRelationalTable = pairResult[1];
    //     const fkRelationalList = getListValues(pairResult[2]);
    //     const referencedTable = pairResult[2];
    //     const displayColumn = pairResult[3];
    //     tableDisplayColumnMap[ownerRelationalTable] = {
    //         referencedTable,
    //         displayColumn,
    //     };
    // }
    if (options.debug) {
        console.log(outColor.fgGreen, "[generate-routed-controller:args:debug] includeList: ", includeList, outColor.reset);
        console.log(outColor.fgGreen, "[generate-routed-controller:args:debug] excludeList: ", excludeList, outColor.reset);
    }

    let declareResult = "";
    let exportResult = "";
    const fkeyTables = await sqlGetAllForeignKeyTables();
    const identityKeys = await sqlGetAllIDOrPKey();
    for (let i = 0; i < identityKeys.length; i++) {
        const identityKey = identityKeys[i];
        if (includeList && !includeList.includes(identityKey.TABLE_NAME)) {
            if (options.debug) {
                console.log(outColor.fgYellow, `[generate-routed-controller:debug] Not including ${identityKey.TABLE_NAME}`, outColor.reset);
            }
            continue;
        }
        if (excludeList && excludeList.includes(identityKey.TABLE_NAME)) {
            if (options.debug) {
                console.log(outColor.fgYellow, `[generate-routed-controller:debug] Excluding ${identityKey.TABLE_NAME}`, outColor.reset);
            }
            continue;
        }

        const isRelational = !!fkeyTables.find((fk) => fk.name === identityKey.TABLE_NAME);
        // naively assume that the view name + URL = table name with everything to lower case
        const viewName = identityKey.TABLE_NAME.toLowerCase();
        // this is camelCase
        const valueName = identityKey.TABLE_NAME[0].toLowerCase() + identityKey.TABLE_NAME.substring(1);

        declareResult += `const ${valueName} = `;
        // --
        if (!options.useConstructedFunction) {
            declareResult += dedent`createRoutedController({
                routeName: "${viewName}",
                routeRootURL: ${options.routeRootName ?? "null"},

                tableName: "${identityKey.TABLE_NAME}",
                tableIdColumn: "${identityKey.ID_COLUMN ?? identityKey.PK_COLUMN}",
                tableIsRelational: ${isRelational},
            });
            
            `;            
        } else {
            // all string except 'tableIsRelational'
            // createRoutedControllerFor(routeName, routeURL, routeRootURL, tableName, tableIdColumn, tableIsRelational);
            console.warn(outColor.fgYellow, "[generate-routed-controller:--use-construct-function] This option is deprecated, run this without the constructed argument.", outColor.reset);
            declareResult += `createRoutedControllerFor("${viewName}", "${viewName}", ${options.routeRootName ?? "null"}, "${identityKey.TABLE_NAME}", "${
                identityKey.ID_COLUMN ?? identityKey.PK_COLUMN
            }", ${isRelational});\n`;
        }
        exportResult += `    ${valueName},\n`;
    }

    let result = `${declareResult}\nmodule.exports = {\n${exportResult}};\n`;

    if (!options.output || options.output === "stdout") {
        console.log(result);
    } else {
        if (fs.existsSync(options.output)) {
            fs.appendFileSync("\n" + options.output, result);
        } else {
            fs.writeFileSync(options.output, result);
        }
    }
}

/**
 * Cleans up the application handles.
 * Yes, node does clean up when exiting, but if ran through the terminal as single app.
 */
function cleanup() {
    rl.close();

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
