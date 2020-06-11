var express = require('express'),
  fs = require('fs'),
  path = require('path');
  var passport = require('passport');
  var ejs = require('ejs');
  var cookieParser = require('cookie-parser')
  var session = require('express-session');
  var localStrategy = require('passport-local').Strategy;
  // var cokkieParser = require()


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
    if(username === 'test' && password === 'test'){
      return done(null,username);
    }else{
      console.log('Login Error');
      return done(null,false,{message:'パスワードが正しくありません'});
    }
  })
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
    // var filePath = path.join(__dirname, 'static/screen.ejs');
    // var stat = fs.statSync(filePath);
  
    // response.writeHead(200, {
    //   'Content-Type': 'text/html',
    //   'Content-Length': stat.size
    // });
    // var readStream = fs.createReadStream(filePath);
    // readStream.pipe(response);

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
    console.log(socket.request.session.passport.user);
    
    socket.room = req.room;
    socket.join(req.room);
    io.to(socket.id).emit("joined", { id: socket.id });
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
  })
});

