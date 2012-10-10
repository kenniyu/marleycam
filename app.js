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

io.sockets.on('connection', function(client) {
  client.on('set-user-privilege', function(authdata) {
    var name = authdata['name'],
        password = authdata['password'];

    if (name === 'marley' && password === '0417') {
      // we are marley, set clientType to publisher
      client.set('clientType', 'publisher');
    } else {
      // set auth to subscriber
      client.set('clientType', 'subscriber');
    }
  });

  client.on('set-publisher', function(publisherData) {
    var tempSubscriber,
        numSubscribers = subscribers.length;

    publisher = publisherData;

    // if there were any subscribers, subscribe now
    console.log('making all subscribers subscribe');
    console.log(subscribers);
    for (var i = 0; i < numSubscribers; i++) {
      tempSubscriber = subscribers[i];
      tempSubscriber.emit('message', {
        event: 'subscribe',
        data: publisherData
      });
    }
  });

  client.on('message', function(message) {
    // Parse the incoming event
    switch (message.event) {
      // User requested initialization data
      case 'initial':
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

            client.emit('message', {
              event: 'initial',
              data: data
            });

          } else {
            // this guy is not marley, sub to marley
            subscribers.push(client);
            if (publisher === undefined) {
              client.emit('message', {
                event: 'wait'
              });
            } else {
              data = {
                sessionId: publisher['sessionId'],
                token: ot.generateToken({
                  sessionId: publisher['sessionId'],
                  role: opentok.RoleConstants.SUBSCRIBER
                })
              };
              client.emit('message', {
                event: 'subscribe',
                data: data
              });
            }
          }

        });
        break;

      // User requested next partner
      case 'next':
        // Create a "user" data object for me
        var me = {
          sessionId: message.data.sessionId,
          clientId: client.sessionId
        };

        var partner;
        var partnerClient;
        // Look for a user to partner with in the list of solo users
        for (var i = 0; i < soloUsers.length; i++) {
          var tmpUser = soloUsers[i];

          // Make sure our last partner is not our new partner
          if (client.partner != tmpUser) {
          // Get the socket client for this user
            partnerClient = socket.clientsIndex[tmpUser.clientId];

            // Remove the partner we found from the list of solo users
            soloUsers.splice(i, 1);

            // If the user we found exists...
            if (partnerClient) {
              // Set as our partner and quit the loop today
              partner = tmpUser;
              break;
            }
          }
        }

        // If we found a partner...
        if (partner) {

          // Tell myself to subscribe to my partner
          client.send({
            event: 'subscribe',
            data: {
              sessionId: partner.sessionId,
              token: ot.generateToken({
                sessionId: partner.sessionId,
                role: opentok.Roles.SUBSCRIBER
              })
            }
          });

          // Tell my partner to subscribe to me
          partnerClient.send({
            event: 'subscribe',
            data: {
              sessionId: me.sessionId,
              token: ot.generateToken({
                sessionId: me.sessionId,
                role: opentok.Roles.SUBSCRIBER
              })
            }
          });

          // Mark that my new partner and me are partners
          client.partner = partner;
          partnerClient.partner = me;

          // Mark that we are not in the list of solo users anymore
          client.inList = false;
          partnerClient.inList = false;

        } else {

          // Delete that I had a partner if I had one
          if (client.partner) {
            delete client.partner;
          }

          // Add myself to list of solo users if I'm not in the list
          if (!client.inList) {
            client.inList = true;
            soloUsers.push(me);
          }

          // Tell myself that there is nobody to chat with right now
          client.send({
            event: 'empty'
          });
        }

        break;
      }
  });
});
