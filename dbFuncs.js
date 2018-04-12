/**
 * Created by guy on 22/03/18.
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs')

module.exports = {createUser,checkIfUserAndPassOk,getUsersList};

function createUser(username,pass) {
    var query = (db) => {
        let pki = forge.pki;

        // set keys and certificate
        let keys = pki.rsa.generateKeyPair(2048);
        let userCert = pki.createCertificate();
        userCert.publicKey = keys.publicKey;
        userCert.serialNumber = '01';
        userCert.validity.notBefore = new Date();
        userCert.validity.notAfter = new Date();
        userCert.validity.notAfter.setFullYear(userCert.validity.notBefore.getFullYear() + 1);

        let attrs = [{
            name: 'commonName',
            value: username
        }, {
            name: 'countryName',
            value: ''
        }, {
            shortName: 'ST',
            value: ''
        }, {
            name: 'localityName',
            value: ''
        }, {
            name: 'organizationName',
            value: ''
        }, {
            shortName: 'OU',
            value: ''
        }];

        userCert.setSubject(attrs);

        // sign the cert by the CA
        let pemCAPrivateKey = fs.readFileSync(__dirname + "/CA/server_key.pem", 'utf8');
        let CAprivateKey = pki.privateKeyFromPem(pemCAPrivateKey);
        userCert.sign(CAprivateKey);
        let userPem = pki.certificateToPem(userCert);

        // create salt and hash password
        let salt =  Math.random().toString(36).substr(2);
        const hmac = crypto.createHmac('sha256', salt);

        hmac.update(pass);
        let hashedPass = hmac.digest('hex');

        let getUserRow = `SELECT * FROM Clients WHERE username='${username}'`;
        let insertUser = `INSERT INTO Clients (username,pass,salt,certPem) VALUES ('${username}','${hashedPass}','${salt}','${userPem}')`;

        return new Promise((resolve,reject) => {
            db.all(getUserRow, function(err, result){
                if (err) {
                    closeDb(db);
                    reject(err);
                }
                else if (result.length > 0) {
                    closeDb(db);
                    reject("Username exists");
                }
                else{
                    db.all(insertUser, function(err, result){
                        closeDb(db);
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
                closeDb(db);

                if (err)
                    reject(err);
                else if (result.length === 0)
                    reject("User doesn't exists");

                let salt =  result[0]['salt'];
                const hmac = crypto.createHmac('sha256', salt);

                hmac.update(pass);
                let hashedPass = hmac.digest('hex');

                if (hashedPass === result[0]['pass'])
                    resolve();
                else
                    reject("Password incorrect");
            });
        });
    };

    return executeQuery(query);
}

function getUsersList(){
    var query = (db) => {
        var getUsers = "SELECT username FROM Clients";

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