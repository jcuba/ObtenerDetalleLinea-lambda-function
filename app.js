var { findRoad } = require("./src/controller.js");
var { buildApiGatewayResponseObject, buildApiGatewaySwaggerResponseMarkup } = require("./src/helper.js");
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

/**
 * Get a response for a Request from API ObtenerDetalleParada.
 * @param {*} event 
 * @param {*} context 
 * @returns {JSON Object} Data with the information of Line Detail.  
 */
exports.lambdaHandler = async (event, context) => {
  try {
    if (event.httpMethod === "GET" && event.path === "/ObtenerDetalleLinea/Swagger") {
      response = buildApiGatewaySwaggerResponseMarkup(event, context);
    } else if (event.httpMethod === "POST" && event.path === "/ObtenerDetalleLinea") {
      const request = await findRoad(JSON.parse(event.body));
      response = buildApiGatewayResponseObject(request, event);
    }
  } catch (err) {
    console.error(err);
    return err;
  }
  
  return response;
};
