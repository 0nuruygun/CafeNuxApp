const router = require("express").Router();

const { login, loginPost, logout, users, usersAdd, usersAddPost, usersDeletePost, usersUpdatePost } = require("../controllers/user.controller");
const { index, tables, kitchen, ReservationAdd } = require("../controllers/online.controller");
const tableApi = require("../controllers/tableapi.controller");

const { isAuthenticated, loginVerify, mobileVerify } = require("../middleware/checkAuth");

/**
 * @typedef {import("express").Request} EJSRequest
 * @typedef {import("express").Response} EJSResponse
 * @typedef {import("express").NextFunction} EJSNextError
 */

/**
 * Whether to send a vague error to client on 'handleErrors'. A non-vague error is outputted to the console instead.
 */
const sendVagueError = process.env.DEBUG ?? true;

/**
 * Creates a by-default exception handling ExpressJS routing callback, to avoid the server from crashing on any error / inconvenience.
 *
 * This will send a 500 status code by default, you can probably intercept the ExpressJS next with a middleware.
 * @template TFnReturnType Type that the 'fn' function returns. This can declare a Promise, which the ExpressJS will wait.
 * @param {function(EJSRequest, EJSResponse, EJSNextError?):TFnReturnType} fn The function to call with the request and the response.
 * @param {function(Error|any):void} onError Callback called when the error is directed to the ExpressJS.
 * @returns {function(EJSRequest, EJSResponse, EJSNextError):TFnReturnType}
 */
function handleErrors(fn, onError = null) {
    if (fn === null || fn === undefined) {
        throw new Error("[index::handleErrors] Given 'fn' variable is null or undefined. Cannot handle any error.");
    }

    return (req, res, next) => {
        function sendError(e) {
            if (sendVagueError) {
                next(new Error("[handleErrors] An error occured."));
                // print server side instead
                console.error("[--- handleErrors ---]");
                console.error(e);
                console.error("[--- handleErrors ---]");
            } else {
                next(e);
            }

            if (onError && typeof onError !== "boolean") {
                onError(e);
            }
        }

        try {
            const result = fn.length >= 3 ? fn(req, res, next) : fn(req, res);
            if (result instanceof Promise) {
                result.catch((e) => {
                    sendError(e);
                });
            }
            return result;
        } catch (e) {
            sendError(e);
        }
    };
}

router.get("/login", login);

router.get("/logout", handleErrors(logout));

router.post("/login", loginVerify, loginPost);

router.post("/mobileLogin", mobileVerify);

router.get("/users",handleErrors(isAuthenticated), users);

router.get("/usersAdd",handleErrors(isAuthenticated), usersAdd);

router.get("/usersUpdate",handleErrors(isAuthenticated), users);

router.post("/usersAddPost",handleErrors(isAuthenticated), usersAddPost);

router.post("/usersUpdatePost",handleErrors(isAuthenticated), usersUpdatePost);

router.post("/usersDeletePost",handleErrors(isAuthenticated), usersDeletePost);

router.post("/Reservation",handleErrors(isAuthenticated), ReservationAdd);

// !! accessing this shouldn't error out !!
router.get("/", index);
router.get("/tables", handleErrors(isAuthenticated), tables);
router.get("/kitchen", handleErrors(isAuthenticated), kitchen);

/** @type {Object<string, tableApi.URLRoutedController<function(tableApi.EJSRequest, tableApi.EJSResponse, tableApi.EJSNextFunction)>>[]} */
const tableApiControllers = Object.values(tableApi);
// parent module exports
for (const routedControllerList of tableApiControllers) {
    // module exports
    for (const routedController of Object.values(routedControllerList)) {
        switch (routedController.method?.toUpperCase()) {
            case "POST":
                router.post(routedController.routeURL, handleErrors(isAuthenticated), handleErrors(routedController.handler));
                break;
            default:
            case "GET":
                router.get(routedController.routeURL, handleErrors(isAuthenticated), handleErrors(routedController.handler));
                break;
        }
    }
}

module.exports = router;
