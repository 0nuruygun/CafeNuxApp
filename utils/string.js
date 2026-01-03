// ---
// Title   : General String Utility
// Purpose : String related utility.
// Note    : <none>
// ---

const typeutil = require("./type");
const crypto = require("crypto");

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
function indent(times, spaceCount = 4) {
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
function trimStart(str, char) {
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
function trimEnd(str, char) {
    if (!str) {
        return str;
    }

    let i = str.length - 1;
    while (str[i] === char) {
        i--;
    }

    return str.substring(0, i);
}
/**
 * @param {string} str
 * @param {string} char
 * @returns {string}
 */
function trim(str, char) {
    return trimStart(trimEnd(str, char), char);
}

const characterList = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~0123456789";

/**
 * Random string generated using Math.random().
 * @param {Number} length
 */
function randomString(length) {
    typeutil.assertNumber("[string::randomString] Given length invalid.", true, length);

    if (length <= 0) {
        return "";
    }

    let result = "";

    for (let i = 0; i < length; i++) {
        result += characterList[Math.floor(Math.random() * (characterList.length - 1))];
    }

    return result;
}

/**
 * A random string, generated using PRNG of 'crypto', that has less predictability.
 * @param {Number} length
 */
function cryptoRandomString(length) {
    typeutil.assertNumber("[string::cryptoRandomString] Given length invalid.", true, length);

    if (length <= 0) {
        return "";
    }

    let result = "";

    const valuesBuffer = new Uint8Array(length);
    crypto.getRandomValues(valuesBuffer); // Range is undefined, so modulo them. May cause predictability.
    for (let i = 0; i < length; i++) {
        result += characterList[valuesBuffer[i] % characterList.length];
    }

    return result;
}

module.exports = {
    nicifyString,
    indent,
    trimStart,
    trimEnd,
    trim,
    randomString,
    cryptoRandomString,
};
