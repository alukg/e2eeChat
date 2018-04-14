/**
 * Created by guy on 22/03/18.
 */

let dbFuncs = require('./dbFuncs.js'),
    express = require('express'),
    app = express(),
    https = require('https'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    fs = require('fs');

app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const opts = { key: fs.readFileSync(__dirname + "/CA/server_key.pem", 'utf8')
    , cert: fs.readFileSync(__dirname + "/CA/server_cert.pem", 'utf8')
    , requestCert: true
    , rejectUnauthorized: false
    , ca: [ fs.readFileSync(__dirname + "/CA/server_cert.pem", 'utf8') ] };

let server = https.createServer(opts,app).listen(4200);

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

app.get('/authenticate', (req, res) => {
    cert = req.connection.getPeerCertificate();
    if (req.client.authorized) {
        res.send(`Hello ${cert.subject.CN}, your certificate was issued by ${cert.issuer.CN}!`);
    } else if (cert.subject) {
        res.status(403).send(`Sorry ${cert.subject.CN}, certificates from ${cert.issuer.CN} are not welcome here.`);
    } else {
        res.status(401).send(`Sorry, but you need to provide a client certificate to continue.`);
    }
});

app.get("/", function (req, res) {
    if(req.session.user)
        res.redirect('/chat');
    else
        res.redirect('/login');
});
app.get("/login", function (req, res) {
    res.sendFile(__dirname + '/login.html');
});
app.get("/register", function (req, res) {
    if (req.client.authorized) {
        res.sendFile(__dirname + '/register.html');
    } else {
        res.status(401).sendFile(__dirname + '/cert_err.html');
    }
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
    let cert = req.connection.getPeerCertificate();
    dbFuncs.createUser(req.body.email,req.body.pass,cert).then(
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

const sio = require('socket.io')(server);

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