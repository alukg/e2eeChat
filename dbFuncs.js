/**
 * Created by guy on 22/03/18.
 */

const sqlite3 = require('sqlite3').verbose();

module.exports = {createUser,checkIfUserAndPassOk};
function createUser(username,pass) {
    var query = (db) => {
        var getUserRow = `SELECT * FROM Clients WHERE username='${username}'`;
        var insertUser = `INSERT INTO Clients (username,pass,salt) VALUES ('${username}','${pass}','1111')`;

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                if (err)
                    reject(err);
                else if (result.length > 0)
                    reject("Username exists");
                else{
                    db.all(insertUser, function(err, result){
                        if (err)
                            reject(err);
                        resolve();
                    });
                }
            });
        });
    };

    return executeQuery(query);
}

function checkIfUserAndPassOk(username,pass) {
    var query = (db) => {
        var getUserRow = "SELECT * FROM Clients WHERE username='" + username + "'";

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                if (err)
                    reject(err);
                else if (result.length === 0)
                    reject("User doesn't exists");
                else if (pass === result[0]['pass'])
                    resolve();
                else
                    reject("Password incorrect");
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
        console.log('Close the database connection.');
    });
}

function executeQuery(func){
    let db = new sqlite3.Database('./db/server.db', sqlite3.OPEN_READWRITE, function (err) {
        if (err) {
            console.log(err.message);
        }
        console.log('Connected to the database.');
    });

    return func(db);
}