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
    //handle touchline live feed
    async handleFeed(ctx) {
      const feedData = ctx.request.body.data;
      const { tk, lp } = feedData; // Keeping only relevant fields for brevity
    
      // Fetch the investment variables and current states for the index token tk
      const indexItem = await strapi.db.query('api::variable.variable').findOne({
        where: { token: tk },
      });
    
      if (!indexItem) {
        return ctx.send({ error: 'Index not found for the provided token' });
      }
    
      // Extract variables of the index
      let {
        basePrice, resistance1, resistance2, support1, support2, targetStep,
        callOptionBought, putOptionBought, currentStage
      } = indexItem;
    
      // Initialize a message collection
      let messages = [];
    
      // Update currentStage based on LP
      if (lp === basePrice) {
        currentStage = 'basePrice';
      } else if (lp === resistance1) {
        currentStage = 'resistance1';
      } else if (lp === support1) {
        currentStage = 'support1';
      } else if (lp === resistance2) {
        currentStage = 'resistance2';
      } else if (lp === support2) {
        currentStage = 'support2';
      }
    
      messages.push(`Market at ${currentStage} stage. Monitoring triggers.`);
      console.log(messages[messages.length - 1]);
    
      // BUY CALL Logic - Add check to prevent multiple buys at the same stage
      if (lp >= resistance2 + targetStep && !callOptionBought) {
        callOptionBought = true;
        messages.push(`Buy CALL at ${lp} for resistance2 + targetStep.`);
        console.log(messages[messages.length - 1]);
      }
    
      // BUY PUT Logic - Add check to prevent multiple buys at the same stage
      if (lp <= support2 - targetStep && !putOptionBought) {
        putOptionBought = true;
        messages.push(`Buy PUT at ${lp} for support2 - targetStep.`);
        console.log(messages[messages.length - 1]);
      }
    
      // Sell logic for CALL and PUT options based on stages:
    
      // If CALL was bought at basePrice + targetStep, sell at resistance1 or if index falls back to basePrice
      if (callOptionBought && currentStage === 'basePrice' && (lp >= resistance1 || lp <= basePrice)) {
        messages.push(`Sell CALL at ${lp}. Triggered by reaching resistance1 or fallback to basePrice.`);
        console.log(messages[messages.length - 1]);
        callOptionBought = false; // Reset flag after sell
      }
    
      // If CALL was bought at resistance1 + targetStep, sell at resistance2 or if index falls back to resistance1
      if (callOptionBought && currentStage === 'resistance1' && (lp >= resistance2 || lp <= resistance1)) {
        messages.push(`Sell CALL at ${lp}. Triggered by reaching resistance2 or fallback to resistance1.`);
        console.log(messages[messages.length - 1]);
        callOptionBought = false; // Reset flag after sell
      }
    
      // If CALL was bought at resistance2 + targetStep, sell at resistance2 (stop-loss at resistance2)
      if (callOptionBought && lp === resistance2) {
        messages.push(`Sell CALL at ${lp} (stop loss at resistance2).`);
        console.log(messages[messages.length - 1]);
        callOptionBought = false; // Reset flag after stop-loss sell
      }
    
      // If PUT was bought at basePrice - targetStep, sell at support1 or if index rises back to basePrice
      if (putOptionBought && currentStage === 'basePrice' && (lp <= support1 || lp >= basePrice)) {
        messages.push(`Sell PUT at ${lp}. Triggered by reaching support1 or rise back to basePrice.`);
        console.log(messages[messages.length - 1]);
        putOptionBought = false; // Reset flag after sell
      }
    
      // If PUT was bought at support1 - targetStep, sell at support2 or if index rises back to support1
      if (putOptionBought && currentStage === 'support1' && (lp <= support2 || lp >= support1)) {
        messages.push(`Sell PUT at ${lp}. Triggered by reaching support2 or rise back to support1.`);
        console.log(messages[messages.length - 1]);
        putOptionBought = false; // Reset flag after sell
      }
    
      // If PUT was bought at support2 - targetStep, sell at support2 (stop-loss at support2)
      if (putOptionBought && lp === support2) {
        messages.push(`Sell PUT at ${lp} (stop loss at support2).`);
        console.log(messages[messages.length - 1]);
        putOptionBought = false; // Reset flag after stop-loss sell
      }
    
      // Regular buy logic based on stages - with checks for existing buys
      if (lp >= (currentStage === 'basePrice' ? basePrice + targetStep :
                 currentStage === 'resistance1' ? resistance1 + targetStep :
                 currentStage === 'support1' ? support1 + targetStep :
                 currentStage === 'support2' ? support2 + targetStep : 
                 resistance2 + targetStep) && !callOptionBought) {
        callOptionBought = true;
        messages.push(`Buy CALL at ${lp} for ${currentStage} stage.`);
        console.log(messages[messages.length - 1]);
      }
    
      if (lp <= (currentStage === 'basePrice' ? basePrice - targetStep :
                 currentStage === 'resistance1' ? resistance1 - targetStep :
                 currentStage === 'support1' ? support1 - targetStep :
                 currentStage === 'resistance2' ? resistance2 - targetStep : 
                 support2 - targetStep) && !putOptionBought) {
        putOptionBought = true;
        messages.push(`Buy PUT at ${lp} for ${currentStage} stage.`);
        console.log(messages[messages.length - 1]);
      }
    
      // Update the variable states in the database
      await strapi.db.query('api::variable.variable').update({
        where: { token: tk },
        data: {
          callOptionBought,
          putOptionBought,
          currentStage
        }
      });
    
      // Return the collected messages
      return ctx.send({
        message: messages.length > 0 ? messages.join(' | ') : 'No actions executed.',
        currentStage,
        lp,
        indexItem,
      });
    },
    
    
}));
