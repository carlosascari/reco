/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* MIT License
*/

const xml2js = require('xml2js');

const { defineProperty } = Object;

// xml2js parser options
const xmlParseOptions = {
  explicitArray: false, 
  mergeAttrs: true,
  tagNameProcessors: [
    (name) => name.split(/cfdi:|tfd:/).filter(x => x)[0],
  ]
};

/**
* Represets a SAT electroinc invoice
*/
class XmlInvoice {
  constructor(parsedXmlObject) {
    const _ = defineProperty(this, '_', { value: {} })._;
    _.data = parsedXmlObject;
    _.Comprobante = _.data['Comprobante'];
  }
  get certificado()         { return this._.Comprobante.certificado; }
  get condicionesDePago()   { return this._.Comprobante.condicionesDePago; }
  get fecha()               { return this._.Comprobante.fecha; }
  get folio()               { return this._.Comprobante.folio; }
  get formaDePago()         { return this._.Comprobante.formaDePago; }
  get LugarExpedicion()     { return this._.Comprobante.LugarExpedicion; }
  get metodoDePago()        { return this._.Comprobante.metodoDePago; }
  get Moneda()              { return this._.Comprobante.Moneda; }
  get noCertificado()       { return this._.Comprobante.noCertificado; }
  get sello()               { return this._.Comprobante.sello; }
  get serie()               { return this._.Comprobante.serie; }
  get subTotal()            { return this._.Comprobante.subTotal; }
  get TipoCambio()          { return this._.Comprobante.TipoCambio; }
  get tipoDeComprobante()   { return this._.Comprobante.tipoDeComprobante; }
  get total()               { return this._.Comprobante.total; }
  get version()             { return this._.Comprobante.version; }
  get Complemento()         { return this._.Comprobante.Complemento; }
  get Conceptos()           { 
    if (Array.isArray(this._.Comprobante.Conceptos)) {
      throw new Error('Not Implemented')
    } else {
      if (Array.isArray(this._.Comprobante.Conceptos.Concepto)) {
        return this._.Comprobante.Conceptos.Concepto;
      } else {
        return [this._.Comprobante.Conceptos.Concepto];
      }
    }
  }
  get Emisor()              { return this._.Comprobante.Emisor; }
  get Impuestos()           { return this._.Comprobante.Impuestos; }
  get Receptor()            { return this._.Comprobante.Receptor; }
}

/**
* @param {String} xmlString
* @return {Promise}
*/
XmlInvoice.parseXml = (xmlString) => {
  return new Promise((ok, no) => {
    xml2js.parseString(xmlString, xmlParseOptions, (error, parsedXmlObject) => {
      if (error) return no(error);
      ok(new XmlInvoice(parsedXmlObject));
    });
  });
};

module.exports = XmlInvoice;
