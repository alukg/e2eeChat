/**
 * Created by guy on 22/03/18.
 */

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));

io.on('connection', function(client) {
    var username = client.handshake.query.name;
    var pass = client.handshake.query.pass;

    checkIfUserAndPassOk(username,pass).then(function(result) {
        return doSomethingElse(result);
    }).catch(failureCallback);

    if (checkIfUserAndPassOk(username,pass)) {

        console.log('Client connected...');

        //client.emit('serverMessage', client.id + 'Hello from server');

        client.on('clientMessage', function (data) {
            console.log(data);
            client.emit('serverMessage', 'Hello from server');
        });
    }
    else{

    }
});

server.listen(4200);