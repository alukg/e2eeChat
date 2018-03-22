/**
 * Created by guy on 22/03/18.
 */

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var MongoClient = require('mongodb').MongoClient;

app.use(express.static(__dirname + '/node_modules'));
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/MyDb", function (err, db) {

    if(err) throw err;



});

io.on('connection', function(client) {
    console.log('Client connected...');

    client.emit('serverMessage', client.id + 'Hello from server');

    client.on('clientMessage', function (data) {
        console.log(data);
        client.emit('serverMessage', 'Hello from server');
    });
});

server.listen(4200);