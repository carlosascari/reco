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

/**
* Represents a project database.
*/
class WorkingDatabase extends Database {

  /**
  * @contructor
  * @param {Object} knexConfig
  */
  constructor(knexConfig) {
    super(knexConfig);
    const _ = this._;
  }

  /**
  * Start a single transaction
  * @param {Function} callback
  * @return {Promise}
  */
  transaction(callback) {
    const knexClient = this.knex;
    return new Promise((ok, no) => {
      knexClient.transaction((trx) => {
        callback(
          trx, 
          (v) => { trx.commit();   ok(v); }, 
          (v) => { trx.rollback(); no(v); }
        );
      })
      .then(ok)
      .catch(no);
    });
  }

  ensureClassifier(where, data=where) {
    const knexClient = this.knex;
    return ensureClassifier(knexClient, where, data);
  }

  getSuppliers(where={}) {
    const knexClient = this.knex;
    return getSuppliers(knexClient, where);
  }
}

/**
*
* The following methods 
* are used to build transactions
*
*/


// CREATE

const createClassifier = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('classifiers')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createClient = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('clients')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createConcept = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('concepts')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createInvoice = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('invoices')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createInvoiceToConcept = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('invoices_to_concepts')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createLabel = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('labels')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createLabelToClassifier = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('labels_to_classifiers')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createLabelToConcept = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('labels_to_concepts')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

const createSupplier = (knexClient, data) => {
  return new Promise((ok, no) => {
    knexClient.insert(data)
    .into('suppliers')
    .returning('id')
    .then(results => {
      data.id = results[0];
      ok(data);
    })
    .catch(no);
  });
}

// Ensure

const ensureClassifier = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getClassifier(knexClient, where)
    .then(classifier => {
      if (classifier) return ok(classifier);
      createClassifier(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureClient = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getClient(knexClient, where)
    .then(client => {
      if (client) return ok(client);
      createClient(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureConcept = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getConcept(knexClient, where)
    .then(concept => {
      if (concept) return ok(concept);
      createConcept(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureInvoice = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getInvoice(knexClient, where)
    .then(invoice => {
      if (invoice) return ok(invoice);
      createInvoice(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureInvoiceToConcept = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getInvoiceToConcept(knexClient, where)
    .then(invoiceToConcept => {
      if (invoiceToConcept) return ok(invoiceToConcept);
      createInvoiceToConcept(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureLabel = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getLabel(knexClient, where)
    .then(label => {
      if (label) return ok(label);
      createLabel(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureLabelToConcept = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getLabelToConcept(knexClient, where)
    .then(label => {
      if (label) return ok(label);
      createLabelToConcept(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

const ensureSupplier = (knexClient, where, data=where) => {
  return new Promise((ok, no) => {
    getSupplier(knexClient, where)
    .then(supplier => {
      if (supplier) return ok(supplier);
      createSupplier(knexClient, data)
      .then(ok)
      .catch(no);
    })
    .catch(no);
  }); 
}

// Get one

const getClassifier = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('classifiers')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getClient = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('clients')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getConcept = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('concepts')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getInvoice = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('invoices')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getInvoiceToConcept = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('invoices_to_concepts')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getLabel = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('labels')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getLabelToClassifier = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('labels_to_classifiers')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getLabelToConcept = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('labels_to_concepts')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

const getSupplier = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('suppliers')
    .where(where)
    .limit(1)
    .then(results => ok(results[0]))
    .catch(no);
  }); 
}

// Get many


const getLabelsToConcepts = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('labels_to_concepts')
    .where(where)
    .then(results => ok(results))
    .catch(no);
  }); 
}

const getSuppliers = (knexClient, where) => {
  return new Promise((ok, no) => {
    knexClient.select('*')
    .from('suppliers')
    .where(where)
    .then(results => ok(results))
    .catch(no);
  }); 
}

// Update

const updateClassifier = (knexClient, where, data) => {
  return new Promise((ok, no) => {
    knexClient('classifiers')
    .where(where)
    .update(data)
    .then(ok)
    .catch(no);
  });
}

// Complex

const getUntrainedLabelsForClassifier = (knexClient, classifier_id) => {
  return new Promise((ok, no) => {
    getClassifier(knexClient, { id: classifier_id })
    .then(classifier => {
      const supplier_id = classifier.supplier_id;
      const isScopedClassifier = supplier_id;
      const whereOpts = {};
      if (isScopedClassifier) {
        whereOpts.supplier_id = supplier_id;
      }
      getLabelsToConcepts(knexClient, whereOpts)
      .then(labelsToConcepts => {
        async.filter(
          labelsToConcepts,
          (labelToConcept, next) => {
            const label_id = labelToConcept.label_id;
            getLabelToClassifier(knexClient, { label_id, classifier_id })
            .then((labelToClassifier) => {
              const trained = !!labelToClassifier;
              next(null, !trained);
            })
            .catch(next);
          },
          (error, untrainedLabelsToConcepts) => {
            if (error) return no(error);
            async.map(
              untrainedLabelsToConcepts,
              (untrainedLabelToConcept, next) => {
                const concept_id = untrainedLabelToConcept.concept_id;
                const label_id = untrainedLabelToConcept.label_id;
                getLabel(knexClient, { id: label_id })
                .then(label => {
                  getConcept(knexClient, { id: concept_id })
                  .then(concept => {
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

/**
* Expose transaction-based functions
* @namespace trx
*/
WorkingDatabase.trx = {
  createClassifier,
  createClient,
  createConcept,
  createInvoice,
  createInvoiceToConcept,
  createLabel,
  createLabelToClassifier,
  createLabelToConcept,
  createSupplier,
  ensureClassifier,
  ensureClient,
  ensureConcept,
  ensureInvoice,
  ensureInvoiceToConcept,
  ensureLabel,
  ensureLabelToConcept,
  ensureSupplier,
  getClassifier,
  getClient,
  getConcept,
  getInvoice,
  getInvoiceToConcept,
  getLabel,
  getLabelsToConcepts,
  getLabelToClassifier,
  getLabelToConcept,
  getSupplier,
  getUntrainedLabelsForClassifier,
  updateClassifier,
};

module.exports = WorkingDatabase;