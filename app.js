const express = require('express');
const sqlite3 = require('sqlite3');
const session = require('express-session');
const bodyParser = require('body-parser');
const format = require('string-format');
const jsonParser = bodyParser.json();
const sha256 = require('sha-256-js');
const app = express();
const router = express.Router();
const port = 9000;

var path = require('path');
let ejs = require('ejs');


app.use(bodyParser.urlencoded({extended : true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'src')));

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

const db = new sqlite3.Database( __dirname + '/users.db',
  function(err){
    if(!err){
      console.log('opened db');
      initDB();
    }
    else{
      console.log('cannot open db');
    }
  });

function initDB(){
  db.serialize(function(){
    db.run(`
      CREATE TABLE IF NOT EXISTS userstable (
      id INTEGER AUTO_INCREMENT PRIMARY KEY,
      username TEXT NOT NULL,
      sha256_pw text NOT NULL,
      top_score INTEGER,
      usertype BOOLEAN NOT NULL
    )`);

  });
}


// Takes request from login page and checks it against database entries
app.post('/auth', function(request, response){
  var email = request.body.email;
  var password = request.body.password;
  console.log("u: "+ email+ " p: "+password);
  if (email && password){
    db.get(`SELECT * FROM userstable WHERE username = ?`,
      [email],
      function(err, row){
        if (!err){
          if (sha256(password) == row.sha256_pw){
            request.session.loggedin = true;
            request.session.email = email;
            response.redirect('/play');
          }else{
            response.send('Incorrect Email address or Password!');
          }
        }
        response.end();
    });
  }else{
    response.send('Please register to login!');
  }
});

app.post('/register', function(req, res){
  let newAccount = req.body;
  console.log("---------");
  console.log(req.body.email);
  console.log(req.body.password);
  // Check if email is taken
  db.get(`SELECT * FROM userstable WHERE username = ?`,
    [req.body.email],
  function(err, row){
    if (!err){
      if(row){
        // email is already registered
        console.log("User name is already taken");
      }else{
        // email is not registered yet
        let newPass = sha256(req.body.password);
        let newRow = [req.body.email, sha256(req.body.password), 0, false];
        console.log(newRow);
        // Add new account into database
        db.run(`INSERT INTO userstable(username, sha256_pw, top_score, usertype) VALUES(?,?,?,?)`, newRow, (err) =>{
          if(err){
            console.log(err);
          }else{
            console.log("Added to database");
            res.redirect('/login');
          }
        });

      }
    }else{
      console.log(err);
    }

  });
});

app.post('/play', function(req, res){
  
  var score = req.body;
  console.log('Recorded score: ' + score.score);

  console.log('user logged in = '+ req.session.email);


  let data = [score.score, req.session.email];
  let sql = `UPDATE userstable
              SET top_score = ?
              WHERE username = ?`;

  db.run(sql, data, function(err) {
    if (err) {
      return console.error(err.message);
    }
    console.log(`Row(s) updated: ${this.changes}`);

  });

});




app.post('/deleteuser', function(req,res){
  var user = req.body;
  console.log("User deleted:" + user.email);
  let sql = `DELETE FROM userstable WHERE username = ?`;

  db.run(sql, user.email, function(err){
    if(err){
      return console.log(err.message);
    }
    console.log('Removed user from userstable.');
  });
});

app.get('/play',function(req,res){
  res.sendFile(path.join(__dirname+'/proj/src/play.html'));
});

app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname+'/proj/src/login.html'));
});

app.get('/register', function (req, res) {
  res.sendFile(path.join(__dirname+'/proj/src/register.html'));
});


app.get('/admin', function(req, res){


  var users = [];
  var un, ts, adm;
  let sql = `SELECT username, top_score, usertype FROM userstable`;

  db.all(sql, [], function(err, rows) {
    if (err) {
      return console.error(err.message);
    }
    rows.forEach((row) => {
   
      un = row.username;
      adm = row.usertype;

      users.push({
        username: un,
        admin: adm
      });
    });
  });

  setTimeout(function(){
    res.render(path.join(__dirname+'/proj/src/admin.ejs'),{
      adminUserList: users
    });
  },100)
});


app.get('/allSheets', function(req, res){


  var users = [];
  var un, ts, adm;
  let sql = `SELECT username, top_score, usertype FROM userstable`;

  db.all(sql, [], function(err, rows) {
    if (err) {
      return console.error(err.message);
    }
    rows.forEach((row) => {
   
      un = row.username;
      adm = row.usertype;

      users.push({
        username: un,
        admin: adm
      });
    });
  });

  setTimeout(function(){
    res.render(path.join(__dirname+'/proj/src/allSheets.ejs'),{
      adminUserList: users
    });
  },100)
});



app.get('/profile', function (req, res) {

`SELECT username, top_score FROM userstable`

  var un, ts;
  un = req.session.email;

  let sql = `SELECT username, top_score FROM userstable WHERE username = ?`;

  console.log("Searching database ...");

  db.all(sql, [un], function(err, rows) {
    if (err) {
      return console.error(err.message);
    }
    rows.forEach((row) => {

      ts = row.top_score;

      console.log("ts = "+ts);

    });
  });

  setTimeout(function(){
    console.log("un = " + un + ", ts = " + ts);
    res.render(path.join(__dirname+'/proj/src/profile.ejs'), {
      user: un,
      score: ts
    });
  },100)
});

app.post('/profile', function(req,res ){

  console.log('Updating in database ...');
  var newPass = req.body;
  console.log('New pass = ' + newPass.password);
  console.log('user logged in = '+ req.session.email);

  let hash = sha256(req.body.password);

  let data = [hash, req.session.email];

  let sql = `UPDATE userstable
              SET sha256_pw = ?
              WHERE username = ?`;

  db.run(sql, data, function(err) {
    if (err) {
      return console.error(err.message);
    }
    console.log(`Row(s) updated: ${this.changes}`);

  });

});

app.use(express.static('proj/src/', {index: 'login.html'})) 

app.listen(port, () => {
  console.log('App listening on port ', port);
});