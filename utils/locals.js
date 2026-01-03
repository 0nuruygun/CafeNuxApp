const path = require('node:path');

const lcc = {
    /**
     * Stores the current partials path, so that you don't have to get relative path to it.
     */
    partials: path.resolve(process.cwd(), "views/partials"),
    // WHY? wdym 'Not applicable' https://learn.microsoft.com/en-us/sql/t-sql/data-types/datetime-transact-sql?view=sql-server-ver16#description
    // Note : It is theoretically possible to select ISO 8601 date from the columns,
    // but it requires explicit column declaration, which we don't have unless we want to go back into the 2000+ LOC. Why did SQL have to be like this?
    // Maybe it could have been better if date was just a integer, but then it doesn't have the date type intent.
    // --
    // Normal 'date' datatype does have a default format though. Shame it doesn't support second times
    /**
     * **WARNING** : This only applies to mssql locale ci_turkish or ci_latin_something_idk.
     *
     * It does not apply to the other locales.
     * 
     * This is for the '&lt;input type="date"&gt;' format initial value : https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date
     * @param {string|number} dateString Date to convert.
     *
     * If number, assumed to be a unix timestamp.
     * @param {boolean?} omitHMS Whether to omit hour, min and sec. If false, not omitted. Timezone is also omitted with this.
     * @param {"append" | "add" | undefined} applyTZMode Whether to apply the local timezone.
     * - `"append"` : Appends the timezone as '+0300' (timezone may differ)
     * - `"add"` : Adds the timezone to the clock. This may cause confusion, so don't use it.
     * - `undefined` : Doesn't append any timezone to the identifier. May cause confusion if date is parsed from a local datetime and is not UTC+0000.
     *    This may also cause confusion, but unfortunately HTML is neglected since probably 2014 or something, so it's the default mode. (because it doesn't support TZ)
     * @param {boolean?} trustDateParse Whether to trust date parsing, in case of an ISO8601 or RFC3339 format date. If false, not trusted. (default is not trust)
     *
     * @returns {string}
     */
    sqlDate2ISODate: function (dateString, omitHMS, applyTZMode, trustDateParse) {
        if (dateString instanceof Date) {
            let result = "";

            const yyyy = (dateString.getUTCFullYear() + "").padStart(4, "0");
            const mo = ((dateString.getUTCMonth() + 1) + "").padStart(2, "0");
            // Day of the 'Date' object is called 'Date'
            // 'getDay' returns which day is the Date of that week. dafuq?
            const dd = (dateString.getUTCDate() + "").padStart(2, "0");
            result += `${yyyy}-${mo}-${dd}`;

            if (!omitHMS) {
                const hh = (dateString.getHours() + "").padStart(2, "0");
                const mm = (dateString.getMinutes() + "").padStart(2, "0");
                const ss = (dateString.getSeconds() + "").padStart(2, "0");
                result += `T${hh}:${mm}:${ss}Z`;
            }

            return result;
        }

        // TODO : Oh boy, the date format has changed. Billions must regex.
        // It is simpler though.
        // (note : update still serves the default MSSQL date thing, so it works. BUT FIX is still needed !!)
        if (typeof dateString === "number") {
            if (Number.isNaN(dateString)) {
                // or return invalid date?
                return "0000-01-01T00:00:00";
            }

            // TODO : Timezone dependent (to the backend). Should be UTC, but for JS Date, it's a big thing.
            return new Date(dateString).toISOString();
        }
        if (trustDateParse) {
            const dateParseResult = Date.parse(dateString);
            if (!Number.isNaN(dateParseResult)) {
                // TODO : Timezone dependent.
                return new Date(dateParseResult).toISOString();
            }
        }
        if (typeof dateString !== "string") {
            dateString = new String(dateString);
        }

        /**
         * Pad 2 '0's for the start
         * @param {number} n
         * @returns {string}
         */
        function p2(n) {
            return (n + "").padStart(2, "0");
        }

        try {
            // An example time string would look like :
            // Fri Mar 22 2024 03:00:00 GMT+0300 (GMT+03:00)
            // Which we have to convert. The month is written in english, wow great. A number is bad anyways.
            // prettier-ignore
            const months = {
                "Jan": 1,  "Oca": 1,
                "Feb": 2,  "Şub": 2, "Sub": 2,
                "Mar": 3,  "Mar": 3,
                "Apr": 4,  "Nis": 4,
                "May": 5,  "May": 5,
                "Jun": 6,  "Haz": 6,
                "Jul": 7,  "Tem": 7,
                "Aug": 8,  "Ağu": 8, "Agu": 8,
                "Sep": 9,  "Eyl": 9,
                "Oct": 10, "Eki": 10,
                "Nov": 11, "Kas": 11,
                "Dec": 12, "Ara": 12,
            };
            let isoString = "";
            // Ignore 'Fri' and go ahead to the other values
            /** @type {string[]} */
            const dateSegments = dateString.split(" ").splice(1);
            let month = Object.entries(months).find(([monthName, _id]) => dateSegments[0].includes(monthName))[1];
            let day = Number.parseInt(dateSegments[1]);
            let year = Number.parseInt(dateSegments[2]);
            if (!omitHMS) {
                // Also parse TZ
                // Note : Appending TZ causes 'datetime' or 'datetime-local' to fail
                // So, if a local field is requested, set the 'hour' from the integer.
                const tzSegment = dateSegments[4];
                let tzSign = tzSegment[tzSegment.indexOf("GMT") + "GMT".length] === "-" ? 1 : -1; // can be '+' or '-'
                let tzHourMinOffset = /GMT\+(\d{2})(?:\:)?(\d{2})/.exec(dateSegments[4]);

                const hmsSegments = dateSegments[3].split(":");
                let hour = Number.parseInt(hmsSegments[0]);
                let min = Number.parseInt(hmsSegments[1]);
                let sec = Number.parseInt(hmsSegments[2]);

                switch (applyTZMode) {
                    case "add":
                        // do mins first to account the changes it does to hour
                        let minDeltaResult = min + Number.parseInt(tzHourMinOffset[2]) * tzSign;
                        hour += Math.floor(minDeltaResult / 60);
                        if (minDeltaResult < 0) {
                            minDeltaResult += 24;
                        }
                        min = minDeltaResult % 60;

                        let hourDeltaResult = hour + Number.parseInt(tzHourMinOffset[1]) * tzSign;
                        day += Math.floor(hourDeltaResult / 24);
                        if (hourDeltaResult < 0) {
                            hourDeltaResult += 24;
                        }
                        hour = hourDeltaResult % 24;

                        isoString += `${p2(year)}-${p2(month)}-${p2(day)}`;
                        isoString += `T${p2(hour)}:${p2(min)}:${p2(sec)}`;
                        // No timezone attached, because web browsers are currently rediscovering ways of not knowing what a date is.
                        // when will temporal release??!?!?!? probably when C++73 releases.
                        break;
                    case "append":
                        isoString += `${p2(year)}-${p2(month)}-${p2(day)}`;
                        isoString += `T${p2(hour)}:${p2(min)}:${p2(sec)}`;
    
                        // Append according to RFC3339 or ISO8601, whatever, they are mostly the same.
                        isoString += `+${p2(tzHourMinOffset[1])}${p2(tzHourMinOffset[2])}`;
                        break;
                    default:
                        isoString += `${p2(year)}-${p2(month)}-${p2(day)}`;
                        isoString += `T${p2(hour)}:${p2(min)}:${p2(sec)}`;
                        break;
                }
            } else {
                // no timezone, no date, no problem
                isoString += `${p2(year)}-${p2(month)}-${p2(day)}`;
            }

            return isoString;
        } catch (err) {
            console.error(`[app.locals::sqlDate2ISODate] Error occured with string : ${dateString} type ${typeof dateString}`);
            console.error(err);
            return "";
        }
    },
};

module.exports = {lcc}