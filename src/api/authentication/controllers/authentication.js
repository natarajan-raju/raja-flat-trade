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
        const frontendUrl = env('FLATTRADE_FRONTEND_URL');
        const frontendErrorUrl = env('FLATTRADE_FRONTEND_ERROR_URL');
        try {       
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
          // Check if token retrieval was successful
          if (data.stat !== 'Ok' || !data.token) {
            return ctx.redirect(`${frontendErrorUrl}/?message=${encodeURIComponent(data.emsg || 'Failed to retrieve token')}`);
          }
           // Create or update the token for the day
          await strapi.db.query('api::authentication.authentication').upsert({
            where: { createdAt: { $gte: new Date().setHours(0, 0, 0, 0) } }, // Today's token check
            update: { requestToken: data.token }, // Update existing token
            create: { requestToken: data.token }, // Create a new entry if no token exists today
          });
          // Redirect to the success page
          ctx.redirect(`${frontendUrl}/success?token=${data.token}`);
          
        } catch (err) {
          console.log(err);
          ctx.throw(500, 'Unable to save request token');
        }
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
        const frontendErrorUrl = env('FLATTRADE_FRONTEND_ERROR_URL');
        const redirectUrl = `${frontendErrorUrl}?message=${encodeURIComponent(errorMessage)}`;
        
        // Redirect with 302 status code to indicate a temporary redirect
        return ctx.redirect(302, redirectUrl);
      },
}));
