/**
 * Created by guy on 22/03/18.
 */

/**
 * npm imports and definitions
 */
let dbFuncs = require('./dbFuncs.js'),
    express = require('express'),
    app = express(),
    https = require('https'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    fs = require('fs');

/**
 * Defining base folder for project
 */
app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Defining server params
 */
const opts = { key: fs.readFileSync(__dirname + "/CA/server_key.pem", 'utf8')
    , cert: fs.readFileSync(__dirname + "/CA/server_cert.pem", 'utf8')
    , requestCert: true
    , rejectUnauthorized: false // In order to control it ourselves by messages
    , ca: [ fs.readFileSync(__dirname + "/CA/server_cert.pem", 'utf8') ] };

let server = https.createServer(opts,app).listen(4200);

/**
 * Sessions management
 */
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

/**
 * Page for authentication check - Displays the status of the user
 */
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

/**
 * Land page
 */
app.get("/", function (req, res) {
    if(req.session.user)    // If there is an active session
        res.redirect('/chat');
    else
        res.redirect('/login');
});
/**
 * Login page request
 */
app.get("/login", function (req, res) {
    res.sendFile(__dirname + '/login.html');
});
/**
 * Register page request
 */
app.get("/register", function (req, res) {
    if (req.client.authorized) {    // Check if there is appropriate certificates before try to register
        res.sendFile(__dirname + '/register.html');
    } else {
        res.status(401).sendFile(__dirname + '/cert_err.html');
    }
});
/**
 * Chat page request
 */
app.get("/chat", function (req, res) {
    if(req.session.user) {  // If there is an active session
        // Check if user exists on db - Maybe the session still exists but the user not
        dbFuncs.checkIfUserExists(req.session.user).then(
            () => {
                res.sendFile(__dirname + '/chat.html');
            }, (err) => {
                // If not - close the session
                req.session.destroy(function(err) {
                    if(err) {
                        console.log(err);
                        res.end();
                    } else {
                        // Return to landing page
                        res.redirect('/');
                    }
                });
            });
    }
    else {  // If there is no active session - redirect to login
        res.redirect('/login');
    }
});
/**
 * User register request
 */
app.post('/register', function(req, res) {
    let cert = req.connection.getPeerCertificate(); // get the certificate of the session to store them in the db
    // let certUsername = cert.subject["CN"];
    // if (certUsername !== req.body.email){
    //     console.log("register error: wrong certificate");
    //     res.redirect('/register');
    // }
    // else
    // {
        dbFuncs.createUser(req.body.email,req.body.pass,cert).then( // try to create user
            () => {
                // sets a cookie with the user's info
                req.session.user = req.body.email;
                res.redirect('/chat');
            }, (err) => {
                // if fail - redirect to register page with error to display
                console.log("register error: " + err);
                res.redirect('/register?err=' + err);
            });
    // }
});
/**
 * User login request
 */
app.post('/login', function(req, res) {
    // let cert = req.connection.getPeerCertificate();
    // let certUsername = cert.subject["CN"];
    // if (certUsername !== req.body.email){
    //     console.log("signin error: wrong certificate");
    //     res.redirect('/login');
    // }
    // else
    // {
        // check if the user already connected in the connected users array
        let found = false;
        for( let i=0; i < users.length; i++ ){
            let c = users[i];
            if(c["username"] === req.body.email){   // compare to the request username
                found = true;
                break;
            }
        }
        if(found)   // if connected - redirect to login page with error to display
        {
            console.log("signin error: User already connected");
            res.redirect('/login?err=User already connected');
        }
        else{   // if not connected - check if user exists on db
            dbFuncs.checkIfUserAndPassOk(req.body.email,req.body.pass).then(
                () => {
                    // sets a cookie with the user's info
                    req.session.user = req.body.email;
                    res.redirect('/chat');
                }, (err) => {
                    // if not exists - redirect to login page with error to display
                    console.log("signin error: " + err);
                    res.redirect('/login?err=' + err);
                });
        }
    // }
});
/**
 * User logout request
 */
app.get('/logout', function(req, res) {
    // destroy the session and redirect to login page
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

const sio = require('socket.io')(server);   // attach the socket.io process to the server

let users = [];

/**
 * attach the socket.io process to the session management
 * it means that if the session is closed the socket.io connection is terminated
 */
sio.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

/**
 * Wait for new connection
 */
sio.on("connection", function(socket) {
    console.log('connect user: ' + socket.request.session.user);
    let sessionUser = socket.request.session.user;

    users.push({socketId: socket.id, username: socket.request.session.user});   // add the user to the connected user array

    socket.broadcast.emit('connectUser', sessionUser);  // broadcast all the users that there is new connected user

    sendUsersList(sessionUser); // send the list of all the users to the new user from the db
    sendWaitingMessages(sessionUser);   // send all the waiting messages for the new user from the db

    /**
     * Every 2 minutes refresh the list of the users for that user
     */
    setInterval(function(){
        sendUsersList(sessionUser);
    }, 2000);

    /**
     * Set message listener from that user to server
     * These messages are intended for another users
     * The server need to decide what to do with them
     */
    socket.on('message', function (userdata) {
        let socketId = null;
        // get the socket id of the user that the message are intended to
        for( let i=0; i < users.length; i++ ){
            let c = users[i];
            if(c["username"] === userdata["to"]){
                socketId = c["socketId"];
                break;
            }
        }
        if (socketId === null){ // if there is no socket id, that means the user disconnected. In that case - store the message
            dbFuncs.pushMessageToServer(sessionUser,userdata["to"],userdata["data"]).then(() => {}, (err) => {console.log(err)});
        }
        else{   // if the user connected pass the message to that user through his socket
            sio.sockets.connected[socketId].emit('message',{from: sessionUser, data: userdata["data"]});
        }
    });

    /**
     * Get the users list from the server and pass to the socket user
     * @param sessionUser - The name of the current user, to remove him from the list
     */
    function sendUsersList(sessionUser){
        dbFuncs.getUsersList().then(
            (usersList) => {
                let connectedUsers = [];
                for( let i=0; i < users.length; i++ )
                    connectedUsers.push(users[i]["username"]);
                removeUserFromList(usersList, sessionUser);
                socket.emit('usersList', { allUsers: usersList, connectedUsers: connectedUsers});
            }, (err) => {
            });
    }

    /**
     * Get the waiting messages for some user
     * @param sessionUser - The username of the user that the messages are intended to
     */
    function sendWaitingMessages(sessionUser){
        dbFuncs.getWaitingMessages(sessionUser).then(
            (messages) => {
                socket.emit('waitingMessages', messages);
            }, (err) => {
            });
    }

    /**
     * Set a disconnect listener.
     */
    socket.on('disconnect', function (data) {
        for( let i=0; i < users.length; i++ ){
            let c = users[i];
            if(c["socketId"] === socket.id){
                users.splice(i,1);  // remove the user from the connected users list
                socket.broadcast.emit('disconnectUser', sessionUser);   // broadcast all the users that this user was disconnected
                break;
            }
        }
    });
});


// ---------------- API ----------------
// ajax get calls for files from the server

app.get("/api/getCACert", function (req, res) {
    res.send(fs.readFileSync(__dirname + "/CA/server_cert.pem", 'utf8'));
});

app.get("/api/getUserKey", function (req, res) {
    res.send(fs.readFileSync(__dirname + "/certificates/alice/alice_key.pem", 'utf8'));
});

app.get("/api/getUserCert", function (req, res) {
    res.send(fs.readFileSync(__dirname + "/certificates/alice/alice_cert.pem", 'utf8'));
});

// ---------------- Help functions ----------------

/**
 * Remove user by user name from list of names
 * @param array - list of usernames
 * @param element - name to remove
 */
function removeUserFromList(array, element) {
    let i;
    let found = 0;
    for(i=0; i < array.length; i++){
        if(array[i]["username"] === element){
            found = 1;
            break;
        }
    }
    if(i === array.length)
        i--;
    if(found === 1)
        array.splice(i,1);
}