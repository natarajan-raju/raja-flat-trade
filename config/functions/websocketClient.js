const WebSocket = require('ws');

const flattradeWsUrl = 'wss://piconnect.flattrade.in/PiConnectWSTp/';
let flattradeWs;


//Connect to Websocket & subscribe
const connectFlattradeWebSocket = (userId, sessionToken, accountId, scripList) => {
  
    flattradeWs = new WebSocket(flattradeWsUrl);
    flattradeWs.on('open', () => {
      console.log('Flattrade WebSocket connection established.');
      sendConnectionRequest(userId, sessionToken, accountId);


    flattradeWs.on('message', (data) => {
      const messageString = Buffer.isBuffer(data) ? data.toString() : data;
      // @ts-ignore
      const message = JSON.parse(messageString);
      handleIncomingMessage(message, scripList);
    });

    flattradeWs.on('close', () => {
      console.log('Flattrade WebSocket connection closed. Attempting reconnect...');
      setTimeout(() => connectFlattradeWebSocket(userId, sessionToken, accountId,scripList), 5000);
    });

    flattradeWs.on('error', (error) => {
      console.error('Flattrade WebSocket error:', error);      
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

const handleIncomingMessage = (message, scripList) => {
  console.log('Received message:', message);

  switch (message.t) {
    case 'ck':
      if (message.s == 'OK') {
        console.log('Connection acknowledged for user:', message.uid);
        subscribeTouchline(scripList);
      } else {
        console.error('Connection failed: Invalid user ID or session token.');       
      }
      break;

    case 'tk':
      console.log('Subscription acknowledged:', message);      
      break;

    case 'tf':
      console.log('Touchline feed:', message);      
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



module.exports = {
  connectFlattradeWebSocket,
};
