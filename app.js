/**
 * Created by guy on 22/03/18.
 */

let dbFuncs = require('./dbFuncs.js'),
    express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    sio = require('socket.io')(server),
    bodyParser = require('body-parser'),
    session = require('express-session');

app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let sessStore = new session.MemoryStore();
let sessionMiddleware = session({
    store: sessStore,
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    name: 'express.sid',
    key: 'express.sid'
});
app.use(sessionMiddleware);

app.get("/", function (req, res) {
    if(req.session.user)
        res.sendFile(__dirname + '/chat.html');
    else
        res.sendFile(__dirname + '/login.html');
});
app.get("/login", function (req, res) {
    res.sendFile(__dirname + '/login.html');
});
app.get("/register", function (req, res) {
    res.sendFile(__dirname + '/register.html');
});
app.get("/chat", function (req, res) {
    if(req.session.user) {
        // check if user exists on db
        dbFuncs.checkIfUserExists(req.session.user).then(
            () => {
                res.sendFile(__dirname + '/chat.html');
            }, (err) => {
                req.session.destroy(function(err) {
                    if(err) {
                        console.log(err);
                        res.end();
                    } else {
                        res.redirect('/');
                    }
                });
            });
    }
    else {
        res.redirect('/login');
    }
});
app.post('/register', function(req, res) {
    dbFuncs.createUser(req.body.email,req.body.pass,req.body.certPem).then(
        () => {
            // sets a cookie with the user's info
            req.session.user = req.body.email;
            res.redirect('/chat');
        }, (err) => {
            console.log("register error: " + err);
            res.redirect('/register');
        });
});
app.post('/login', function(req, res) {
    dbFuncs.checkIfUserAndPassOk(req.body.email,req.body.pass).then(
        () => {
            // sets a cookie with the user's info
            req.session.user = req.body.email;
            res.redirect('/chat');
        }, (err) => {
            console.log("signin error: " + err);
            res.redirect('/login');
        });
});
app.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if(err) {
            console.log(err);
            res.end();
        } else {
            res.redirect('/login');
        }
    });
});

// ---------------- Socket-io ----------------

let users = [];

sio.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

sio.on("connection", function(socket) {
    console.log('connect user: ' + socket.request.session.user);
    let sessionUser = socket.request.session.user;

    users.push({socketId: socket.id, username: socket.request.session.user});

    socket.broadcast.emit('connectUser', sessionUser);

    sendUsersList(sessionUser);
    sendWaitingMessages(sessionUser);

    setInterval(function(){
        sendUsersList(sessionUser);
    }, 2000);

    socket.on('message', function (userdata) {
        let socketId = null;
        for( let i=0; i < users.length; i++ ){
            let c = users[i];
            if(c["username"] === userdata["to"]){
                socketId = c["socketId"];
                break;
            }
        }
        if (socketId === null){
            dbFuncs.pushMessageToServer(sessionUser,userdata["to"],userdata["data"]).then(() => {}, (err) => {});
        }
        else{
            sio.sockets.connected[socketId].emit('message',{from: sessionUser, data: userdata["data"]});
        }
    });

    function sendUsersList(sessionUser){
        dbFuncs.getUsersList().then(
            (usersList) => {
                let connectedUsers = [];
                for( let i=0; i < users.length; i++ )
                    connectedUsers.push(users[i]["username"]);
                remove(usersList, sessionUser);
                socket.emit('usersList', { allUsers: usersList, connectedUsers: connectedUsers});
            }, (err) => {
            });
    }

    function sendWaitingMessages(sessionUser){
        dbFuncs.getWaitingMessages(sessionUser).then(
            (messages) => {
                socket.emit('waitingMessages', messages);
            }, (err) => {
            });
    }

    socket.on('disconnect', function (data) {
        for( let i=0; i < users.length; i++ ){
            let c = users[i];
            if(c["socketId"] === socket.id){
                users.splice(i,1);
                socket.broadcast.emit('disconnectUser', sessionUser);
                break;
            }
        }
    });
});

// ---------------- API ----------------

/*
app.get("/api/getUsersList", function (req, res) {
    dbFuncs.getUsersList().then(
        (usersList) => {
            res.json(usersList);
        }, (err) => {
            res.json(err);
        });
});
*/

// ---------------- Help functions ----------------

function remove(array, element) {
    const index = array.indexOf(element);

    if (index !== -1) {
        array.splice(index, 1);
    }
}

server.listen(4200);