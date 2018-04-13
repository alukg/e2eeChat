/**
 * Created by guy on 22/03/18.
 */

let dbFuncs = require('./dbFuncs.js');
let express = require('express');
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io')(server);
let bodyParser = require('body-parser');
let session = require('express-session');
let cookieParser = require('cookie-parser');

app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    // When there is nothing on the session, save it
    saveUninitialized: true,
    // Don't update session if it changes
    resave: false,
    // Name of your cookie
    name: 'login cookie',
    // Secret of your cookie
    secret: 'secret'
}));

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
    dbFuncs.createUser(req.body.email,req.body.pass).then(
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

io.on('connection', function(client) {
    console.log('Client connected...');
    client.on('clientMessage', function (data) {

    });
    client.on('disconnect', function(){
        //client.broadcast.to(roomName).emit('user_leave', {user_name: "johnjoe123"});
    });
});

server.listen(4200);