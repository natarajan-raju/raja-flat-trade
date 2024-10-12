'use strict';
// @ts-ignore
const { env } = require('@strapi/utils');
const { sha256 } = require('js-sha256');

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
            return ctx.redirect(`${frontendErrorUrl}/?message=${encodeURIComponent(data.emsg || 'Either a token code for the day already exists, or something went wrong during the authentication process.')}`);
          }
          // Retrieve all tokens (without any conditions)
          const existingTokens = await strapi.db.query('api::authentication.authentication').findMany();

          // Check if any tokens exist
          if (existingTokens.length === 0) {
            // No tokens found, create a new one
            await strapi.db.query('api::authentication.authentication').create({
              data: { requestToken: data.token },
            });
          } else {
            // Token(s) found, update the first one (or you could update all if necessary)
            await strapi.db.query('api::authentication.authentication').update({
              where: { id: existingTokens[0].id }, // Update the first found token
              data: { requestToken: data.token },
            });
          }
   
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
}));
