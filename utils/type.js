// ---
// Title   : General Type Util
// Purpose : Type checking related utility. Mostly contains type assertions.
// Note    : <none>
// ---

/**
 * Formats the custom error with aliases.
 * 
 * - #ARGS# : List of the arguments.
 * @template {string?} TMsg
 * 
 * @param {TMsg} msg Message to format. If null, nothing is done.
 * @param {any[]} args
 * 
 * @returns {TMsg}
 */
function fmtCustomError(msg, args) {
    if (!msg) {
        return msg;
    }

    let result = msg;
    const argsToString = args ? args.join(", ") : "!NO ARGS!";
    result = result.replace(/#ARGS#/gm, argsToString);

    return result;
}

/**
 * Asserts whether if the value is a number.
 * 
 * Throws if assertion fails.
 * @param {string} errorMessage
 * @param {boolean?} failNaN
 * @param {...any} values
 */
function assertNumber(errorMessage, failNaN, ...values) {
    for (const value of values) {
        if (typeof value !== "number") {
            throw new Error(fmtCustomError(errorMessage, values) || "[utility/type-check::assertNumber] (typeof value !== number)");
        }
        if (failNaN && Number.isNaN(value)) {
            throw new Error(fmtCustomError(errorMessage, values) || "[utility/type-check::assertNumber] (typeof value === number) but (Number.isNaN(value) && failNaN)");
        }
    }
}

/**
 * Checks if the string is a number, without any weird results.
 * Note : This is a more strict number checker. It does not handle 'E' notation or anything fancy.
 * @param {string} input
 * @returns {boolean}
 */
function isNumberString(input) {
    if (input === null || input === undefined) {
        return false;
    }

    // sure, this can be a few characters of regex. but i value my sanity currently.
    // feel free to refactor it to regex.
    // Rules :
    // 1. ignore whitespace
    // 2. minus can only occur on start, before anything has occured.
    // 3. decimal place seperator can only occur once. decimal place culture is ignored.
    // 4. otherwise, only allow digits.
    let decimalSeperatorOccured = false,
        numberOccured = false,
        minusOccured = false;
    const zeroCharCode = 48,
        nineCharCode = 57,
        periodCharCode = 46,
        commaCharCode = 44,
        minusCharCode = 45;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (/\s/.test(char)) {
            continue;
        }

        const charCode = char.charCodeAt(0);
        const isPunctuation = charCode === periodCharCode || charCode === commaCharCode;
        const isMinus = charCode === minusCharCode;
        // minus
        if (isMinus) {
            if (decimalSeperatorOccured || numberOccured || minusOccured) {
                return false;
            }
            minusOccured = true;
            continue;
        }
        // punctuation
        if (isPunctuation) {
            // check for 'numberOccured' here as we aren't checking if it's exclusively float
            if (decimalSeperatorOccured || !numberOccured) {
                return false;
            }
            decimalSeperatorOccured = true;
            continue;
        }
        // number
        if (charCode < zeroCharCode || charCode > nineCharCode) {
            return false;
        }
        numberOccured = true;
    }

    return true;
}

/**
 * Converts value to a valid integer with fallback.
 * @param {*} value
 * @param {Number?} fallback The fallback. Only required if the number fails to convert.
 * @returns {Number}
 */
function toValidInteger(value, fallback) {
    // invalid fallback, check only if value fails.
    // ..
    // non-0 falsy value
    if (!value && typeof value !== "number") {
        assertNumber('[utility/type-check::toValidInteger] typeof fallback !== "number"', false, fallback);
        return fallback;
    }

    // invalid string (strict)
    if (!isNumberString(value)) {
        assertNumber('[utility/type-check::toValidInteger] typeof fallback !== "number"', false, fallback);
        return fallback;
    }

    // NaN when parsed
    const resultInt = Number.parseInt(value);
    if (Number.isNaN(resultInt)) {
        assertNumber('[utility/type-check::toValidInteger] typeof fallback !== "number"', false, fallback);
        return fallback;
    }

    return resultInt;
}

/**
 * Check if all of the values are string.
 * 
 * Throws if assertion fails.
 * @param {string} errorMessage Error message when thrown.
 * @param  {...any} values Values that should be string.
 */
function assertString(errorMessage, ...values) {
    for (const elem of values) {
        if (typeof elem !== "string") {
            throw new Error(fmtCustomError(errorMessage, values) || `[utility/type-check::assertString] (typeof ${elem} !== string)`);
        }
    }
}

module.exports = {
    assertString,

    assertNumber,
    isNumberString,
    toValidInteger,
};
