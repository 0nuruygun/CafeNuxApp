const onlineUsers = require("../utils/global");
const langEnv = process.env.LANG.split(',')
/**
 * @typedef {import("express").Request} EJSRequest
 * @typedef {import("express").Response} EJSResponse
 * @typedef {import("express").NextFunction} EJSNextError
 */

/**
 * @param {EJSRequest} req
 * @param {EJSResponse} _res
 */
const reCaptcha = async function (capToken, remoteAddress) {
    try {
        if (!capToken || capToken === undefined || capToken === "" || capToken === null) {
            return { success: false, message: "Lütfen doğrulamayı tamamlayın." };
        }

        const secretKey = process.env.CAPTCHA_SEC;

        // Google reCAPTCHA v3 doğrulama URL
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";

        // POST parametreleri
        const params = new URLSearchParams();
        params.append("secret", secretKey);
        params.append("response", capToken);
        if (remoteAddress) {
            params.append("remoteip", remoteAddress);
        }

        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        const result = await response.json();

        if (!result.success) {
            return { success: false, message: "Captcha doğrulaması yapılamadı.", details: result };
        }

        // İsteğe bağlı ek kontroller (v3 için)
        // if (result.action !== "login" || result.score < 0.5) {
        //     return { success: false, message: "Şüpheli etkinlik algılandı.", details: result };
        // }

        return { success: true, details: result };
    } catch (err) {
        console.error("reCAPTCHA doğrulama hatası:", err);
        return { success: false, message: "Sunucu hatası." };
    }
};


/**
 * @param {Object} data 
 * @param {string} url 
 * @returns {Promise<any>}
 */
const postData = async function (data, url) {
    try {
        const response = await fetch(process.env.AUTHURL + url, {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, *cors, same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data), // body data type must match "Content-Type" header
        });
        // req.mess =  response.json(); // parses JSON response into native JavaScript objects
        return response.json();
    } catch (err) {
        console.log(err);
    }
};

/**
 * @param {EJSRequest} req
 * @param {EJSResponse} _res
 * @param {EJSNextError} next
 */

const loginVerify = async (req, _res, next) => {
    let capt = await reCaptcha(req.body.recaptchaToken, req.socket.remoteAddress);
    if (capt.success === true) {
        await postData({ email: req.body.user, password: req.body.pass }, "api/login").then((data) => {
            if (!(data === undefined)) {
                if (data.success === true) {
                    req.session.user = req.body.user;
                    req.session.token = data.token;
                    req.session.name = data.name;
                    req.session.lastname = data.lastname;

                    // Kullanıcıyı eklemeden önce varsa eski session'ı kill et
                    const existingUser = onlineUsers.getOnlineUsers().find(u => u.userId === data.userId);
                    if (existingUser && existingUser.sessionId !== req.sessionID) {
                        req.sessionStore.destroy(existingUser.sessionId, (err) => {
                            if (err) {
                                console.error("Önceki session kill edilemedi:", err);
                            } else {
                                console.log(`Eski session (${existingUser.sessionId}) başarıyla kill edildi.`);
                            }
                        });
                    }

                    // Yeni session ekle
                    onlineUsers.addUser({
                        sessionId: req.sessionID,
                        roomId: data.roomId,
                        isCheff: data.isCheff,
                        userId: data.userId,
                        name: data.name,
                        lastname: data.lastname
                    });

                    if (data.lang) {
                        langEnv.forEach(item => {
                            if (item == data.lang) {
                                _res.cookie('languages', data.lang, { expires: "Fri, 31 Dec 9999 23:59:59 GMT", httpOnly: false });
                            }
                        });
                    }

                } else {
                    req.mess = data.message;
                }
            } else {
                req.mess = "Sunucudan yanıt alınamadı.";
            }
        });
    } else {
        req.mess = capt.message;
    }
    next();
};


const mobileVerify = async (req, _res, next) => {
    const token = req.headers.authorization;
    const data = JSON.parse(req.headers.data);
    
    let user = data.email;
    let pass = data.password;
    let sess = req.sessionID;

    let capt = await reCaptcha(token, req.socket.remoteAddress);
    
    if (capt.success === true) {
        await postData({ email: user, password: pass }, "api/login").then((data) => {
            if (!(data === undefined)) {
                if (data.success === true) {
                    onlineUsers.addUser({ 
                        sessionId: sess, 
                        roomId: data.roomId, 
                        isCheff: data.isCheff, 
                        userId: data.userId, 
                        name: data.name, 
                        lastname: data.lastname
                    });
                    _res.send({ 
                        sessionId: sess, 
                        roomId: data.roomId, 
                        isCheff: data.isCheff, 
                        userId: data.userId,
                        name: data.name, 
                        lastname: data.lastname
                    });
                } else {
                    _res.status(404).json({ error: data });
                }
            } else {
                return _res.status(404).json({ error: data });
            }
        });
    } else {
        _res.send(capt.message);
    }
    next();
};

/**
 * @param {EJSRequest} req
 * @param {EJSResponse} _res
 * @param {EJSNextError} next
 */
const isAuthenticated = async (req, _res, next) => {
    if (req.session.user) {

        await fetch(process.env.AUTHURL + "api/me",
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'mode': "no-cors",
                    'Authorization': 'Bearer ' + req.session.token
                },
                method: "get"
            }).then(async function (data) {
                data = await data.json()
                req.Sessionn = data;
                await next();
            })
    }
    else _res.redirect('/login')
}

module.exports = {
    isAuthenticated,
    loginVerify,
    mobileVerify
};
