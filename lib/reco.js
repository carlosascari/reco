/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* MIT License
*/

const crypto = require('crypto');
const onepath = require('onepath')();
const async = require('async');
const WorkingDatabase = onepath.require('~/working_database');
const XmlInvoice = onepath.require('~/xml_invoice');
const Classifier = onepath.require('~/classifier');

const { defineProperty } = Object;
const {
  createLabelToClassifier,
  ensureClassifier,
  ensureClient,
  ensureConcept,
  ensureInvoice,
  ensureInvoiceToConcept,
  ensureLabel,
  ensureLabelToConcept,
  ensureSupplier,
  getSupplier,
  getUntrainedLabelsForClassifier,
  updateClassifier,
} = WorkingDatabase.trx;

// Hash xml in order to uniquely identify it
const hashXml = (s) => crypto.createHash('md5').update(s).digest('hex');

// Default classifier config, used when inserting into classifiers table.
const DEFAULT_CLASSIFIER_JSON = (new Classifier()).serialize();
/**
* Train a classifier.
* @param {Reco} instance
* @param {WorkingDatabase} db
* @param {String} [supplier_id=null]
* @return {Promise}
*/
const _train = (instance, db, supplier_id=null) => {
  return new Promise((ok, no) => {
    db[instance._.transactionMethod]((trx, ok, no) => {
      ensureClassifier(trx, { supplier_id }, { supplier_id, json: DEFAULT_CLASSIFIER_JSON })
      .then(classifierRow => {
        const classifier_id = classifierRow.id;
        const classifier = new Classifier(classifierRow.json);
        getUntrainedLabelsForClassifier(trx, classifier_id)
        .then(untrainedLabelPairs => {
          if (untrainedLabelPairs.length === 0) return ok();
          async[instance._.eachMethod](
            untrainedLabelPairs,
            (untrainedLabelPair, next) => {
              const { label, concept } = untrainedLabelPair;
              classifier.label(label.value, concept.value);
              createLabelToClassifier(trx, { label_id: label.id, classifier_id })
              .then(labelToClassifier => next())
              .catch(next);
            },
            (error) => {
              if (error) return no(error);
              classifier.train();
              const json = classifier.serialize();
              updateClassifier(trx, { id: classifier_id }, { json })
              .then(() => ok())
              .catch(no);
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    })
    .then(ok)
    .catch(no);
  });
}

/**
* Retrives database instance, if it does not exists
* it is created and migrated to latest schema.
* @param {Reco} instnace
* @return {Promise}
*/
const getDb = (instance) => {
  const config = instance._.config;
  return new Promise((ok, no) => {
    if (instance._.db) return ok(instance._.db);
    instance._.db = new WorkingDatabase(config.database);
    instance._.db.latest()
    .then(() => {
      ok(instance._.db);
    })
    .catch(no);
  });
};

/**
* Recognition trainer and db manager.
*/
class Reco {

  /**
  * @constructor
  * @param {Object} config
  */
  constructor(config) {
    const _ = defineProperty(this, '_', { value: {} })._;
    _.config = config;

    // BUGFIX: sqlite3 fails when using transactions.
    _.transactionMethod = 'transaction';
    _.eachMethod = 'each';
    _.mapMethod = 'map';
    if (config.database.client.indexOf('sqlite') === 0) {
      _.transactionMethod = 'clousure';
      _.eachMethod = 'eachSeries';
      _.mapMethod = 'mapSeries';
    }
  }

  /**
  * @param {String} label
  * @param {String} concept
  * @param {String} [supplierRfc]
  * @return {Promise}
  */
  addLabel(label, concept, rfc=null) {
    return new Promise((ok, no) => {
      getDb(this)
      .then(db => {
        db['transaction']((trx, ok, no) => {
          getSupplier(trx, { rfc })
          .then(supplier => {
            const supplier_id = supplier ? supplier.id : null;
            if (rfc && !supplier_id) return no(new Error('Invalid supplier rfc'));
            ensureLabel(trx, { name: label })
            .then(label => {
              const label_id = label.id;
              ensureConcept(trx, { description: concept })
              .then(concept => {
                const concept_id = concept.id;
                ensureLabelToConcept(trx, { label_id, concept_id, supplier_id })
                .then(labelToConcept => ok())
                .catch(no);
              })
              .catch(no);
            })
            .catch(no);
          })
          .catch(no);
        })
        .then(ok)
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
        getDb(this)
        .then((db) => {
          db[this._.transactionMethod]((trx, ok, no) => {
            ensureSupplier(trx, { rfc: supplierRfc }, { rfc: supplierRfc, name: supplierName })
            .then((supplier) => {
              const supplier_id = supplier.id;
              ensureClient(trx, { rfc: clientRfc }, { rfc: clientRfc, name: clientName })
              .then((client) => {
                const client_id = client.id;
                ensureInvoice(trx, { sello }, { client_id, supplier_id, sello, date, xml, hash })
                .then((invoice) => {
                  const invoice_id = invoice.id;
                  async.eachSeries(
                    Conceptos,
                    (concepto, next) => {
                      const description = concepto.descripcion.trim();
                      ensureConcept(trx, { description })
                      .then(concept => {
                        const concept_id = concept.id;
                        ensureInvoiceToConcept(trx, { invoice_id, concept_id })
                        .then((invoiceToConcept) => {
                          next();
                        })
                        .catch(next);
                      })
                      .catch(next);
                    },
                    (error) => {
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
          .then(ok)
          .catch(no);
        })
        .catch(no);
      })
      .catch(no);
    });
  }

  /**
  * Train project. Trains a general classifier as well
  * as supplier-scoped classsifers.
  * @return {Promise}
  */
  train() {
    return new Promise((ok, no) => {
      getDb(this)
      .then((db) => {
        db.getSuppliers()
        .then((suppliers) => {
          async.eachSeries(
            suppliers,
            (supplier, next) => {
              // Train scoped classifiers
              _train(this, db, supplier.id).then(next).catch(next);
            },
            (error) => {
              if (error) return no(error);
              // Train general classifier
              _train(this, db).then(ok).catch(no);
            }
          );
        })
        .catch(no);
      })
      .catch(no);
    });
  }

  /**
  * @param {String} input Concept string to test.
  * @param {String} [rfc] Scope test to a supplier.
  * @return {Promise}
  */
  test(input, rfc) {
    return new Promise((ok, no) => {
      getDb(this)
      .then((db) => {
        db.getSuppliers()
        .then(suppliers => {
          async[this._.mapMethod](
            suppliers,
            (supplier, next) => {
              const supplier_id = supplier.id;
              const supplier_rfc = supplier.rfc;
              db.ensureClassifier({ supplier_id }, { supplier_id, json: DEFAULT_CLASSIFIER_JSON })
              .then(classifierRow => {
                const classifier = new Classifier(classifierRow.json);
                const classification = classifier.trained ? classifier.classify(input) : { classifications: [] };
                next(null, { supplier_id, classification, supplier_rfc });
              })
              .catch(next);
            },
            (error, testResults) => {
              if (error) return no(error);
              if (rfc) {
                for (let i = 0, l = testResults.length; i < l; i++) {
                  if (testResults[i].supplier_rfc === rfc) {
                    testResults[i].classification.classifications = testResults[i].classification.classifications.map(x => {
                      x.value *= 10;
                      return x;
                    });
                    break;
                  }
                }
              }
              db.ensureClassifier({ supplier_id: null }, { supplier_id: null, json: DEFAULT_CLASSIFIER_JSON })
              .then(classifierRow => {
                const MAX_SAMPLES = 200; // Only consider top 200 classifications.
                const stats = {};
                const classifier = new Classifier(classifierRow.json);
                if (!classifier.trained) return no(new Error('classifier not trained'));
                const classification = classifier.classify(input);
                classification.classifications = classification.classifications.slice(0, MAX_SAMPLES);
                stats.general = classification;
                stats.suppliers = testResults.map(x => {
                  const c = x.classification;
                  c.classifications = c.classifications.slice(0, MAX_SAMPLES);
                  return c;
                });

                // Merge classifcations from all supplier classifiers
                // + Points for scoped classifications, since we are saying 
                //   the test is with a particular supplier in mind.
                // + Points for reapeated or matching classification values.
                //   In other words, two separate suppliers identified the same
                //   concept with the same label, so bonus points.
                // + When classifcations values do not match between suppliers
                //   the score is merged.
                const conceptMashup = {};

                stats.general.classifications.forEach(classification => {
                  const { label, value } = classification;
                  conceptMashup[label] = value;
                })

                stats.suppliers.forEach(supplierResult => {
                  supplierResult.classifications.forEach(classification => {
                    const { label, value } = classification;
                    if (!conceptMashup[label]) {
                      conceptMashup[label] = value;
                    } else {
                      if (value === conceptMashup[label]) {
                        // Same score add 1%
                        conceptMashup[label] *= 1.01; // BONUS 
                      } else {
                        if (conceptMashup[label] < value) {
                          // Greater score, mix score and raise 5%
                          conceptMashup[label] = (conceptMashup[label] + value) / 2;
                          conceptMashup[label] *= 1.05; // Growing/Trusting Direction
                        } else {
                          // Lower score, mix score and lower 5%
                          conceptMashup[label] = (conceptMashup[label] + value) / 2;
                          conceptMashup[label] *= 0.95; // Shrinking/Doubting Direction
                        }
                      }
                    }
                  });
                });
                const uniqueConcepts = Object.keys(conceptMashup);
                stats.mashup = uniqueConcepts.sort((a, b) => conceptMashup[b] - conceptMashup[a]).map(label => {
                  const value = conceptMashup[label];
                  return { label, value }
                });
                ok(stats);
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