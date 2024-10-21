'use strict';
// @ts-ignore
const { env } = require('@strapi/utils');
const { sha256 } = require('js-sha256');
const { connectFlattradeWebSocket } = require('../../../../config/functions/websocketClient');
const {fetchRequestToken } = require('../../../../config/functions/fetchRequestToken');

/**
 * authentication controller
 */

// @ts-ignore
const { createCoreController } = require('@strapi/strapi').factories;


module.exports = createCoreController('api::authentication.authentication',({ strapi }) => ({
    //Custom function for User authentication from Flattrade
    async handleRequestToken(ctx) {
        const frontendUrl = env('DOMAIN_URL');
        const frontendErrorUrl = env('ERROR_HANDLER_URL');            
          // Retrieve the requestToken from query params
          const { code } = ctx.query;
    
          // Check if the requestToken is present
          if (!code) {
            return ctx.redirect(`${frontendErrorUrl}/?message=Request+token+is+missing+from+Flattrade`);
          }
          const apiKey = env('FLATTRADE_API_KEY');
          const apiSecret = env('FLATTRADE_API_SECRET');
          const concatValue = apiKey + code + apiSecret;
             
       
          const payload = {
            "api_key": apiKey,
            "request_code": code,
            "api_secret": sha256(`${concatValue}`),
          };
            
          const tokenResponse = await fetch('https://authapi.flattrade.in/trade/apitoken', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify( payload ),
          });
          const data = await tokenResponse.json();
          console.log(data);
          // Check if token retrieval was successful
          if (data.token.length === 0 || !data.token) {
            return ctx.redirect(`${frontendErrorUrl}/?message=${encodeURIComponent('Either a token code for the day already exists, or something went wrong during the authentication process.')}`);
          }

          
          // Retrieve all tokens (without any conditions) from database
          const requestTokenResponse = await fetchRequestToken()
                          .then((data) => {return {
                            requestToken: data.requestToken,
                            id: data.id
                            }
                          })
                          .catch((err) => {
                            console.log({err});
                            return {
                              requestToken: false,
                              id: '',
                            };
                          });;

          // Check if any tokens exist
          const existingRequestToken = requestTokenResponse.requestToken;
          if (!existingRequestToken) {
            // No tokens found, create a new one
            await strapi.db.query('api::authentication.authentication').create({
              data: { requestToken: data.token },
            });
          } else {
            
            // Token(s) found, update the first one (or you could update all if necessary)
            await strapi.db.query('api::authentication.authentication').update({
              where: { id: requestTokenResponse.id }, // Update the first found token
              data: { requestToken: data.token },
            });
          }
          // //Connect to websocket once token is generated
          // const userId = env('FLATTRADE_USER_ID');
          // const accountId = env('FLATTRADE_ACCOUNT_ID');
          // connectFlattradeWebSocket(userId, data.token, accountId);
          // Redirect to the success page
          ctx.redirect(`${frontendUrl}/?message=${encodeURIComponent('Login successful and token successfully generated')}`);         
        
      },
      async findOne(ctx) {
        const { id } = ctx.params;
        const entry = await strapi.entityService.findOne('api::authentication.authentication', id);
        return entry;
      },

      //Handle undefined route
      async handleUndefinedRoute(ctx) {
        // Redirect to the frontend error page with a descriptive message
        const errorMessage = 'Either a token code for the day already exists, or something went wrong during the authentication process.';
        const frontendErrorUrl = env('ERROR_HANDLER_URL');
        const redirectUrl = `${frontendErrorUrl}?message=${encodeURIComponent(errorMessage)}`;
        
        // Redirect with 302 status code to indicate a temporary redirect
        return ctx.redirect(302, redirectUrl);
      },

      //Handle Web socket connection
      async handleWebsocketConnection(ctx) {
        // Try to fetch the request token        
        const requestTokenResponse = await fetchRequestToken()
                          .then((data) => {return {
                            requestToken: data.requestToken,
                            id: data.id
                            }
                          })
                          .catch((err) => {
                            console.log({err});
                            return {
                              requestToken: false,
                              id: '',
                            };
                          });;

          // Check if any tokens exist
        const requestToken = requestTokenResponse.requestToken;
        if(!requestToken){
          return {
            message: 'Request token not found',            
          }
        }
        const userId = env('FLATTRADE_USER_ID');
        const accountId = env('FLATTRADE_ACCOUNT_ID');
        const scripList = 'NSE|NIFTY#NSE|BANKNIFTY';
        connectFlattradeWebSocket(userId, requestToken, accountId,scripList);
        return ctx.send('Websocket connection request in progress...');
      },
      
      async getUserDetails(ctx) {
        // Retrieve all tokens (without any conditions)
        const uid = env('FLATTRADE_USER_ID');
       
        const jData = JSON.stringify({ uid });
        const requestTokenResponse = await fetchRequestToken()
                          .then((data) => {return {
                            requestToken: data.requestToken,
                            id: data.id
                            }
                          })
                          .catch((err) => {
                            console.log({err});
                            return {
                              requestToken: false,
                              id: '',
                            };
                          });;

          // Check if any tokens exist
        const jKey = requestTokenResponse.requestToken;
        
        // Create a URL-encoded string for the body
        const payload = new URLSearchParams({
            jData: jData, // Directly assign the JSON string
            jKey: jKey
        }).toString();
        
        const response = await fetch('https://piconnect.flattrade.in/PiConnectTP/UserDetails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: payload, // Use the URL-encoded string
        });
    
        const data = await response.json();
        return data;
      },


}));

