/**
 * Created by guy on 22/03/18.
 */

/**
 * npm imports and definitions
 */
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const pemtools = require('pemtools');

/**
 * Export modules for app.js use
 * @type {{createUser: createUser, checkIfUserAndPassOk: checkIfUserAndPassOk, getUsersList: getUsersList, checkIfUserExists: checkIfUserExists, pushMessageToServer: pushMessageToServer, getWaitingMessages: getWaitingMessages, getUserCert: getUserCert}}
 */
module.exports = {createUser,checkIfUserAndPassOk,getUsersList,checkIfUserExists,pushMessageToServer,getWaitingMessages,getUserCert};

/**
 * Create new user and store in db all the params
 * @param username
 * @param pass
 * @param cert - certificates of the user
 * @returns Promise that creates a new user
 */
function createUser(username,pass,cert) {
    cert = pemtools(cert.raw, 'CERTIFICATE').toString(); // Peer certificate format to PEM format
    cert = cert.replace(/\n/g,'');  // fix the format

    let query = (db) => {
        let certString = JSON.stringify(cert);  // make a string from the cert for db storage as text

        /**
         * create salt and hash password
         */
        let salt =  Math.random().toString(36).substr(2);
        const hmac = crypto.createHmac('sha256', salt);
        hmac.update(pass);
        let hashedPass = hmac.digest('hex');

        // create the needed queries for later invoke
        let getUserRow = `SELECT * FROM Clients WHERE username='${username}'`;
        let insertUser = `INSERT INTO Clients (username,pass,salt,cert) VALUES ('${username}','${hashedPass}','${salt}','${certString}')`;

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){   // check if there is a row with that username
                if (err) {
                    closeDb(db);
                    return reject(err);
                }
                else if (result.length > 0) {   // if true
                    closeDb(db);
                    return reject("Username already exists");
                }
                else{
                    db.all(insertUser, function(err, result){   // try to insert user
                        closeDb(db);
                        if (err)
                            return reject(err);
                        return resolve();
                    });
                }
            });
        });
    };

    return executeQuery(query);
}

/**
 * compare the inserted user params to the db and check if they are fine
 * @param username
 * @param pass
 * @returns Promise that makes the check
 */
function checkIfUserAndPassOk(username,pass) {
    let query = (db) => {
        let getUserRow = "SELECT * FROM Clients WHERE username='" + username + "'";

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){ // check if there is a row with that username
                closeDb(db);

                if (err)
                    return reject(err);
                else if (result.length === 0)   // if there is no line
                    return reject("User doesn't exists");

                // if there is user with that username
                let salt =  result[0]['salt'];  // get the salt from the db
                const hmac = crypto.createHmac('sha256', salt);
                hmac.update(pass); // hash the inserted password with the salt from the db
                let hashedPass = hmac.digest('hex');

                if (hashedPass === result[0]['pass']) // if the current hash and the hash from the db are the same
                    return resolve();
                else
                    return reject("Password incorrect");
            });
        });
    };

    return executeQuery(query);
}

/**
 * checks if username exists in db
 * @param username
 * @returns Promise that checks if username exists in db
 */
function checkIfUserExists(username) {
    let query = (db) => {
        let getUserRow = "SELECT * FROM Clients WHERE username='" + username + "'";

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                closeDb(db);

                if (err)
                    return reject(err);
                else if (result.length === 0)
                    return reject("User doesn't exists");
                else
                    return resolve();
            });
        });
    };

    return executeQuery(query);
}

/**
 * Get the list of all the users from the db
 * @returns Promise that resolve the list of users
 */
function getUsersList(){
    let query = (db) => {
        let getUsers = "SELECT username,cert FROM Clients";

        return new Promise((resolve,reject) => {
            db.all(getUsers, function(err, rows){
                closeDb(db);

                if (err)
                    reject(err);
                else{
                    let usersArray = [];
                    // convert the lines of the db to usernames array
                    Object.keys(rows).forEach(key => {
                        usersArray.push({username: rows[key].username, cert: rows[key].cert});
                    });
                    resolve(usersArray);
                }
            });
        });
    };

    return executeQuery(query);
}

/**
 * Push some message to server
 * @param from - the username that the message was sended from
 * @param to - the username that the message was sended to
 * @param message
 * @returns Promise that invoke the query and return if succeeded
 */
function pushMessageToServer(from,to,message){
    let query = (db) => {
        let push = `INSERT INTO Messages ("to","from",message) VALUES ('${to}','${from}','${message}')`;

        return new Promise((resolve,reject) => {
            db.all(push, function(err, data){
                closeDb(db);

                if (err)
                    reject(err);
                else{
                    resolve();
                }
            });
        });
    };

    return executeQuery(query);
}

/**
 * Gets all the waiting messages for specific user from the db and delete them afterwords
 * @param toUser - the user that the messages are intended to
 * @returns Promise that gets the messages from the db
 */
function getWaitingMessages(toUser){
    let query = (db) => {
        let getMessages = `SELECT "from",message FROM Messages WHERE "to"='${toUser}'`;
        let deleteMessages = `DELETE FROM Messages WHERE "to"='${toUser}'`;

        return new Promise((resolve,reject) => {
            db.all(getMessages, function(err, rows){ // get all the messages with the username in the "to" column
                if (err) {
                    closeDb(db);
                    reject(err);
                }
                else{
                    let messages = [];
                    Object.keys(rows).forEach(key => { // convert the lines of the db to messages array
                        messages.push({from: rows[key].from, message: rows[key].message});
                    });

                    db.all(deleteMessages, function(err, rows) {    // delete all that messages from the db
                        closeDb(db);
                        if (err)
                            reject(err);
                        else
                            resolve(messages);
                    });
                }
            });
        });
    };

    return executeQuery(query);
}

/**
 * Get specific user certificates from the server
 * @param username - the wanted user
 * @returns Promise that gets the cert from the db
 */
function getUserCert(username){
    let query = (db) => {
        let getCert = `SELECT cert FROM Clients WHERE username='${username}'`;

        return new Promise((resolve,reject) => {
            db.all(getCert, function(err, rows){
                closeDb(db);
                if (err)
                    reject(err);
                else{
                    let certs = [];
                    Object.keys(rows).forEach(key => { // convert the lines of the db to messages array
                        certs.push(rows[key].cert);
                    });
                    resolve(certs[0]);  // There is just one with that username
                }
            });
        });
    };

    return executeQuery(query);
}

/**
 * Close connection to db
 * @param db - the connection
 */
function closeDb(db) {
    db.close(function (err) {
        if (err) {
            console.log(err.message);
        }
    });
}

/**
 * Gets query, creates a db instance and invoke the query with the db instance as a param
 * @param func - the query to invoke
 * @returns the result of the query activation
 */
function executeQuery(func){
    let db = new sqlite3.Database('./db/server.db', sqlite3.OPEN_READWRITE, function (err) {
        if (err) {
            console.log(err.message);
        }
    });

    return func(db);
}