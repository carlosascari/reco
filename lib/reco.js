/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* All rights reserved
*/

const crypto = require('crypto');
const onepath = require('onepath')();
const async = require('async');
const Database = onepath.require('~/working_database');
const XmlInvoice = onepath.require('~/xml_invoice');
const Classifier = onepath.require('~/classifier');

const { log } = console;
const { defineProperty } = Object;

// Hash xml in order to uniquely identify it
const hashXml = (s) => crypto.createHash('md5').update(s).digest('hex');

// Default classifier config
const DEFAULT_CLASSIFIER_JSON = (new Classifier()).serialize();

/**
* Train a supplier's classifier.
* @param {WorkingDatabase} db
* @param {String} [supplier_id=null]
*/
const _train = (db, supplier_id=null) => {
  return new Promise((ok, no) => {
    db.getIdCreateIfNotExistClassifier({ supplier_id, json: DEFAULT_CLASSIFIER_JSON })
    .then((classifier_id) => {
      db.getSingleClassifier(supplier_id)
      .then((classifierRow) => {
        const classifier = new Classifier(classifierRow.json);
        db.getUntrainedLabelsForClassifier(classifier_id)
        .then((untrainedLabelPairs) => {
          async.eachSeries(
            untrainedLabelPairs,
            (untrainedLabelPair, next) => {
              const { label, concept } = untrainedLabelPair;
              classifier.label(label.value, concept.value);
              db.createLabelToClassifier({ label_id: label.id, classifier_id })
              .then((id) => {
                next();
              })
              .catch(next);
            },
            (error) => {
              if (error) return no(error);
              classifier.train();
              const json = classifier.serialize();
              db.updateClassifier(classifier_id, { json })
              .then(() => {
                ok();
              })
              .catch(no);
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    })
    .catch(no);
  });
}

// Get database instance, and cache.
const getDb = (instance, config) => {
  return new Promise((ok, no) => {
    if (instance._.db) return ok(instance._.db);
    instance._.db = new Database(config.database);
    instance._.db.latest()
    .then(() => {
      ok(instance._.db);
    })
    .catch(no);
  });
};

/**
* Main module. 
* Communicates with Daemon thought a Client instance.
* @event message
*/
class Reco {

  /**
  * @constructor
  * @todo Handle disconnections
  */
  constructor(recoConfig) {
    const _ = defineProperty(this, '_', { value: {} })._;
    _.config = recoConfig;
  }

  /**
  * @param {String} concept
  * @param {String} [supplierRfc]
  * @return {Promise}
  */
  addConcept(concept, supplierRfc=null) {
    const { config } = this._;
    return new Promise((ok, no) => {
      getDb(this, config)
      .then((db) => {
        // TODO: get supplier if rfc is presnt
        db.getIdCreateIfNotConcept({ description: concept })
        .then(ok).catch(no);
      })
      .catch(no);
    });
  }

  /**
  * @param {String} label
  * @param {String} concept
  * @param {String} [supplierRfc]
  * @return {Promise}
  */
  addLabel(label, concept, supplierRfc=null) {
    const { config } = this._;
    return new Promise((ok, no) => {
      getDb(this, config)
      .then((db) => {
        db.getSingleSupplier(supplierRfc) // BUG: remove hardcode to include supplier rfc.
        .then((supplier) => {
          const supplier_id = supplier ? supplier.id : null;
          db.getIdCreateIfNotExistLabel({ name: label })
          .then((label_id) => {
            db.getIdCreateIfNotExistConcept({ description: concept })
            .then((concept_id) => {
              db.getSingleLabelToConcept(label_id, concept_id)
              .then((lbl_to_con) => {
                if (lbl_to_con) {
                  ok(lbl_to_con.id);
                } else {
                  db.createLabelToConcept({ label_id, concept_id, supplier_id })
                  .then(ok)
                  .catch(no);
                }
              })
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
  * Adds a xml invoice file to database.
  * @param {String} xml
  * @return {Promise}
  */
  addXmlInvoice(xml) {
    const { config } = this._;
    const hash = hashXml(xml);
    return new Promise((ok, no) => {
      XmlInvoice.parseXml(xml)
      .then(xmlInvoice => {
        const { Emisor, Receptor, Conceptos, sello, folio, fecha } = xmlInvoice;
        const date = new Date(fecha);
        const clientRfc = Emisor.rfc.trim();
        const clientName = Emisor.nombre ? Emisor.nombre.trim() : undefined;      
        const supplierRfc = Receptor.rfc.trim();
        const supplierName = Receptor.nombre ? Receptor.nombre.trim() : undefined;
        getDb(this, config)
        .then((db) => {
          db.getIdCreateIfNotExistSupplier({ rfc: supplierRfc, name: supplierName })
          .then((supplier_id) => {
            db.getIdCreateIfNotExistClient({ rfc: clientRfc, name: clientName })
            .then((client_id) => {
              db.getIdCreateIfNotExistInvoice({ client_id, supplier_id, sello, date, xml, hash })
              .then((invoice_id) => {
                async.eachSeries(
                  Conceptos,
                  (concepto, next) => {
                    db.getIdCreateIfNotExistConcept({ description: concepto.descripcion.trim() })
                    .then(concept_id => {
                      db.createInvoiceToConcept(invoice_id, concept_id)
                      .then((invoiceToConcept) => {
                        if (invoiceToConcept) {
                          next(invoiceToConcept.id);
                        } else {
                          db.createInvoiceToConcept({ invoice_id, concept_id })
                          .then((id) => next(null, id))
                          .catch(next);
                        }
                      })
                      .catch(next);
                    })
                    .catch(next);
                  },
                  (error, results) => {
                    if (error) return no(error);
                    ok(invoice_id);
                  }
                );
              })
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
  * Reset project. Erases all data in databse.
  * @param {String} 
  * @return {Promise}
  */
  flush() {
    return new Promise((ok, no) => {
      ok();
    });
  }

  /**
  * Train project. Trains a general classifier as well
  * as supplier-scoped classsifers.
  * @return {Promise}
  */
  train() {
    const { config } = this._;
    return new Promise((ok, no) => {
      getDb(this, config)
      .then((db) => {
        db.getSuppliers()
        .then((suppliers) => {
          async.eachSeries(
            suppliers,
            (supplier, next) => {
              _train(db, supplier.id)
              .then(next)
              .catch(next);
            },
            (error) => {
              if (error) return no(error);
              _train(db)
              .then(ok)
              .catch(no);
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    });
  }

  /**
  * @param {String} input
  * @param {String} [supplierRfc]
  * @return {Promise}
  */
  test(input, supplierRfc) {
    const { config } = this._;
    return new Promise((ok, no) => {
      getDb(this, config)
      .then((db) => {
        db.getSuppliers()
        .then((suppliers) => {
          async.mapSeries(
            suppliers,
            (supplier, next) => {
              db.getSingleClassifier(supplier.id)
              .then((classifierRow) => {
                const classifier = new Classifier(classifierRow.json);
                const classification = classifier.classify(input);
                next(null, {
                  supplier_id: supplier.id,
                  classification
                });
              })
              .catch(next);
            },
            (error, testResults) => {
              if (error) return no(error);
              db.getSingleClassifier(null)
              .then((classifierRow) => {
                const classifier = new Classifier(classifierRow.json);
                const classification = classifier.classify(input);
                classification.suppliers = testResults.map(x => x.classification);
                ok(classification);
              })
              .catch(no);
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    });
  }
}

module.exports = Reco;