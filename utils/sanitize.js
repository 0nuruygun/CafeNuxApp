/**
 * @param {any} string
 * @param {boolean} assertInteger
 * @deprecated Use `toSqlLiteral` or `toSqlString`.
 *
 * `toSqlLiteral` ensures that the string is safe to use as an typed, non-nvarchar parameter to the sql query.
 *
 * `toSqlString` ensures that the string is safe to use as a nvarchar parameter to the sql query.
 * @returns {string|Number}
 */
const sanitize = (string, assertInteger = false) => {
    // Previous behaviour of 'sanitize' is similar to this.
    if (string !== undefined && string !== null) {
        return string;
    }
    if (assertInteger) {
        return Number.parseInt(string);
    }

    return toSqlLiteral(string);
};

/**
 * Converts thing to a sql inputtable string/nvarchar definition.
 *
 * ### ⚠WARNING⚠ : This method will surround the string with "'" `'like this'`.
 *
 * The sql.Request.input with sql.NVarChar does the same thing causing incorrect/broken strings.
 *
 * ### **⚠Only use this method if you are passing js objects directly to the query string⚠**
 * @param {*} obj
 * @returns {string}
 */
const toSqlString = (obj) => {
    if (obj === null || obj === undefined) {
        return "NULL";
    }

    const resultString = new String(obj);
    return `'${resultString.replace(/'/gm, "''")}'`;
};
/**
 * Converts thing to a sql inputtable string/nvarchar definition.
 *
 * An alias for the function, toSqlString.
 *
 * #### ⚠WARNING⚠ : This method will surround the string with "'" `'like this'`.
 */
const toSqlVarChar = toSqlString;
/**
 * Converts thing to a sql inputtable literal to avoid injection by removing syntatic characters.
 * Not the safest method but will do for the time being.
 *
 * Useful for such cases where a user input key literal has to be specified. (not string but anything basically)
 * @param {*} obj
 * @returns {string}
 */
const toSqlLiteral = (obj) => {
    if (obj === null || obj === undefined) {
        return "NULL";
    }

    const resultString = new String(obj);
    // remove ', --, (), and many others..
    // TODO : This regex could be slow. The 'input()' tests input against /(--| |\/\*|\*\/|')/ to throw EINJECT
    return `${resultString.replace(/['\(\)"!'^+\-%&@]|(--|\/\*|\*\/)/gm, "")}`;
};

module.exports = { sanitize, toSqlLiteral, toSqlString, toSqlVarChar };
