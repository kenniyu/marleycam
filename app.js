var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , path = require('path');

var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
  app.set('address', 'localhost');
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure('production', function() {
  app.set('address', 'fierce-sword-182.herokuapp.com');
  app.use(express.errorHandler());
});

// Routes
app.get('/', function(req, res) {
  res.render('index', {
    title: 'MarleyCam',
    address: app.settings.address,
    port: app.settings.port
  });
});

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var opentok = require('opentok');
var ot = new opentok.OpenTokSDK('20744941', '457c21485a1c63874f84b8a74696b425811ec65c');
var soloUsers = [];
var viewers = [];
var publisher;
var subscribers = [];
var usersHash = {};
var anonCounter = 1;

io.sockets.on('connection', function(client) {

  client.on('disconnect', function () {
    var clientId = client['id'];
    delete usersHash[clientId];
    if (client['store']['data']['clientType'] === 'publisher') {
      publisher = undefined;
    }
    io.sockets.emit('update-users-list', usersHash);
  });

  client.on('set-user-info', function(authdata) {
    var username      = encodeHTML(authdata['username']),
        password      = authdata['password'],
        tempUserData  = {};

    if (username === 'marley' && password === '0417') {
      // we are marley, set clientType to publisher
      client.set('clientType', 'publisher');
    } else {
      if (username.trim() === '') {
        username = 'anon'+anonCounter;
        anonCounter += 1;
      }
      // set auth to subscriber
      client.set('clientType', 'subscriber');
    }
    client.set('username', username);

    tempUserData = {
      id: client['id'],
      username: client['store']['data']['username'],
      clientType: client['store']['data']['clientType']
    };
    usersHash[client['id']] = tempUserData;
    io.sockets.emit('update-users-list', usersHash);
  });

  client.on('set-publisher', function(publisherData) {
    var tempClient;

    publisher = publisherData;

    // if there were any subscribers, subscribe now
    for (var clientId in usersHash) {
      tempClient = usersHash[clientId];
      if (tempClient['clientType'] === 'subscriber') {
        io.sockets.socket(clientId).emit('subscribe', publisherData);
      }
    }

  });

  client.on('submit-chat', function(message) {
    var chatType,
        chatText,
        username = client['store']['data']['username'],
        clientType = client['store']['data']['clientType'],
        messageHash,
        emotedText;

    if (message.indexOf('/me ') === 0) {
      emotedText = message.substring(3);
      chatType = 'passive';
      chatText = username + encodeHTML(emotedText);
    } else {
      chatType = 'active';
      chatText = encodeHTML(message);
    }

    messageHash = {
      chatType: chatType,
      chatText: chatText,
      username: username,
      clientType: clientType
    }

    io.sockets.emit('receive-chat', messageHash);
  });

  client.on('initial', function() {
    // Create an OpenTok session for each user
    var data,
        clientType = client['store']['data']['clientType'];

    ot.createSession('localhost', {}, function(session) {
      if (clientType === 'publisher') {
        // i'm marley, let me publish!
        data = {
          sessionId: session,
          token: ot.generateToken({
            sessionId: session,
            role: opentok.RoleConstants.MODERATOR
          })
        };

        client.emit('initial', data);
      } else {
        // this guy is not marley, sub to marley
        subscribers.push(client);
        if (publisher === undefined) {
          client.emit('wait');
        } else {
          data = {
            sessionId: publisher['sessionId'],
            token: ot.generateToken({
              sessionId: publisher['sessionId'],
              role: opentok.RoleConstants.SUBSCRIBER
            })
          };
          client.emit('subscribe', data);
        }
      }
    });
  });

});


// helper functions
function encodeHTML(s) {
  if (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  } else {
    return '';
  }
}
