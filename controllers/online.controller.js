const db = require("../routers/db");
const sanitize = require("../utils/sanitize");
const onlineUsers = require("../utils/global");
/**
 * #### This method basically seperates adjacent lower case and upper case in order. It keeps the rest of the given string intact.
 * ---
 * • Converts the string to a nicified string according to these rules :
 * 1. Check if the previous character is lowercase (does not apply to the first index)
 * 1. > if true -&gt; Check if the current character is uppercase
 * 1. > > if true -&gt; Append a space to the buffer
 * 1. Append the character to the buffer
 * ---
 * With this, strings that look like -&gt; `OrdersOfID`
 *
 * Convert to -&gt; `Orders Of ID`.
 *
 * ---
 * ⚠ However, there are some limitations as this method does not work in an "dictionary/haystack" basis.
 *
 * For example, if we reverse the previous example as `IDOfOrders`
 *
 * The resulting string will look like : `IDOf Orders` as `IDOf` is assumed as an single word.
 *
 * ---
 * The nicification also is naming convention dependant, for example, `camelCase` won't look good
 * but `PascalCase` and `snake_case` *"may look good"* but that is not guaranteed.
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
 * @typedef {import("express").Request} EJSRequest
 * @typedef {import("express").Response} EJSResponse
 * @typedef {import("express").NextFunction} EJSNextFunction
 */

/**
 * @param {EJSRequest} _req
 * @param {EJSResponse} res
 */
const index = function (req, res) {
    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);

    if(room){
        db.execsql(`EXECUTE dbo.sp_Dashboard ${room.roomId}`).then((result) => {
            let data = {};
            let name = req.session.name + ' ' + req.session.lastname
            data.graph = JSON.stringify(result.slice(0, 6));
            data.list = result.slice(6);
            res.render("index", { data , name});
        });
    }
    else
        res.redirect("login")
};

/**
 * @param {EJSRequest} _req
 * @param {EJSResponse} res
 */
const tables = function (_req, res) {

    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === _req.sessionID);
    let name = _req.session.name + ' ' + _req.session.lastname
    res.render("tables",{data:_req.sessionID, name});
};

/**
 * @param {EJSRequest} _req
 * @param {EJSResponse} res
 */
const kitchen = function (_req, res) {
    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === _req.sessionID);
    let name = _req.session.name + ' ' + _req.session.lastname
    res.render("kitchen",{data:_req.sessionID, name});
};

const ReservationAdd = function (req, res) {

    var date = new Date(req.body.rezDate.replace(/(\d+).(\d+).(\d+)/, '$3-$2-$1'));

    let room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID)
    let ReservationDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    let ReservationTable = req.body.rezTable;
    let ReservationName = req.body.rezName;
    let ReservationPhone = req.body.rezPhone;

    let query = `
    INSERT Reservations 
    ( 
        [ReservationName],
        [ReservationPhone],
        [ReservationDate],
        [ReservationTable],
        [ReservationCreateDate],
        [ReservationUser],
        [Room],
        [isReserved]
    )
    VALUES
    (
        '${ReservationName}',
        '${ReservationPhone}',
        '${ReservationDate}',
         ${ReservationTable},
         GETDATE(),
        '${room.userId}',
        '${room.roomId}',
        1
    )
    `
    try {
        db.execsql(query).then((result)=>{
            res.send(result)
        })
        
    } catch (error) {
        res.send(error, "Kayıt yapılamadı !")
    }
};

/**
 * TODO : Does not function, requires the values to be dynamically gathered from the 'nav.ejs'
 * Changes the inner html of the right panel according to the given getTable, showing it as a view.
 * @param {EJSRequest} req
 * @param {EJSResponse} res
 */
const admin = async function (req, res) {
    const tableKey = sanitize.toSqlString(req.params.table);
    const result = await db.execsql(`
        EXEC getTable @key=${tableKey}, @op='select', @json='{}'
        DECLARE @tblName NVARCHAR(255)
        SET @tblName = [dbo].[idToTableName](${tableKey})
        SELECT [dbo].[getIdentityOrPKColumn](@tblName) AS ID_COLUMN
        SELECT @tblName AS DB_TABLE_NAME
    `);
    if (result[0]) {
        let data = result[0];
        // metadata.
        let mangledTableName = req.params.table;
        let actualTableName = null;
        if (result[1]) {
            data.idColumn = result[1][0]?.ID_COLUMN;
        }
        if (result[2]) {
            actualTableName = result[2][0]?.DB_TABLE_NAME;
        }
        data.tableHeader = nicifyString(req.params.displayHeader ?? actualTableName);

        // data.
        data.datafield = Object.keys(data.columns);
        data.datafieldTxt = [];

        data.datafield.forEach((str) => {
            data.datafieldTxt.push(nicifyString(str));
        });

        res.render("admin", { data, table: mangledTableName });
    } else {
        throw new Error("[admin] No result from getTable request for table " + req.params.table);
    }
};

module.exports = {
    index,
    admin,
    tables,
    kitchen,
    ReservationAdd
};
