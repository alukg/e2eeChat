/**
 * Created by guy on 22/03/18.
 */

var socket = io.connect('http://localhost:4200');
// Add a connect listener
socket.on('connect',function() {
    console.log('Client has connected to the server!');
});
// Add a connect listener
socket.on('serverMessage',function(data) {
    console.log('Received a message from the server!',data);
});
// Add a disconnect listener
socket.on('disconnect',function() {
    console.log('The client has disconnected!');
});

// Sends a message to the server via sockets
function sendMessageToServer(message) {
    socket.emit('clientMessage', message);
};

sendMessageToServer("Yo server!");