const rateLimit = require("express-rate-limit");

/**
 * @typedef {import("express").Request} EJSRequest
 * @typedef {import("express").Response} EJSResponse
 * @typedef {import("express").NextFunction} EJSNextError
 */

const allowList = ["::1", "127.0.0.1", "localhost"];
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    limit: 100,                 // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false,       // Disable the `X-RateLimit-*` headers.
    // store: ... ,             // Use an external store for consistency across multiple server instances.

    /**
     * @param {EJSRequest} req
     * @param {EJSResponse} _res
     */
    max: (req, _res) => {
        if (req.url === "/login" || req.url === "/register") {
            return 5;
        } else {
            return 100;
        }
    },
    message: {
        success: false,
        // message: "Çok fazla istekte bulundunuz !",
        message: "429 Too Many Requests",
    },
    /**
     * @param {EJSRequest} req
     * @param {EJSResponse} _res
     */
    skip: (req, _res) => allowList.includes(req.ip),
});

module.exports = apiLimiter;
