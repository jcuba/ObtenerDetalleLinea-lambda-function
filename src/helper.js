var { swaggerMarkupBody } = require("./common.js");
const crypto = require('crypto');

const idFront = 'idFront', country = 'country', state = 'state', cityOrTown = 'cityOrTown', idLocalCompany = 'idLocalCompany', idBusLine = 'idBusLine', pathIdBusLine = 'pathIdBusLine';
const empty = '';


/**
 * Create response structure that API Gateway needs 
 * @param {*} data 
 * @param {*} event 
 * @returns 
 */
const buildApiGatewayResponseObject = async (data, event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
    headers: {
      "Access-Control-Allow-Origin": "*",
      ["Content-Type"]: "application/json",
    },
  };
  return response;
};

/**
 * Create swagger response documentati
 * @param {*} event 
 * @param {*} context 
 * @returns 
 */
const buildApiGatewaySwaggerResponseMarkup = async (event, context) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      ["Content-Type"]: "text/html",
    },
    body: swaggerMarkupBody,
  };
  
  return response;
};

/**
 * Validate all required params for this API
 * @param {*} params 
 * @returns 
 */
const validateParams = (params) => {
  if (params === null) {
    return false;
  } else {
    if (!params.hasOwnProperty(idFront) || params.idFront === null || params.idFront === empty) {
      return false;
    } else if (!params.hasOwnProperty(country) || params.country === null || params.country === empty) {
      return false;
    } else if (!params.hasOwnProperty(state) || params.state === null || params.state === empty) {
      return false;
    } else if (!params.hasOwnProperty(cityOrTown) || params.cityOrTown === null || params.cityOrTown === empty) {
      return false;
    } else if (!params.hasOwnProperty(idLocalCompany) || params.idLocalCompany === null || params.idLocalCompany === empty) {
      return false;
    } else if (!params.hasOwnProperty(idBusLine) || params.idBusLine === null || params.idBusLine == empty) {
      return false;
    } else {
      return true;
    }
  };
};

/**
 * Validate BusLine
 * @param {*} params 
 * @returns 
 */
const valideTrayecto = (params) => {
  let trayecto = !params.hasOwnProperty(pathIdBusLine) || params.pathIdBusLine === null || params.pathIdBusLine == empty ? empty : `&trayecto=${params.pathIdBusLine}`;
  return trayecto;
};

/**
 * Build a key for Redis.
 * @param {*} params 
 * @returns 
 */
const buildKeyRedis = async (params) => {
  let keyRedis = "detalleLinea:idLocalCompany" + params.idLocalCompany;
  let keyIdBusLine = "";
  let keyPathIdBusLine = "";
  let sForHashMD5 = "";
    
  if (params.idBusLine && params.idBusLine != null && params.idBusLine != "") {
    const paramIdBusLine = "idBusLine" + params.idBusLine;
    keyIdBusLine = keyRedis.concat(paramIdBusLine);
    sForHashMD5 = paramIdBusLine;
  }

  if (params.pathIdBusLine && params.pathIdBusLine != null && params.pathIdBusLine != "") {
    const paramPathIdBusLine = "pathIdBusLine" + params.pathIdBusLine;
    keyPathIdBusLine = keyIdBusLine.concat(paramPathIdBusLine);
    sForHashMD5 = sForHashMD5.concat(":" + paramPathIdBusLine);
  }

  const md5Hash = crypto.createHash('md5').update(sForHashMD5).digest('hex');
  keyRedis = keyRedis.concat(":" + md5Hash);
  
  return keyRedis;
};

module.exports = {
  buildApiGatewayResponseObject,
  buildApiGatewaySwaggerResponseMarkup,
  validateParams,
  valideTrayecto,
  buildKeyRedis
};
