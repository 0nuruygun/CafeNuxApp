// --
require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").Server(app);
const bodyParser = require("body-parser");
const session = require("express-session");
/** @type {import("socket.io").Server} */
const io = require("socket.io")(http);
// --
const router = require("./routers");
const apiLimiter = require("./middleware/rateLimit");
const socket = require("./routers/socket");
const local = require("./utils/locals")

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(
    session({
        secret: process.env.EJS_ROUTER_SECRET ? process.env.EJS_ROUTER_SECRET.split(",") : ["Keyboard Cat :3 Meow", "0xDEADBEEF"],
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 21600000 },
    })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(apiLimiter);
app.use(router);
app.set("socketio", io);

app.locals = local.lcc;
// socket.io emits the 'routers/socket' on 'connection'
io.on("connection", socket.handler);

const port = process.env.PORT || 3000;

http.listen(port, () => {
    console.log(`[app.js] CafeNux running at http://localhost:${port}`);
});
