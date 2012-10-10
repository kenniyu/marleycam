(function() {

  console.log(config);

  console.log(config.address);
  console.log(config.port);
//  var socket = new io.Socket(config.address, {port: config.port, rememberTransport: false});
  var currentUrl = document.URL;
  var socket = io.connect(currentUrl);

  socket.on('connect', function() {
    var name      = prompt('who are you?'),
        password  = '';

    if (name === 'marley') {
      password = prompt('pass?');
    }

    socket.emit('set-user-privilege', { name: name, password: password });
    socket.emit('message', { event: 'initial' });
  });

  socket.on('message', function (message) {
    var sessionId;
    var token;
    var publisherData;

    switch(message.event) {
      case 'initial':
        sessionId = message.data.sessionId;
        token = message.data.token;
        publisherData = message.data;

        MarleyCam.init(sessionId, token, publisherData);
      break;

      case 'subscribe':
        sessionId = message.data.sessionId;
        token = message.data.token;

        MarleyCam.subscribe(sessionId, token);
      break;

      case 'wait':
        MarleyCam.wait();
      break;
    }
  });

//  socket.connect();

  var SocketProxy = function() {

    var findPartner = function(mySessionId) {
      socket.send({
        event: 'next',
        data: {
          sessionId: mySessionId
        }
      });
    };

    return {
      findPartner: findPartner
    };
  }();

  var MarleyCam = function() {
    var apiKey = 20744941;

    var mySession;
    var partnerSession;

    var partnerConnection;

    // Get view elements
    var ele = {};

    TB.setLogLevel(TB.DEBUG);

    var init = function(sessionId, token, publisherData) {
      console.log('my session id = '+sessionId);
      ele.publisherContainer = document.getElementById('publisherContainer');
      ele.subscriberContainer = document.getElementById('subscriberContainer');
      ele.notificationContainer = document.getElementById('notificationContainer');

      ele.notificationContainer.innerHTML = "Connecting...";

      console.log('initing with sessionId = '+sessionId);

      mySession = TB.initSession(sessionId);
      mySession.addEventListener( 'sessionConnected', sessionConnectedHandler);
      mySession.addEventListener( 'connectionCreated', connectionCreatedHandler);
      mySession.addEventListener( 'connectionDestroyed', connectionDestroyedHandler);

      mySession.connect(apiKey, token);

      function sessionConnectedHandler(event) {
        ele.notificationContainer.innerHTML = "Connected, press allow.";

        var div = document.createElement('div');
        div.setAttribute('id', 'publisher');
        ele.publisherContainer.appendChild(div);

        var publisherProps = { 'width': 640, 'height': 480 };

        var publisher = mySession.publish(div.id, publisherProps);
        publisher.addEventListener( 'accessAllowed', accessAllowedHandler);

      };

      function accessAllowedHandler(event) {
        // whoever just enabled their webcam...
        SocketProxy.findPartner( mySession.sessionId);
        ele.notificationContainer.innerHTML = "You're live!";
        // tell server to alert all subscribers to subscribe
        console.log(publisherData);
        socket.emit('set-publisher', publisherData);

      };

      function connectionCreatedHandler(event) {
        partnerConnection = event.connections[0];
      };

      function connectionDestroyedHandler(event) {
        console.log('connection destroyed');
        partnerConnection = null;
      }
    };

    var subscribe = function(sessionId, token) {
      ele.publisherContainer = document.getElementById('publisherContainer');
      ele.subscriberContainer = document.getElementById('subscriberContainer');
      ele.notificationContainer = document.getElementById('notificationContainer');

      ele.notificationContainer.innerHTML = 'Enjoy!';

      partnerSession = TB.initSession(sessionId);

      partnerSession.addEventListener( 'sessionConnected', sessionConnectedHandler);
      partnerSession.addEventListener( 'sessionDisconnected', sessionDisconnectedHandler);
      partnerSession.addEventListener( 'streamDestroyed', streamDestroyedHandler);
      partnerSession.addEventListener( 'streamCreated', streamCreatedHandler);

      partnerSession.connect(apiKey, token);

      function sessionConnectedHandler(event) {
        var div = document.createElement('div'),
            subscriberProps = { 'width': 640, 'height': 480 };
        div.setAttribute('id', 'subscriber');
        ele.subscriberContainer.appendChild( div);
        partnerSession.subscribe( event.streams[0], div.id, subscriberProps);
      }

      function sessionDisconnectedHandler(event) {
        partnerSession.removeEventListener( 'sessionConnected', sessionConnectedHandler);
        partnerSession.removeEventListener( 'sessionDisconnected', sessionDisconnectedHandler);
        partnerSession.removeEventListener( 'streamDestroyed', streamDestroyedHandler);

        SocketProxy.findPartner( mySession.sessionId);
        partnerSession = null;
      }

      function streamDestroyedHandler(event) {
        partnerSession.disconnect();
      }

      function streamCreatedHandler(event) {
      }
    };

    var wait = function() {
      ele.publisherContainer = document.getElementById('publisherContainer');
      ele.subscriberContainer = document.getElementById('subscriberContainer');
      ele.notificationContainer = document.getElementById('notificationContainer');
      ele.notificationContainer.innerHTML = 'Marley\'s not here yet, but she\'ll be on in a bit!';
    };

    return {
      init: init,
      subscribe: subscribe,
      wait: wait
    };

  }();

})();
