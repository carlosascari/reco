/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* All rights reserved
*/

const fs = require('fs-extra');
const knex = require('knex');
const async = require('async');
const onepath = require('onepath')();
const Database = onepath.require('~/database');

const { defineProperty } = Object;

const ucase = (s) => s.toUpperCase();
const trim = (s) => s.trim();

/**
* Light wrapper around knex.
*/
class WorkingDatabase extends Database {
  constructor(knexConfig) {
    super(knexConfig);
    const _ = this._;
  }

  /**
  * @param {XmlInvoiceFile} xmlInvoiceFile
  * @return {Promise}
  */
  xmlFileExists(xmlInvoiceFile) {
    const { hash } = xmlInvoiceFile;
    return this.existsXmlFile(hash);
  }

  /**
  * @param {XmlInvoice} xmlInvoice
  * @param {XmlInvoiceFile} xmlInvoiceFile
  * @return {Promise}
  */
  addXmlInvoice(xmlInvoice, xmlInvoiceFile) {
    const { hash, xml } = xmlInvoiceFile;
    const { Emisor, Receptor, Conceptos, sello, folio, fecha } = xmlInvoice;
    const date = new Date(fecha);
    const clientRfc = Emisor.rfc.trim();
    const clientName = Emisor.nombre ? Emisor.nombre.trim() : undefined;      
    const supplierRfc = Receptor.rfc.trim();
    const supplierName = Receptor.nombre ? Receptor.nombre.trim() : undefined;
    return new Promise((ok, no) => {
      this.getIdCreateIfNotExistSupplier({ rfc: supplierRfc, name: supplierName })
      .then((supplier_id) => {
        // console.log('supplier_id:', supplier_id);
        this.getIdCreateIfNotExistClient({ rfc: clientRfc, name: clientName })
        .then((client_id) => {
          // console.log('client_id:', client_id);
          this.getIdCreateIfNotExistInvoice({ client_id, supplier_id, folio, sello, date })
          .then((invoice_id) => {
            // console.log('invoice_id:', invoice_id);
            this.getIdCreateIfNotExistXmlFile({ invoice_id, xml, hash })
            .then((xml_file_id) => {
              // console.log('xml_file_id:', xml_file_id);
              Promise.all(
                Conceptos.map(concepto => {
                  return new Promise((ok, no) => {
                    this.getIdCreateIfNotConcept({ invoice_id, description: concepto.descripcion.trim() })
                    .then(ok)
                    .catch(no)
                  });
                })
              )
              .then((concept_ids) => ok({
                supplier_id, 
                client_id, 
                invoice_id, 
                xml_file_id, 
                concept_ids
              }))
              .catch(no);
            })
            .catch(no);
          })
          .catch(no);
        })
        .catch(no);
      })
      .catch(no);
    });
  }

  /**
  *
  * @return {Promise}
  */
  getUntrainedLabelsForClassifier(classifier_id) {
    return new Promise((ok, no) => {
      this.getSingleGeneric('classifiers', { id: classifier_id })
      .then((classifier) => {
        const supplier_id = classifier.supplier_id;
        const isGeneralPurposeClassifier = supplier_id === null;
        const whereOpts = {};
        if (!isGeneralPurposeClassifier) {
          whereOpts.supplier_id = supplier_id;
        }
        // console.log('>>>', 'supplier_id', supplier_id);
        // console.log('>>>', 'whereOpts', whereOpts);
        this.getMultiGeneric('labels_to_concepts', whereOpts) // for specific supplier (null is general purpose)
        .then((labelsToConcepts) => {
          async.filterSeries(
            labelsToConcepts,
            (labelToConcept, next) => {
              const label_id = labelToConcept.label_id;
              this.getSingleLabelToClassifier(label_id, classifier_id)
              .then((labelToClassifier) => {
                const trained = !!labelToClassifier;
                next(null, !trained);
              })
              .catch(next);
            },
            (error, untrainedLabelsToConcepts) => {
              if (error) return no(error);
              async.mapSeries(
                untrainedLabelsToConcepts,
                (untrainedLabelToConcept, next) => {
                  const concept_id = untrainedLabelToConcept.concept_id;
                  const label_id = untrainedLabelToConcept.label_id;
                  this.getSingleGeneric('labels', { id: label_id })
                  .then((label) => {
                    this.getSingleGeneric('concepts', { id: concept_id })
                    .then((concept) => {
                      const pair = {
                        label: { id: label.id, value: label.name },
                        concept: { id: concept.id, value: concept.description }
                      };
                      next(null, pair);
                    })
                    .catch(next);
                  })
                  .catch(next);
                },
                (error, labelAndConceptPairs) => {
                  if (error) return no(error);
                  ok(labelAndConceptPairs);
                }
              );
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    });
  }

  //
  // Create if not Exists, Return Id
  //

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistGeneric(className, createData, uniqueField) {
    const existsMethod = this[`exists${ className }`].bind(this);
    const createMethod = this[`create${ className }`].bind(this);
    const getSingleMethod = this[`getSingle${ className }`].bind(this);
    return new Promise((ok, no) => {
      existsMethod(createData[uniqueField])
      .then((exists) => {
        if (!exists) {
          createMethod(createData).then(ok).catch(no);
        } else {
          getSingleMethod(createData[uniqueField])
          .then((model) => ok(model.id))
          .catch(no);
        }
      })
      .catch(no);
    });    
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistSupplier({ rfc, name }) {
    return this.getIdCreateIfNotExistGeneric('Supplier', { rfc, name }, 'rfc');
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistClient({ rfc, name }) {
    return this.getIdCreateIfNotExistGeneric('Client', { rfc, name }, 'rfc');
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistInvoice({ client_id, supplier_id, sello, date }) {
    return this.getIdCreateIfNotExistGeneric('Invoice', { client_id, supplier_id, sello, date }, 'sello');
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistConcept({ description }) {
    return this.getIdCreateIfNotExistGeneric('Concept', { description }, 'description');
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistLabel({ name }) {
    return this.getIdCreateIfNotExistGeneric('Label', { name }, 'name');
  }

  /**
  *
  * @return {Promise}
  */
  getIdCreateIfNotExistClassifier({ json, supplier_id=null }) {
    return new Promise((ok, no) => {
      this.getSingleClassifier(supplier_id)
      .then((classifier) => {
        if (classifier) return ok(classifier.id);
        this.createClassifier({ json, supplier_id })
        .then(ok)
        .catch(no);
      })
      .catch(no);
    });
  }

  //
  // Get Single
  //

  /**
  *
  * @return {Promise}
  */
  getSingleGeneric(from, where) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient.select('*')
      .from(from)
      .where(where)
      .limit(1)
      .then((results) => ok(results[0] || null))
      .catch(no);
    });    
  }

  /**
  *
  * @return {Promise}
  */
  getSingleSupplier(rfc) { return this.getSingleGeneric('suppliers', { rfc }); }

  /**
  *
  * @return {Promise}
  */
  getSingleClient(rfc) { return this.getSingleGeneric('clients', { rfc }); }

  /**
  *
  * @return {Promise}
  */
  getSingleInvoice(sello) { return this.getSingleGeneric('invoices', { sello }); }

  /**
  *
  * @return {Promise}
  */
  getSingleConcept(description) { return this.getSingleGeneric('concepts', { description }); }

  /**
  *
  * @return {Promise}
  */
  getSingleLabel(name) { return this.getSingleGeneric('labels', { name }); }

  /**
  *
  * @return {Promise}
  */
  getSingleLabelToConcept(label_id, concept_id) { return this.getSingleGeneric('labels_to_concepts', { label_id, concept_id }); }

  /**
  *
  * @return {Promise}
  */
  getSingleClassifier(supplier_id) { return this.getSingleGeneric('classifiers', { supplier_id }); }

  /**
  *
  * @return {Promise}
  */
  getSingleLabelToClassifier(label_id, classifier_id) { return this.getSingleGeneric('labels_to_classifiers', { label_id, classifier_id }); }

  //
  // Get Multi
  //

  /**
  *
  * @return {Promise}
  */
  getMultiGeneric(from, where) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient.select('*')
      .from(from)
      .where(where)
      .then((results) => ok(results))
      .catch(no);
    });    
  }

  /**
  *
  * @return {Promise}
  */
  getSuppliers() { return this.getMultiGeneric('suppliers', {  }); }

  //
  // Update
  //

  /**
  *
  * @return {Promise}
  */
  updateClassifier(classifier_id, data) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient('classifiers')
      .where('id', classifier_id)
      .update(data)
      .then(ok)
      .catch(no);
    });
  }

  //
  // Exists
  //

  /**
  *
  * @return {Promise}
  */
  existsGeneric(from, where) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient.select('*')
      .from(from)
      .where(where)
      .limit(1)
      .then((results) => ok(results.length))
      .catch(no);
    });
  }

  /**
  *
  * @return {Promise}
  */
  existsSupplier(rfc) { return this.existsGeneric('suppliers', { rfc }); }

  /**
  *
  * @return {Promise}
  */
  existsClient(rfc) { return this.existsGeneric('clients', { rfc }); }

  /**
  *
  * @return {Promise}
  */
  existsConcept(description) { return this.existsGeneric('concepts', { description }); }

  /**
  *
  * @return {Promise}
  */
  existsInvoice(sello) { return this.existsGeneric('invoices', { sello }); }

  /**
  *
  * @return {Promise}
  */
  existsLabel(name) { return this.existsGeneric('labels', { name }); }

  /**
  *
  * @return {Promise}
  */
  existsLabelToConcept(label_id, concept_id) { return this.existsGeneric('labels_to_concepts', { label_id, concept_id }); }
  
  //
  // Create
  //

  /**
  *
  * @return {Promise}
  */
  createGeneric(into, data) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient.insert(data)
      .into(into)
      .returning('id')
      .then((results) => ok(results[0]))
      .catch(no);
    }); 
  }

  /**
  *
  * @return {Promise}
  */
  createLabel({ name }) { return this.createGeneric('labels', { name }); }

  /**
  *
  * @return {Promise}
  */
  createSupplier({ rfc, name }) { return this.createGeneric('suppliers', { rfc, name }); }

  /**
  *
  * @return {Promise}
  */
  createClient({ rfc, name }) { return this.createGeneric('clients', { rfc, name }); }

  /**
  *
  * @return {Promise}
  */
  createInvoice({ client_id, supplier_id, date, sello }) { return this.createGeneric('invoices', { client_id, supplier_id, date, sello }); }

  /**
  *
  * @return {Promise}
  */
  createConcept({ description }) { return this.createGeneric('concepts', { description }); }

  /**
  *
  * @return {Promise}
  */
  createLabelToConcept({ label_id, concept_id, supplier_id }) { return this.createGeneric('labels_to_concepts', { label_id, concept_id, supplier_id }); }

  /**
  *
  * @return {Promise}
  */
  createInvoiceToConcept({ invoice_id, concept_id }) { return this.createGeneric('invoices_to_concepts', { invoice_id, concept_id }); }

  /**
  *
  * @return {Promise}
  */
  createClassifier({ json, supplier_id }) { return this.createGeneric('classifiers', { json, supplier_id }); }

  /**
  *
  * @return {Promise}
  */
  createLabelToClassifier({ label_id, classifier_id }) { return this.createGeneric('labels_to_classifiers', { label_id, classifier_id }); }
}

module.exports = WorkingDatabase;