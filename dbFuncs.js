/**
 * Created by guy on 22/03/18.
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs')

module.exports = {createUser,checkIfUserAndPassOk,getUsersList,checkIfUserExists,pushMessageToServer,getWaitingMessages};

function createUser(username,pass,certPem) {
    let query = (db) => {
        // create salt and hash password
        let salt =  Math.random().toString(36).substr(2);
        const hmac = crypto.createHmac('sha256', salt);

        hmac.update(pass);
        let hashedPass = hmac.digest('hex');

        let getUserRow = `SELECT * FROM Clients WHERE username='${username}'`;
        let insertUser = `INSERT INTO Clients (username,pass,salt,certPem) VALUES ('${username}','${hashedPass}','${salt}','${certPem}')`;

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                if (err) {
                    closeDb(db);
                    return reject(err);
                }
                else if (result.length > 0) {
                    closeDb(db);
                    return reject("Username exists");
                }
                else{
                    db.all(insertUser, function(err, result){
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

function checkIfUserAndPassOk(username,pass) {
    let query = (db) => {
        let getUserRow = "SELECT * FROM Clients WHERE username='" + username + "'";

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                closeDb(db);

                if (err)
                    return reject(err);
                else if (result.length === 0)
                    return reject("User doesn't exists");

                let salt =  result[0]['salt'];
                const hmac = crypto.createHmac('sha256', salt);

                hmac.update(pass);
                let hashedPass = hmac.digest('hex');

                if (hashedPass === result[0]['pass'])
                    return resolve();
                else
                    return reject("Password incorrect");
            });
        });
    };

    return executeQuery(query);
}

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

function getUsersList(){
    let query = (db) => {
        let getUsers = "SELECT username FROM Clients";

        return new Promise((resolve,reject) => {
            db.all(getUsers, function(err, rows){
                closeDb(db);

                if (err)
                    reject(err);
                else{
                    let namesArray = [];
                    Object.keys(rows).forEach(key => {
                        namesArray.push(rows[key].username);
                    });
                    resolve(namesArray);
                }
            });
        });
    };

    return executeQuery(query);
}

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

function getWaitingMessages(toUser){
    let query = (db) => {
        let getMessages = `SELECT "from",message FROM Messages WHERE "to"='${toUser}'`;
        let deleteMessages = `DELETE FROM Messages WHERE "to"='${toUser}'`;

        return new Promise((resolve,reject) => {
            db.all(getMessages, function(err, rows){
                if (err) {
                    closeDb(db);
                    reject(err);
                }
                else{
                    let messages = [];
                    Object.keys(rows).forEach(key => {
                        messages.push({from: rows[key].from, message: rows[key].message});
                    });

                    db.all(deleteMessages, function(err, rows) {
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

function closeDb(db) {
    db.close(function (err) {
        if (err) {
            console.log(err.message);
        }
        //console.log('Close the database connection.');
    });
}

function executeQuery(func){
    let db = new sqlite3.Database('./db/server.db', sqlite3.OPEN_READWRITE, function (err) {
        if (err) {
            console.log(err.message);
        }
        //console.log('Connected to the database.');
    });

    return func(db);
}