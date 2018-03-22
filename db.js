/**
 * Created by guy on 22/03/18.
 */

const sqlite3 = require('sqlite3').verbose();

function createUser(username,pass) {
    var query = function(db){

    }

    return executeQuery(query);
}

function checkIfUserAndPassOk(username,pass) {
    var query = function(db){
        var sql = 'SELECT DISTINCT Name name FROM playlists ORDER BY name';

        db.all(sql, [], (err, rows) => {
            if (err) {
                throw err;
            }
            rows.forEach((row) => {
            console.log(row.name);
            });
        });
    }

    var ret = executeQuery(query);
}

function closeDb(db) {
    db.close(function (err) {
        if (err) {
            return console.error(err.message);
        }
        console.log('Close the database connection.');
    });
}

function executeQuery(func){
    var db = new sqlite3.Database('./db/server.db', sqlite3.OPEN_READWRITE, function (err) {
        if (err) {
            closeDb(db);
            return console.error(err.message);
        }
        console.log('Connected to the database.');
        func(db);
        closeDb(db);
    });
}