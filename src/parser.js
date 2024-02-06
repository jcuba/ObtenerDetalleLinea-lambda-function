var { getResponseFromSAE,getParametersFromApi, getLineasFromMongoGTFS } = require("./client.js");
var { validateParams, buildKeyRedis } = require("./helper.js");
var { url } = require('./common.js');
var nameLocalCompany = ""
const redisConnection = require('redisHandler');

// Se crea variable global para almacenar el response de SAE.
let globalResponseFromSAE = {};
let sizeGlobalResponseFromSAE = 0;

/**
 * Validate params and create response from Avanza
 * @param {*} params 
 * @returns 
 */
const parseAndCreateObjectAvanza = async (params, nameCompany) => {
  // Se crea instancia que se conecta a redis.
  const redis = new redisConnection(url);

  // Validamos conexión con Redis ALIVE.
  const respHealty = await redis.isHealtyRedis()

  if(respHealty === null){
    console.log(">> parser.js::parseAndCreateObjectAvanza::Error en la conexión con REDIS, no ha sido posible conectarse con el servidor.");
    return null;
  }

  // Construimos KEY para GUARDAR/LEER de Redis.
  const keyRedis = await buildKeyRedis(params);
  console.log("keyRedis: ", keyRedis);
  
  try {
    nameLocalCompany = nameCompany;
    let isValidParams = validateParams(params);
    if (isValidParams) {
      // Se va ha validar si existe registro en REDIS.
      isKeyInRedis = await redis.isExistKey(keyRedis);

      if (params.cleanRedis === 1) {
        const deleteResponse = await redis.jsonDEL(keyRedis);
        return { status: 200, message: "El registro ha sido eliminado de Redis correctamente."};
      }

      let response = {};
      if (isKeyInRedis.ok) {
        // Se va a obtener la información de Redis.
        response = await redis.jsonGET(keyRedis);
        response = response.data;
      } else {
        response = await getResponseFromSAE(params);

        let tipoDato = typeof response.data.data;        
        if (response.status === 200 && response.data.status === "ok" && tipoDato === "object") {
          const jsonToRedis = {};
          jsonToRedis.status = response.status;
          jsonToRedis.data = response.data;

          // Se va ha realizar el guardado de la información en Redis.
          const respWriteJson = await redis.jsonSET(keyRedis, jsonToRedis)
        }
      }

      let object = {};
      console.log("Response in parser: ", response);
      console.log("Status before: ", response?.status);
        
      switch (response?.status) {
        case 200:
          object = validateSuccessOperation(response?.data);
          break;
        case 503:
          object = {
            header: createObjectHeader(510),
          };
          break;
        default:
          object = {
            header: createObjectHeader(response?.status),
          };
          break;
      }
      
      return object;
    } else {
      return {
        header: createObjectHeader(410),
      };
    }
  } catch (err) {
    console.log("Algun error ocurrió en parser.js", err);
  }
};


/** GTFS **/
const parseAndCreateObjectGTFS = async (params) => {
  console.log("DetalleLineasGTFS!")
  let response = {
    header: createObjectHeader(200),
    result: formatResponseGTFS(await getLineasFromMongoGTFS(params))
  }
  return response;
}

const formatResponseGTFS = (data) => {
  let response = [];
  console.log("detalleLineas: ", data[0].lineas)
  data[0].lineas.forEach((eachBusLine) =>{
    let item = {
      idBusSAE: eachBusLine?.agency_id ?? null,
      color: eachBusLine?.route_color ?? null,
      desLocalCompany: null,
      localCompany: null,
    }
    response.push(item)
  })
  return response;
};




/**
 * Create response from Sae
 * @param {Object} params Parameters from request
 * @param {String} nameCompany Name of the company to search information 
 * @returns {Object} Info of DetalleDeLinea
 */
const parseAndCreateObjectSae = async (params,nameCompany) => {
  // Se crea instancia que se conecta a redis.
  const redis = new redisConnection(url);

  // Validamos conexión con Redis ALIVE.
  const respHealty = await redis.isHealtyRedis()

  if(respHealty === null){
    console.log(">> parser.js::parseAndCreateObjectSae::Error en la conexión con REDIS, no ha sido posible conectarse con el servidor.");
    return null;
  }

  // Construimos KEY para GUARDAR/LEER de Redis.
  const keyRedis = await buildKeyRedis(params);
  console.log("keyRedis: ", keyRedis);

  try{
    // Se va ha validar si existe registro en REDIS.
    isKeyInRedis = await redis.isExistKey(keyRedis);

    if (params.cleanRedis === 1) {
      const deleteResponse = await redis.jsonDEL(keyRedis);
      return { status: 200, message: "El registro ha sido eliminado de Redis correctamente."};
    }

    let response = {};
    if (isKeyInRedis.ok) {
      // Se va a obtener la información de Redis.
      response = await redis.jsonGET(keyRedis);      
      response = response.data;
    } else {
      nameLocalCompany = nameCompany;
      let getTrechos = await getParametersFromApi(params,"Trechos");
      let getParada = await getParametersFromApi(params,"Parada");
      let getRuta = await getParametersFromApi(params,"Ruta");
      let getTrazado = await getParametersFromApi(params,"Trazado");

      response = validateSaeOperations({
        "Trechos":{
          status: getTrechos?.status,
          data: getTrechos?.data
        },
        "Parada":{
          status: getParada?.status,
          data: getParada?.data
        },
        "Ruta":{
          status: getRuta?.status,
          data: getRuta?.data
        },
        "Trazado":{
          status: getTrazado?.status,
          data: getTrazado?.data
        }
      }, params)

      sizeGlobalResponseFromSAE = Object.keys(globalResponseFromSAE).length;
      if (sizeGlobalResponseFromSAE > 0) {
          let jsonToRedis = {
            header: createObjectHeader(200),
            result: { busLine: globalResponseFromSAE }
          };
          
          // Se va ha realizar el guardado de la información en Redis.
          const respWriteJson = await redis.jsonSET(keyRedis, jsonToRedis)
      }      
    }            

    return response;
  }catch (err) {
      console.log("Algun error ocurrió en parser.js", err);
      return { header: createObjectHeader(510) };
  }
};

/**
 * Validate if request to Sae operation return a ok response
 * @param {Object} saeInfo Status and data response from sae api
 * @param {Object} params Parameters from request
 * @returns {Object} Obtener detalle response
 */
const validateSaeOperations = async (saeInfo,params) =>{
  let isStatusReponseOk = true;
  let isDataReponseOk = true;
  let responseData = {};
  
  for (const [key, value] of Object.entries(saeInfo)) {
    if(value.status != 200 ){
      console.log(`No se regreso valor para ${key} el codigo de error fue: ${value.status}`);
      isStatusReponseOk = false;
      break;
    }
    if(typeof value.data === 'string'){
      console.log(`No se regreso valor para ${key} la respuesta fue: ${value.data}`);
      isDataReponseOk = false;
      break;
    }
    responseData[key] = value.data;
  }

  if (!isStatusReponseOk)
    return object = {
      header: createObjectHeader(510),
    };

  if (!isDataReponseOk)
    return object = {
      header: createObjectHeader(200),
    };

  return createObjectResponseSae(responseData,params);
};

/**
 *  Begin with the process for create a response
 * @param {Object} responseData Data from Sae
 * @param {Object} params data from request 
 * @returns {Object} Info builded
 */
const createObjectResponseSae = (responseData, params) => {
  let response = {
    header: createObjectHeader(200),
    result: createObjectResultSae(responseData, params),
  };

  globalResponseFromSAE = response.result.busLine;
  
  return response;
};

/**
 * Create de body response 
 * @param {Object} responseData Data from Sae
 * @param {Object} params data from request
 * @returns {Object} Body response
 */
const createObjectResultSae = (responseData, params) => {
  let paradasDic = {}
  responseData.Parada.forEach(parada => {
    paradasDic[parada.PARADA_ID] = parada
  });
  
  return {
      busLine : [{
        idBusSAE: responseData.Ruta.ID.toString(),
        brands: responseData.Ruta.MARCAS,
        color: null,
        distance: null,
        outTrip: createFeatures(responseData,paradasDic),
        backTrip: null,
        desLocalCompany: nameLocalCompany,
        scale: null,
        descBusLine: responseData.Ruta.ID.toString(),
        localCompany: params.idLocalCompany,
        geographic_data_structure: {
          initial_map_coordinates: [
            paradasDic[responseData.Ruta.PARADA_INICIO_ID].LONGITUD_CENTRO,
            paradasDic[responseData.Ruta.PARADA_INICIO_ID].LATITUD_CENTRO
          ]
        },
        descBusLine: responseData.Ruta.NAME
      }]
  };
};

/**
 * Create info of the property outTrip in the body response 
 * @param {Object} responseData  Data from Sae
 * @param {Object} paradasDic Info of paradas key-value where key is id of stop and value is info of busStop
 * @returns {Object} Features for the stopBus
 */
const createFeatures = (responseData,paradasDic)  => {
  let properties = getProperties(paradasDic,responseData.Trechos,responseData.Ruta);
  let geometry = addGeometry(paradasDic,responseData.Trazado,responseData.Ruta.PARADA_INICIO_ID,properties);
  return {
    features: geometry,
    type: "FeatureCollection"
  };
};

/**
 * Add de geo information for each feature 
 * @param {Object} paradas Info of paradas key-value where key is id of stop and value is info of busStop
 * @param {Array} trechos Info of trechos obtained from Sae
 * @param {Number} paradaInicio The if of the first stopBus
 * @param {Array} properties Features without geo information
 * @returns {Object} Features with geo information
 */
const addGeometry = (paradas,trazados,paradaInicio,properties) => {
  let geometry = properties.map( (property,index) => {
    let geometryArray = [];
    let typeGeometry = "";
    if(index != 0){
      let stopBus = paradas[property.idBusStop];
      geometryArray.push(stopBus?.LONGITUD_CENTRO);
      geometryArray.push(stopBus?.LATITUD_CENTRO);
      typeGeometry = "Point";
    }
    else{
      let geos = trazados.map(trazo => {
        return [trazo.LONGITUD,trazo.LATITUD]
      });
      geometryArray = [geos];
      typeGeometry = "MultiLineString";
    }
    return{
      geometry:{
        coordinates: geometryArray,
        type: typeGeometry
      },
      properties: property,
      type: "Feature"
    }
  });
  return geometry;
};

/**
 *  Sort Trechos by bus stop
 * @param {Array} trechos - Trechos to be sorted
 * @param {String} firstStop - The inicial bus stop of the line
 * @returns {Array} - Trechos sorted
 */
const sortTrechos = (trechos,firstStop) => {
  let trechosDicc = {}
  let trechosSorted = []
  
  trechos.forEach((trecho)=>{
      trechosDicc[trecho.PARADA_INICIO_ID] = trecho
  });

  let busStop = {};
  let currentStop = firstStop;
  while(busStop != null){
    busStop = trechosDicc[currentStop] ?? null; 
    if( busStop != null){
      trechosSorted.push(busStop);
      currentStop = busStop.PARADA_FIN_ID;
    }
  }
  console.log("Trechos sorted: " + JSON.stringify(trechosSorted))
  return trechosSorted;
};

/**
 * Obtain properties for each Feature
 * @param {Object} paradas Info of paradas key-value where key is id of stop and value is info of busStop
 * @param {Array} trechos Info of trechos obtained from Sae
 * @param {Number} idBusLine id of the bus line 
 * @returns Features information
 */
const getProperties = (paradas,trechos,ruta)  => {
  let features = [{
    node: null,
    idBusStop:  ruta.ID.toString(),
    brands : null,
    color: null,
    desBusStop: null,
    idBusLine: ruta.ID.toString(),
    busLineCrossing: null
  }]
  let lastStop = null;
  let trechosSorted = sortTrechos(trechos,ruta.PARADA_INICIO_ID.toString());
  trechosSorted.forEach(trecho => {
    let parada = paradas[trecho.PARADA_INICIO_ID];
    let busLineCrossing = trecho.RUTAS.map( rutaInfo => {
        return rutaInfo.RUTA_ID.toString()
    });
    
    busLineCrossing.sort((a,b) => {return a - b;})
    busLineCrossing = busLineCrossing.map( rutaInfo => {return rutaInfo.toString()} );
    lastStop = trecho.PARADA_FIN_ID;
    let feature = {
            node: trecho.PARADA_INICIO_ID.toString(),
            idBusStop: trecho.PARADA_INICIO_ID.toString(),
            brands : parada?.MARCAS !== null ? tranformBrands(parada.MARCAS) : null,
            color: null,
            desBusStop: parada.PARADA,
            idBusLine: ruta.ID.toString(),
            busLineCrossing: busLineCrossing
    };
    features.push(feature);
  });
  console.log("Last Stop: " + lastStop);
  let lastStopInfo = paradas[lastStop]
  let busLineCrossing = lastStopInfo.RUTAS.map( rutaInfo => {
      return rutaInfo.RUTA_ID.toString()
  });
  busLineCrossing.sort((a,b) => {return a - b;})
  busLineCrossing = busLineCrossing.map( rutaInfo => {return rutaInfo.toString()} );
  features.push({
          node: lastStopInfo.PARADA_ID.toString(),
          idBusStop: lastStopInfo.PARADA_ID.toString(),
          brands : lastStopInfo?.MARCAS !== null ? tranformBrands(lastStopInfo.MARCAS) : null,
          color: null,
          desBusStop: lastStopInfo.PARADA,
          idBusLine: ruta.ID.toString(),
          busLineCrossing: busLineCrossing
  })
  console.log("Features: " + JSON.stringify(features))
  return features;
};

/**
 * Change the key name for brands
 * @param {Object} brands Brand to be changed
 * @returns {Object} New brand structure
 */
const tranformBrands = (brands) => {
  return brands.map((brand)=>{
    return {
      idBrand:brand.MARCA_ID,
      desBrand: brand.MARCA
    }
  })
};

/**
 * Validate that response from SAE is status 'ok'
 * @param {*} responseData 
 * @returns 
 */
const validateSuccessOperation = (responseData) => {
  if (responseData.hasOwnProperty("status")) {
    let object = {};
    switch (responseData.status) {
      case "ok":
        console.log("--> sae OK!!!");
        object = createObjectResponse(responseData);
        break;
      case "ko":
        console.log("--> sae KO");
        object = { header: createObjectHeader(510) };
        break;
      default:
        console.log("--> sae KO");
        object = { header: createObjectHeader(510) };
        break;
    }
    return object;
  } else {
    return { header: createObjectHeader(510) };
  }
};

const validateSuccessOperationGTFS = (responseData) => {
  if (responseData.hasOwnProperty("status")) {
    let object = {};
    switch (responseData.status) {
      case "ok":
        console.log("--> gtfs OK!!!");
        object = createObjectResponseGTFS(responseData);
        break;
      case "ko":
        console.log("--> gtfs KO");
        object = { header: createObjectHeader(510) };
        break;
      default:
        console.log("--> gtfs KO");
        object = { header: createObjectHeader(510) };
        break;
    }
    return object;
  } else {
    return { header: createObjectHeader(510) };
  }
};

/**
 * Create response from gtfs
 * @param {*} responseData 
 * @returns 
 */
const createObjectResponseGTFS = (responseData) => {
  let status = responseData?.status;
  let response = {
    header: createObjectHeader(200),
    result: responseData.hasOwnProperty("data") ? createObjectResultGTFS(responseData.data) : null,
  };
  return response;
};


 //GTFS
const createObjectResultGTFS = (data) => {
  let busLine = [];
  let getColorAndDescBusLine = [getColorAndDescription([data?.ida, data?.vuelta])];
  let eachBusLine = {
    idBusSAE: data?.linsae ?? null,
    color: getColorAndDescBusLine.color ?? null,
    distance: data?.distancia ?? null,
    outTrip: getTrip(data?.ida, getColorAndDescBusLine.color ?? null, data?.linsae ?? null),
    backTrip: getTrip(data?.vuelta, getColorAndDescBusLine.color ?? null, data?.linsae ?? null),
    desLocalCompany: null,
    scale: data?.escala ?? null,
    idBusLine: data?.linsae ?? null,
    localCompany: null,
    geographic_data_structure: {
      initial_map_coordinates: [data?.medlon, data?.medlat],
    },
    descBusLine: getColorAndDescBusLine.name ?? null,
  };
  busLine.push(eachBusLine);
  return { busLine };
};


/**
 * Create response from sae
 * @param {*} responseData 
 * @returns 
 */
const createObjectResponse = (responseData) => {
  let status = responseData?.status;
  let response = {
    header: createObjectHeader(200),
    result: responseData.hasOwnProperty("data") ? createObjectResult(responseData.data) : null,
  };
  return response;
};


/**
 * Create header response
 * @param {*} status 
 * @returns 
 */
const createObjectHeader = (status) => {
  console.log("---> status creatObjectHeader: ", status);
  switch (status) {
    case 200:
      return {
        code: 100,
        message: "Detalle de Líneas Obtenido",
        status: "OK",
      };
      break;
    case 510:
      return {
        code: 510,
        message: "No se logro Operación",
        status: "Error: Falla o Error general de inserción u obtención de datos en tiempo de ejecución en el servidor",
      };
      break;
    case 410:
      return {
        code: 410,
        message: "Error en parametros",
        status: "Error: Falla o Error General del Cliente por falta de datos o formato",
      };
    default:
      return {
        code: 510,
        message: "No se logro Operación",
        status: "Error: Falla o Error general de inserción u obtención de datos en tiempo de ejecución en el servidor",
      };
  }
};


/**
 * structure the different answers
 * @param {*} data 
 * @returns 
 */
const createObjectResult = (data) => {
  let busLine = [];
  let getColorAndDescBusLine = getColorAndDescription([data?.ida, data?.vuelta]);
  let eachBusLine = {
    idBusSAE: data?.linsae ?? null,
    color: getColorAndDescBusLine.color ?? null,
    distance: data?.distancia ?? null,
    outTrip: getTrip(data?.ida, getColorAndDescBusLine.color ?? null, data?.linsae ?? null),
    backTrip: getTrip(data?.vuelta, getColorAndDescBusLine.color ?? null, data?.linsae ?? null),
    desLocalCompany: null,
    scale: data?.escala ?? null,
    idBusLine: data?.linsae ?? null,
    localCompany: null,
    geographic_data_structure: {
      initial_map_coordinates: [data?.medlon, data?.medlat],
    },
    descBusLine: getColorAndDescBusLine.name ?? null,
  };
  busLine.push(eachBusLine);
  return { busLine };
};

/**
 * Get the color and the information for busLine
 * @param {Array} trips 
 * @returns {Array} Busline's color and description
 */
const getColorAndDescription = (trips) => {
  let object = {};
  trips.forEach((eachTrip) => {
    eachTrip?.features.forEach((eachFeature) => {
      if (eachFeature?.geometry?.type === "MultiLineString") {
        if (eachFeature?.properties?.color !== "") {
          object.color = eachFeature?.properties?.color ?? null;
          object.name = eachFeature?.properties?.name ?? null;
          return;
        }
      }
    });
  });
  return object;
};

/**
 * 
 * @param {Array} trip 
 * @param {String} color 
 * @param {Number} idBusLine 
 * @returns 
 */
const getTrip = (trip, color, idBusLine) => {
  let features = [];
  trip?.features.forEach((eachFeature) => {
    let feature = {
      ...eachFeature,
      properties: {
        node: eachFeature?.properties?.nodo ?? null,
        idBusStop: eachFeature?.properties?.id ?? null,
        idBusSAE: eachFeature?.properties?.idsae ?? null,
        color: color,
        desBusStop: eachFeature?.properties?.nombre ?? null,
        idBusLine: idBusLine,
        busLineCrossing: eachFeature?.properties?.enlace ?? null,
      },
    };
    features.push(feature);
  });

  let tripCreated = {
    features: features,
    type: trip?.type ?? "",
  };
  return tripCreated;
};

module.exports = {
  parseAndCreateObjectAvanza,
  createObjectHeader,
  parseAndCreateObjectSae,
  parseAndCreateObjectGTFS,
  getProperties
};
