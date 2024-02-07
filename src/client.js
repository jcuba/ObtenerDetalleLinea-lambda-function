const axios = require("axios").default;
const aws = require("aws-sdk");
const { getDetalleLineaSAEUrl,urlSae,resources,endpoint,version,region,arnFunction, mongoServerAddress,
  mongoDbName,
  mongoDbUsername,
  mongoDbPassword} = require("./common.js");
const { valideTrayecto } = require("./helper");

const { MongoClient } = require("mongodb");

const getLineasFromMongoGTFS = async (params) => {
  const url = `mongodb://${mongoDbUsername}:${mongoDbPassword}@${mongoServerAddress}:27017`;

  const client = new MongoClient(url, {
    useUnifiedTopology: true,
  });
  
  const pipeline = [
    {
      $project: {
        _id:0,
        agency_id: 1,
        route_color: 1,
        route_long_name: 1,
      }
    },
    { $unwind : "$agency_id" }
  ];

  try {
    console.log(`Intentando conectar a ${url}`)
    await client.connect();
    console.log("Conectado!");

    const database = client.db(mongoDbName);
    const collection = database.collection("ROUTES_GTFS");
    console.log(`filtrando por: ${JSON.stringify(pipeline)}`);
    const resultado = await collection.aggregate(pipeline).toArray();
    //console.log(">>>> Imprime resultado", resultado);

    return JSON.parse(JSON.stringify(resultado));
  } catch (err) {
    console.log(`Error al intentar consultar a Mongo ${err}`);
    return err;
  } finally {
    console.log("cerrando conexión ...");
    await client.close();
  }
};

/**
 * Process data from environment variables
 * @param {*} params
 * @returns
 */
const createFiltro = (params) => {
  let filtro = {};
  if (
    params.hasOwnProperty("idBrand") &&
    params.idBrand != null &&
    params.idBrand != ""
  ) {
    filtro = {
      $or: [
        { IDBRANDSARRAY: { $regex: `\"idBrand\":${params.idBrand},` } },
        { IDBRANDSARRAY: { $regex: `\"idBrand\": ${params.idBrand},` } },
      ],
    };
  }

  filtro["STATUS"] = Number(1);
  filtro["IDLOCALCOMPANY"] = String(params.idLocalCompany);
  if (
    params.hasOwnProperty("idMacroRegion") &&
    params.idMacroRegion != null &&
    params.idMacroRegion != ""
  ) {
    try {
      filtro["MACROREGIONES.MACROREGION_ID"] = Number(params.idMacroRegion);
    } catch (error) {
      filtro["MACROREGIONES.MACROREGION_ID"] = params.idMacroRegion;
    }
  }
  if (
    params.hasOwnProperty("idRegion") &&
    params.idRegion != null &&
    params.idRegion != ""
  ) {
    try {
      filtro["REGIONES.REGION_ID"] = Number(params.idRegion);
    } catch (error) {
      filtro["REGIONES.REGION_ID"] = params.idRegion;
    }
  }

  return filtro;
};

/**
 * Get environment variables from external lambda
 * @param {String} idLocalCompany Local company Identifier 
 * @param {Array<String>} environmentVariables Names of variables to get
 * @returns {Object} Result of the call to the lambda
 */
const getEnvironmentVariables = async (idLocalCompany,environmentVariables) => {
	try {
		let lambda = new aws.Lambda({
			apiVersion: version,
			endpoint: endpoint,
			region: region
   		});
    
		let request = {
			idLocalCompany: idLocalCompany,
			nombres: environmentVariables
		};
    console.log("PlayLoad to lambda:" + JSON.stringify(request));

		let params = {
			FunctionName: arnFunction,
			InvocationType: 'RequestResponse',
			Payload: JSON.stringify(request)
		};

		console.log(`Consultando lambda: ${arnFunction}`);
		let response = await lambda.invoke(params).promise();
		console.log("lambda respondió con:" + JSON.stringify(response));
		if (response.StatusCode === 200 && (response.Payload != null || response.Payload != "null")) {
			console.log(`lambda response: ${response.Payload}`);
			return JSON.parse(response.Payload);
		} else {
			return {status: 510};
		}    
	} catch (err) {
    	console.log(`Error al consultar variables de ambiente: ${err}`);
    	return JSON.parse(err);
  	}
};

/**
 * Build the URL that we will call to bring the data
 * @param {*} params 
 * @returns 
 */
const getParametersFromApi = async (params,resource) => {
  const variables = await getEnvironmentVariables(params.idLocalCompany, ['ID_SISTEMA_SAE_DETALLE']);
	let sistemaId = variables.body?.length != 0 ? variables.body[0].valor : "";
	if( sistemaId === "" )
		return {status: 510};

  let typeResource = resources[resource];
  let url = `${urlSae}${typeResource.url}?SISTEMA_ID=${sistemaId}&RUTA_ID=${params.idBusLine}`;
  let configurationRequest = {
    method: typeResource.httpMethod,
    url: url
  };
  return fetchResponse(configurationRequest);
};

/**
 * Build the URL that we will call to bring the data
 * @param {*} params 
 * @returns 
 */
const getResponseFromSAE = async (params) => {
  //Evaluate here idLocalCompany to get the correct endpoint to call
  let trayecto = valideTrayecto(params);
  let url = `${getDetalleLineaSAEUrl}?empresa=${params.idLocalCompany}&linea=${params.idBusLine}${trayecto}`;
  let configurationRequest = {
    method: "get",
    url: url
  };
  console.log("--> URL: ", url);
  return fetchResponse(configurationRequest);
};

/**
 * Perform network call to external Avanza API
 * @param {*} url 
 * @returns 
 */
const fetchResponse = async (url) => {
  try {
    let request = await axios(url);
    console.log("Request: ", request);
    return request;
  } catch (err) {
    //If error happened, respond back with error status and body
    if (err.response) {
      console.log("Error in client: ", err);
      console.log(err.response.data);
      console.log(err.response.status);
      console.log(err.response.headers);
      return err.response;
    } else if (err.request) {
      console.log(err.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error ", err.message);
    }
    console.log("Error config: ", err.config);
    console.log(err.toJSON());
  }
};

module.exports = {
  getResponseFromSAE,
  getEnvironmentVariables,
  getParametersFromApi,
  getLineasFromMongoGTFS
};
