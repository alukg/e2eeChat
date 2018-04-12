/**
 * Created by guy on 22/03/18.
 */

let dbFuncs = require('./dbFuncs.js');
let express = require('express');
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io')(server);
let bodyParser = require('body-parser');

app.use(express.static(__dirname + '/'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", function (req, res) {
    res.sendFile(__dirname + '/login.html');
});
app.get("/login", function (req, res) {
    res.sendFile(__dirname + '/login.html');
});
app.get("/signup", function (req, res) {
    res.sendFile(__dirname + '/signup.html');
});
app.get("/chat", function (req, res) {
    res.sendFile(__dirname + '/chat.html');
});

app.post('/signup', function(req, res) {
    dbFuncs.createUser(req.body.email,req.body.pass).then(
        () => {
            res.redirect('/chat');
        }, (err) => {
            console.log("signup error: " + err);
            res.redirect('/signup');
        });
});
app.post('/login', function(req, res) {
    dbFuncs.checkIfUserAndPassOk(req.body.email,req.body.pass).then(
        () => {
            res.redirect('/chat');
        }, (err) => {
            console.log("signin error: " + err);
            res.redirect('/signin');
        });
});

io.on('connection', function(client) {
    let username = client.handshake.query.name;
    let pass = client.handshake.query.pass;
    let sts = client.handshake.query.sts;

    if (sts == FuncSts.signin){
        dbFuncs.checkIfUserAndPassOk(username,pass).then(
            () => {
                console.log('Client connected...');

                client.on('clientMessage', function (data) {

                });

                client.on('disconnect', function(){
                    //client.broadcast.to(roomName).emit('user_leave', {user_name: "johnjoe123"});
                });

            }, (err) => {
                client.emit('serverMessage', err);
                client.disconnect();
            });
    }
    else{ // user sign up
        dbFuncs.createUser(username,pass).then(
            () => {
                console.log('Client sign up and connected...');


            }, (err) => {
                client.emit('serverMessage', err);
                client.disconnect();
            });
    }
});

server.listen(4200);