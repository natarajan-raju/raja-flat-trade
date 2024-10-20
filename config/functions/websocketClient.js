const WebSocket = require('ws');

const flattradeWsUrl = 'wss://piconnect.flattrade.in/PiConnectWSTp/';
let flattradeWs;
let frontendClients = [];

// Create WebSocket server for frontend clients
const wsServer = new WebSocket.Server({ port: 8080 }); // Or your preferred port

wsServer.on('connection', (ws) => {
  console.log('Frontend client connected');
  frontendClients.push(ws);

  ws.on('close', () => {
    console.log('Frontend client disconnected');
    frontendClients = frontendClients.filter(client => client !== ws);
  });
});

//Connect to Websocket & subscribe
const connectFlattradeWebSocket = (userId, sessionToken, accountId, scripList) => {
  return new Promise((resolve, reject) => {
    flattradeWs = new WebSocket(flattradeWsUrl);

    flattradeWs.on('open', () => {
      console.log('Flattrade WebSocket connection established.');
      sendConnectionRequest(userId, sessionToken, accountId);
    });

    flattradeWs.on('message', (data) => {
      const messageString = Buffer.isBuffer(data) ? data.toString() : data;
      // @ts-ignore
      const message = JSON.parse(messageString);
      handleIncomingMessage(message, resolve, reject, scripList);
    });

    flattradeWs.on('close', () => {
      console.log('Flattrade WebSocket connection closed. Attempting reconnect...');
      setTimeout(() => connectFlattradeWebSocket(userId, sessionToken, accountId), 5000);
    });

    flattradeWs.on('error', (error) => {
      console.error('Flattrade WebSocket error:', error);
      reject(error); // Reject the promise on error
    });
  });
};

const sendConnectionRequest = (userId, sessionToken, accountId) => {
  const connectPayload = {
    t: 'c',           // 'c' represents connect task
    uid: userId,      // User ID
    actid: accountId, // Account ID
    source: 'API',    // Source should be 'API' as per login request
    susertoken: sessionToken, // User Session Token
  };

  console.log('Sending connection request:', connectPayload);
  flattradeWs.send(JSON.stringify(connectPayload));
};

const handleIncomingMessage = (message, resolve, reject, scripList) => {
  console.log('Received message:', message);

  switch (message.t) {
    case 'ck':
      if (message.s == 'OK') {
        console.log('Connection acknowledged for user:', message.uid);
        subscribeTouchline(scripList);
      } else {
        console.error('Connection failed: Invalid user ID or session token.');
        reject(new Error('Connection failed: Invalid user ID or session token.'));
      }
      break;

    case 'tk':
      console.log('Subscription acknowledged:', message);
      resolve('Subscription done for scriplist: ' + scripList); // Resolve when subscription is done
      break;

    case 'tf':
      console.log('Touchline feed:', message);
      broadcastToFrontendClients(message);
      break;

    case 'uk':
      console.log('Unsubscription acknowledged:', message);
      break;

    default:
      console.log('Unknown message type:', message);
  }
};

const subscribeTouchline = (scripList) => {
  const subscribePayload = {
    t: 't',        // 't' represents touchline subscription
    k: scripList,  // Example: 'NSE|NIFTY#NSE|BANKNIFTY'
  };

  console.log('Subscribing to touchline data for:', scripList);
  flattradeWs.send(JSON.stringify(subscribePayload));
};

const broadcastToFrontendClients = (message) => {
  frontendClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

module.exports = {
  connectFlattradeWebSocket,
};
