var expect = require("chai").expect;
var parser = require("../../src/parser");
var {testModel} = require("../models/GetPropertiesModel");


before(function () {
    console.log = function () {};
});

after(function () {
    delete console.log;
});

describe("Validando la correcta creacion de properties", function(){
        it("Valida que regrese una lista", function(){
            result = parser.getProperties(testModel.Paradas,testModel.Trechos,testModel.Ruta);
            expect(result).to.be.an('array');
        });

        it("Valida que regrese una lista de 10 elementos", function(){
            result = parser.getProperties(testModel.Paradas,testModel.Trechos,testModel.Ruta);
            expect(result).to.be.an('array').to.have.lengthOf(10);
        });
});