const {parseAndCreateObjectAvanza,parseAndCreateObjectSae, parseAndCreateObjectGTFS, createObjectHeader} = require("./parser.js");
const {getEnvironmentVariables} = require("./client.js");
var { validateParams } = require("./helper.js");

/**
 * Find where is the correct road go to Avanza o Sae
 * @param {Object} params Parameters from request 
 * @returns Information of Line Detail.
 */
const findRoad = async (params) => {
	try{
    	const areValidParams = validateParams (params);
    	if(!areValidParams)
			return {header: createObjectHeader(410)};
		
		const environmentVariables = await getEnvironmentVariables(params.idLocalCompany, ["TIPO_CONSUMO_DETALLE_LINEA"]);
		console.log(`Variables: ${JSON.stringify(environmentVariables)}`);

		const tipoConsumo = environmentVariables.body?.length != 0 ? environmentVariables.body[0].valor : "";
		const nameLocalCompany = environmentVariables.body?.length != 0 ? environmentVariables.body[0].nombreEmpresa : "";
		console.log(`tipoConsumo: ${tipoConsumo}`);
		console.log(`nameLocalCompany: ${nameLocalCompany}`);
		if( tipoConsumo === "" )
			return {header: createObjectHeader(510)};

		const optionsRoad = {
			"API_AVANZA": parseAndCreateObjectAvanza,
			"API_SAE":  parseAndCreateObjectSae,
			"API_GTFS":  parseAndCreateObjectGTFS
		};
		
		return optionsRoad[tipoConsumo](params,nameLocalCompany) || createObjectHeader(510);
  	}catch(error){
		console.log(error);
  	}
};

module.exports = {
    findRoad
}