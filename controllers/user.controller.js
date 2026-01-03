const onlineUsers = require("../utils/global");

const login = function (req, res) {
    res.render('login');
}

const users = async function (req, res) {

    try {

        const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
        let result = await fetch(process.env.AUTHURL + "api/us", {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, *cors, same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + req.session.token
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify({"room":room.roomId}), // body data type must match "Content-Type" header
        })
        let data = {}
        data.columnData = await result.json();
        data.columnData = await req.query.ID ? data.columnData.find(item => item._id === req.query.ID): data.columnData
        let vw = await req.query.ID ? "users/usersUpdate" : "users/users"
        data.name = req.session.name + req.session.lastname
        await res.render(vw, {data});
        
    } catch (error) {
        console.log(error)
        res.render("error",error)      
    }
}

const usersAdd = function (req, res) {
    res.render('users/usersAdd')
}

const usersAddPost = async function (req, res) {
    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
    let data = {}
    data.tc = req.body.tc;
    data.name = req.body.name;
    data.lastname = req.body.lastname;
    data.email = req.body.email;
    data.phone = req.body.phone;
    data.password = req.body.password;
    data.isActive = (req.body.isActive === "true");
    data.isCheff = (req.body.isCheff === "true");
    data.roomId = room.roomId;

    try {
        
        let result = await fetch(process.env.AUTHURL + "api/register", {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, *cors, same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + req.session.token
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            'Authorization': 'Bearer ' + req.session.token,
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data), // body data type must match "Content-Type" header
        })
        
        apiResponse = await result.json();

        !apiResponse.success ? await res.redirect(`users/?error=${apiResponse.message}`):

        await res.redirect('users/?success=true');
        
    } catch (error) {
        console.log(error)
        res.render("error",error)      
    }
}

const usersUpdatePost = async function (req, res) {
    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
    let data = {}
    data._id = req.body.id;
    data.tc = req.body.tc;
    data.name = req.body.name;
    data.lastname = req.body.lastname;
    data.email = req.body.email;
    data.phone = req.body.phone;
    data.password = req.body.password;
    data.isActive = (req.body.isActive === "true");
    data.roomId = room.roomId;
    data.password = 'FakePass0!';

    try {
        
        let result = await fetch(process.env.AUTHURL + "api/userUpdate", {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, *cors, same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + req.session.token
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data), // body data type must match "Content-Type" header
        })
        
        apiResponse = await result.json();

        !apiResponse.success ? await res.redirect(`users/?error=${apiResponse.message}`):

        await res.redirect('users/?success=true');
        
    } catch (error) {
        console.log(error)
        res.render("error",error)      
    }
}

const usersDeletePost = async function (req, res) {
    const room = onlineUsers.getOnlineUsers().find(item => item.sessionId === req.sessionID);
    const roomId = room.roomId;
    const id = req.body.ID;
    try {
        
        let result = await fetch(process.env.AUTHURL + "api/userDelete", {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, *cors, same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + req.session.token
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify({_id:id,roomId:roomId}), // body data type must match "Content-Type" header
        })
        
        apiResponse = await result.json();

        !apiResponse.success ? await res.redirect(`users/?error=${apiResponse.message}`):

        await res.send(apiResponse.success);
        
    } catch (error) {
        console.log(error)
        res.render("error",error)      
    }
}

const loginPost = function (req, res) {
    if (req.session.user) {
        res.redirect('/')
    }
    else
        res.render('login', { success: false, message: req.mess })
}

const logout = function (req, res, next) {
    // logout logic

    // clear the user from the session object and save.
    // this will ensure that re-using the old session id
    // does not have a logged in user
    req.session.user = null
    req.session.save(function (err) {
        if (err) next(err)

        // regenerate the session, which is good practice to help
        // guard against forms of session fixation
        req.session.regenerate(function (err) {
            if (err) next(err)
            res.redirect('/')
        })
    })
}

module.exports = {
    login,
    loginPost,
    logout,
    users,
    usersAdd,
    usersAddPost, 
    usersDeletePost, 
    usersUpdatePost
};