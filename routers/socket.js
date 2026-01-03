const db = require("./db");
const onlineUsers = require("../utils/global");
const { query } = require("mssql");
/**
 * @typedef {import("socket.io/dist/typed-events").DefaultEventsMap} DefaultEventsMap
 * @typedef {import("socket.io").Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>} SocketParam
 */
/**
 * Primary application socket middleware.
 * @param {SocketParam} socket
 */
const handler = async (socket) => {
    let start = {};
    let sId = socket.handshake.query.sessionId
    let room = onlineUsers.getOnlineUsers().find(item => item.sessionId === sId)
    
    if (room) {
        try {
            const result = await db.execsql(`EXECUTE dbo.sp_OnlineCafe '${room.roomId}'`);
            start.categories = result[0];
            start.productList = result[1];
            start.tables = result[2];
            start.orders = result[3];
            start.notification = result[4];
            //start.rez = result[5];
            //start.rez.forEach(reservation => {
            //    start.tables.forEach(item => {
            //        (item.TableInfoID === reservation.TableInfoID)? item.TableColor
            //    });
//
            //    (start.tables).find()
            //});
        } catch (error) {
            console.error(error);
        }

        socket.join(room.roomId);
        socket.on("get tables", async (callback) => {
            const tables = await db.execsql(`SELECT TblIndexName, TblIndexKey FROM TblIndex`);
        });
        socket.on("onlineOrder", async (castData, callback) => {
            let result;
            if (castData.option == "orders") {
                try {
                    result = await db.execsql(
                        `EXECUTE dbo.sp_SaveOrder ${castData.tableId}, ${castData.productId}, '${room.roomId}', '${room.userId}'`
                    ).then((result) => {
                        emitValue(result[0][0].Scope);
                    });
                } catch (e) {
                    if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            if (castData.option == "removeOrder") {
                try {
                    result = await db.execsql(
                        `EXEC sp_RemoveOrder ${castData.orderId},${castData.tableId},${castData.tableSessionId}`
                    ).then((result) => {
                        emitValue();
                    });
                } catch (e) {
                    if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            if (castData.option == "payment") {
                try {
                    result = await db.execsql(
                            `EXECUTE dbo.sp_CloseTable ${castData.paymentType}, ${castData.sesion}`
                        ).then((result) => {
                            emitValue();
                        });
                } catch (e) {
                    if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            if (castData.option == "tables") {
                try {
                    result = await db.execsql(
                            `EXECUTE dbo.sp_OpenTable ${castData.tableId} , ${castData.statusId} ,'${room.roomId}','${room.userId}'`
                        ).then((result) => {
                            emitValue(result[0][0].TableSessionId);
                        });
                } catch (e) {
                    if (e.errno === 19) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            if (castData.option == "notification") {
                castData.notification = castData.orderId + ' - ' + castData.tableName + ' - ' + castData.productName
                try {
                    // castdata string olarqak düzenlenecek 
                    let query = `EXECUTE dbo.sp_Notifications ${castData.orderId}, '${castData.notification}', '${room.roomId}'`
                    result = await db.execsql(query).then((res) => {
                            castData.bc = true;
                            castData.notId = res[0][0].id
                            emitValue();
                        });
                } catch (e) {
                    if (e.errno === 19) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            if (castData.option == "notificationUpdate") {
                try {
                    let query = `UPDATE Notifications set NotificationStatus=1 where Room = '${room.roomId}' and NotificationID = ${castData.notId}`
                    result = await db.execsql(query).then(() => {
                        castData.bc = true;
                        emitValue();
                    });
                } catch (e) {
                    if (e.errno === 19) {
                        callback();
                    } else {
                        // nothing to do, just let the client retry
                    }
                    return;
                }
            }

            async function emitValue(scope) {
                castData.bc = true;
                if (!scope) {
                    scope = null;
                }
                castData.scope = scope;
                socket.to(room.roomId).emit(
                    "onlineOrder",
                    castData,
                    callback({
                        status: "success",
                        scope: scope,
                    })
                );
            }
        });
    } else {
        // @unreachable : Room is always 1
        console.error("[socket::handler] Failed to initialize the room.");
        socket.emit("error", "Lütfen Sayfayı yenileyin.");
    }

    if (!socket.recovered && room) {
        try {
            // result = await db.execsql('SELECT Id, content FROM messages');
            result = await db.execsql(`SELECT MessagesID, MessagesDescription FROM Messages where Room = '${room.roomId}'`);
            const emitResult = JSON.stringify(start);
            socket.emit("onlineOrder", emitResult);
            
            // Note : Debugging only. Uncomment if no data is emitted to the DataTable.
            // console.trace(`[socket(at:${(new Date(Date.now())).toISOString()})] Emit\n"${emitResult}"`);
        } catch (e) {
            // something went wrong
            console.error(e);
        }
    }
};

module.exports = { handler };
