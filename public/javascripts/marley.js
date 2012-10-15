(function() {

  var currentUrl    = document.URL,
      socket        = io.connect(currentUrl),
      VIDEO_WIDTH   = 800,
      VIDEO_HEIGHT  = 600;

  socket.on('connect', function() {
    var username  = '';
        password  = '';

    username = prompt('your name? (leave blank if you want..)');

    if (username === 'marley') {
      password = prompt('pass?');
    }

    socket.emit('set-user-info', { username: username, password: password });
    socket.emit('initial');
  });

  socket.on('receive-chat', function(chatHash) {
    var chatType = chatHash['chatType'],
        chatText = chatHash['chatText'],
        username = chatHash['username'],
        clientType = chatHash['clientType'];

    if (chatType === 'active') {
      $('.messages-list').append('<li class="message '+chatType+'"><span class="username '+clientType+'">'+username+'</span>: <span class="chat-text">'+chatText+'</span></li>');
    } else {
      $('.messages-list').append('<li class="message '+chatType+'"><span class="chat-text">'+chatText+'</span></li>');
    }
    $('.chat-messages').animate({ scrollTop: $('.messages-list').prop('scrollHeight') }, 1);
  });

  socket.on('update-users-list', function(usersHash) {
    var userData,
        clientId,
        username,
        clientType;

    $('.users-list').empty();
    for (clientId in usersHash) {
      userData    = usersHash[clientId];
      username    = userData['username'];
      clientType  = userData['clientType'];
      $('.users-list').append('<li class="username '+clientType+'" data-client-id="'+clientId+'">'+username+'</li>');
    }
  });

  socket.on('initial', function(data) {
    var sessionId       = data.sessionId,
        token           = data.token,
        publisherData   = data;

    MarleyCam.init(sessionId, token, publisherData);
  });

  socket.on('subscribe', function(data) {
    var sessionId       = data.sessionId,
        token           = data.token;

    MarleyCam.subscribe(sessionId, token);
  });

  socket.on('wait', function() {
    MarleyCam.wait();
  });

//  socket.connect();

  var MarleyCam = function() {
    var apiKey = 20744941;

    var mySession;
    var partnerSession;

    var partnerConnection;

    // Get view elements
    var ele = {};

    TB.setLogLevel(TB.DEBUG);

    var init = function(sessionId, token, publisherData) {
      ele.publisherContainer = document.getElementById('publisherContainer');
      ele.subscriberContainer = document.getElementById('subscriberContainer');
      ele.notificationContainer = document.getElementById('notificationContainer');

      ele.notificationContainer.innerHTML = "Connecting...";


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

        var publisherProps = { 'width': VIDEO_WIDTH, 'height': VIDEO_HEIGHT };

        var publisher = mySession.publish(div.id, publisherProps);
        publisher.addEventListener( 'accessAllowed', accessAllowedHandler);

      };

      function accessAllowedHandler(event) {
        // whoever just enabled their webcam...
        ele.notificationContainer.innerHTML = "You're live!";
        // tell server to alert all subscribers to subscribe
        socket.emit('set-publisher', publisherData);
      };

      function connectionCreatedHandler(event) {
        partnerConnection = event.connections[0];
      };

      function connectionDestroyedHandler(event) {
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
            subscriberProps = { 'width': VIDEO_WIDTH, 'height': VIDEO_HEIGHT };
        div.setAttribute('id', 'subscriber');
        ele.subscriberContainer.appendChild( div);
        partnerSession.subscribe( event.streams[0], div.id, subscriberProps);
      }

      function sessionDisconnectedHandler(event) {
        partnerSession.removeEventListener( 'sessionConnected', sessionConnectedHandler);
        partnerSession.removeEventListener( 'sessionDisconnected', sessionDisconnectedHandler);
        partnerSession.removeEventListener( 'streamDestroyed', streamDestroyedHandler);

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

  $().ready(function() {
    $('.chat-bar input').live('keypress', function(e) {
      var keyCode = e.keyCode,
          message = $(this).val();

      if (keyCode === 13 && message != '') {
        socket.emit('submit-chat', message);
        $(this).val('');
      }
    });
  });

})();
