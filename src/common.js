const cloudfrontSaeDomain = process.env.cloudfrontUrlEnvironment;
const cloudfrontUrlSwagger = process.env.cloudfrontUrlSwagger;
const endpoint = process.env.endpoint;
const version = process.env.version;
const region = process.env.region;
const arnFunction = process.env.arnFunction;
const cloudfrontSae = process.env.cloudfrontSae;
const url = process.env.REDIS_URL;
const urlSae = `${cloudfrontSae}/API/v1.0`
const getDetalleLineaSAEUrl = `${cloudfrontSaeDomain}/lineas/getDetalleLinea`;
const mongoServerAddress = process.env.mongoServerAddress;
const mongoDbName = process.env.mongoDbName;
const mongoDbUsername = process.env.mongoDbUsername;
const mongoDbPassword = process.env.mongoDbPassword;

const resources = {
  "Trechos": {
    url:"/Ruta/Trechos",
    httpMethod: "post"
  },
  "Parada": {
    url:"/Parada",
    httpMethod: "get"
  },
  "Ruta": {
    url:"/Ruta",
    httpMethod: "get"
  },
  "Trazado": {
    url:"/Ruta/Trazado",
    httpMethod: "get"
  }
};

const swaggerMarkupBody = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Obtener Detalle Linea</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@3/swagger-ui.css">
            </head>
            <body>
                <div id="swagger"></div>
                <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
                <script>
                  SwaggerUIBundle({
                    dom_id: '#swagger',
                    url: '${cloudfrontUrlSwagger}/ObtenerDetalleLinea/obtenerDetalleLineaSwagger.yaml'
                });
                </script>
            </body>
            </html>`;

module.exports = {
  swaggerMarkupBody,
  getDetalleLineaSAEUrl,
  endpoint,
  version,
  region,
  arnFunction,
  url,
  urlSae,
  resources,
  mongoDbName,
  mongoDbPassword,
  mongoDbUsername,
  mongoServerAddress
};
