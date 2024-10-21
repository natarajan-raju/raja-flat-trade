'use strict';
const { env } = require('@strapi/utils');
const { connectFlattradeWebSocket } = require('../../../../config/functions/websocketClient.js');
const { fetchRequestToken } = require('../../../../config/functions/fetchRequestToken.js');

/**
 * variable controller
 */

// @ts-ignore
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::variable.variable', ({ strapi }) => ({
    //Handle Update request
    async handleInvestmentVariables(ctx) {        
        const userId = env('FLATTRADE_USER_ID');
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
        if(!requestTokenResponse.requestToken){
            return ctx.send({ error: 'Request token not found' });
        }
        const sessionToken = requestTokenResponse.requestToken;
        const accountId = env('FLATTRADE_ACCOUNT_ID');
        const {
          basePrice,          
          resistance1,
          resistance2,
          support1,
          support2,
          token,
          amount
        } = ctx.request.body;
    
        const index = await strapi.db.query('api::variable.variable').findOne({
            where: { token },  // Filter by token
        });
        
        if (!index) {
            return ctx.send({ error: 'Index not found for the provided token' });
        }

        // Step 2: Update values for the found index
        const updatedIndex = await strapi.db.query('api::variable.variable').update({
            where: { id: index.id },  // Update based on index ID
            data: {
            basePrice,
            resistance1,
            resistance2,
            support1,
            support2,
            amount,  // Store the investment amount
            },
        });
        
        // Step 3: Initiate WebSocket connection for the updated index using its token
        const uniqueToken = updatedIndex.token;  // Get the token for the updated index
        connectFlattradeWebSocket(userId, sessionToken, accountId, `NSE|${uniqueToken}`);
        return {
            message: "Investment variables updated successfully",
            updatedIndex,
        }
    },
    
}));
