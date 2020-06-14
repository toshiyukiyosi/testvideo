var express = require('express'),
  fs = require('fs'),
  path = require('path');
  var passport = require('passport');
  var ejs = require('ejs');
  var cookieParser = require('cookie-parser')
  var session = require('express-session');
  var localStrategy = require('passport-local').Strategy;
  // var {check,validationResult} = require('express-validator/check');
var mysql = require('mysql');
var knex = require('knex')({
  client:'mysql',
  connection:{
    host:'localhost',
    user:'root',
    password:'',
    database:'hidden_db',
    charset:'utf8',
  }
});
var Bookshelf = require('bookshelf')(knex);
var User = Bookshelf.Model.extend({
  tableName:'users'
});

var app = express();
var port = process.env.PORT || 3000;
var options = {
  key: fs.readFileSync(process.env.KEY || './cert/private.pem'),
  cert: fs.readFileSync(process.env.CERT || './cert/cert.pem')
};
var server;
if ("true" == process.env.HTTP) {
  console.log("mode http")
  server = require('http').createServer(app);
} else {
  console.log("mode https")
  server = require('https').createServer(options, app);
};
var sessionMiddlewere = session({
  resave:false,
  saveUninitialized:false,
  secret:'passport test',
  cookie:{
    httpOnly:false,
    secure:false,
  }
});
app.session = sessionMiddlewere;
app.use(sessionMiddlewere);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('static'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.engine('ejs',ejs.renderFile);





passport.use(new localStrategy({
  usernameField:'username',
  passwordField:'password',
  passReqToCallback: true,
  session:false,
},function(req,username,password,done){
  process.nextTick(function(){
    var reqName = req.body.username;
    var reqPass = req.body.password;
    
    User.query({where: {username:reqName}, andWhere:{password:reqPass}})
    .fetch().then((model) => {
      // console.log(model);
      
      if(model){
        return done(null,username);
      }else{
        console.log('Login Error');
        return done(null,false,{message:'パスワードが正しくありません'});
      }
    })
    // if(username === 'test' && password === 'test'){
    // }else{
    // }
  });
}));

passport.serializeUser(function(user,done){
  done(null,user);
});

passport.deserializeUser(function(user,done){
  done(null,user);
});
var io = require('socket.io').listen(server);
io.use(function(socket,next){
  sessionMiddlewere(socket.request,socket.request.res,next);
});


app.get('/',sessionCheck);

function sessionCheck(req,res){
  if(req.user){
    res.render('index.ejs', { 
      title: 'Express',
      user: req.user 
    });
  }else{
    res.redirect('/login');
  }
}

app.get('/login',(req,res) => {
  res.render('login.ejs',{
    title:'Login Page',
    user: req.user
  });
});

app.post('/login',passport.authenticate('local',{
  successRedirect:'/',
  failureRedirect:'/login',
  session:true,
}));

app.get('/logout',(req,res) => {
  req.logOut();
  res.redirect('/');
});



app.get("/:channel",(req,res) =>  {
  if(req.user){
    res.render('screen.ejs', { 
      title: 'Express',
      user: req.user 
    });

  }else{
    res.redirect('/login');
  }
});
server.listen(port, function (error) {
  console.log('listening on *:' + port);
});
var store = {};
var ifLastDislock = function (room) {
  io.to(room).clients(function (e, clients) {
    if (0 == clients.length) {
      delete lockedRooms[room];
    }
  });
}
var lockedRooms = [];
var chat = io.sockets.on('connection', function (socket) {
  socket.on('join', function (req) {
    if (lockedRooms[req.room]) {
      io.to(socket.id).emit("lockouted", { id: socket.id, room: req.room });
      return;
    }
    // console.log(socket.request.session.passport.user);
    socket.room = req.room;
    socket.join(req.room);
    io.to(socket.id).emit("joined", { id: socket.id,name:socket.request.session.passport.user });
    socket.broadcast.to(socket.room).json.emit("otherJoined", { id: socket.id,name: socket.request.session.passport.user  });
  });
  socket.on('offer', function (offer) {
    socket.to(offer.targetId).emit('message', offer);
  });
  socket.on('message', function (message) {
    socket.broadcast.to(socket.room).emit('message', message);
  });
  socket.on('candidate', function (message) {
    socket.to(message.targetId).emit('message', message);
  });
  socket.on('stop', function () {
    socket.leave(socket.room);
    ifLastDislock(socket.room);
    socket.broadcast.to(socket.room).emit('otherStoped', { id: socket.id });
  });
  socket.on('disconnect', function () {
    ifLastDislock(socket.room);
    socket.broadcast.to(socket.room).emit('otherDisconnected', { id: socket.id });
  });
  socket.on('lock', function () {
    lockedRooms[socket.room] = true;
    socket.broadcast.to(socket.room).emit('locked');
  });
  socket.on('handup',function(id){
    socket.broadcast.to(socket.room).emit('otherHandUp',{id});
  });
  socket.on('mynamesend',function(id,name){
    socket.broadcast.to(socket.room).emit('othernamesend',{id,name});
  });
});

