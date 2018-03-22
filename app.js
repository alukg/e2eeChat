/**
 * Created by guy on 22/03/18.
 */

var dbFuncs = require('./dbFuncs.js');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

var FuncSts = {"signin":1, "signup":2}
Object.freeze(FuncSts);

io.on('connection', function(client) {
    var username = client.handshake.query.name;
    var pass = client.handshake.query.pass;
    var sts = client.handshake.query.sts;

    if (sts === FuncSts.signin){
        dbFuncs.checkIfUserAndPassOk(username,pass).then(
            () => {
                console.log('Client connected...');

                client.on('clientMessage', function (data) {
                    console.log(data);
                    client.emit('serverMessage', 'Hello from server');
                });

                client.on('disconnect', function(){
                    client.broadcast.to(roomName).emit('user_leave', {user_name: "johnjoe123"});
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

                client.on('clientMessage', function (data) {
                    console.log(data);
                    client.emit('serverMessage', 'Hello from server');
                });

                client.on('disconnect', function(){
                    client.broadcast.to(roomName).emit('user_leave', {user_name: "johnjoe123"});
                });
            }, (err) => {
                client.emit('serverMessage', err);
                client.disconnect();
            });
    }
});

server.listen(4200);