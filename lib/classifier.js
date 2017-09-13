/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* MIT License
*/

const { EventEmitter } = require('events');
const natural = require('natural');
const PorterStemmerEs = require('../node_modules/natural/lib/natural/stemmers/porter_stemmer_es');

const { defineProperty } = Object;

/**
* @param {Classifier} classifer
*/
const listenToTraining = (classifier) => {
  if (classifier._.listening) return;
  classifier._.listening = true;

}

/**
* Wrapper around natural.BayesClassifier w/PorterStemmerEs
*/
class Classifier extends EventEmitter {

  /**
  * @contructor
  * @param {Object} 
  */
  constructor(json) {
    super();
    const _ = defineProperty(this, '_', { value: {} })._;
    if (json) {
      this.parse(json);
    } else {
      _.classifier = new natural.BayesClassifier(PorterStemmerEs);
    }
    // Listen to training
    _.classifier.events.on('trainedWithDocument',  ({ total, index }) => {
      console.log('[Training] index: %s, total: %s (%s%)', index, total, ((index/total)*100).toFixed(2));
      // classifer.emit('training', index, total);
    });
  }

  get trained() { return !!(this._.classifier.docs.length);  }

  /**
  * @param {String} input
  * @return {Object}
  */
  classify(input) {
    return {
      label: this._.classifier.classify(input),
      classifications: this._.classifier.getClassifications(input)
    }
  }

  /**
  * @param {String} input
  * @param {String} input
  */
  label(label, input) {
    this._.classifier.addDocument(input, label);
  }

  /**
  * @param {String} input
  * @return {Object}
  */
  train() {
    this._.classifier.train();
  }

  /**
  * @return {String}
  */
  serialize() {
    const json = JSON.stringify(this._.classifier);
    return json;
  }

  /**
  * @param {String} json
  */
  parse(json) {
    const memory = JSON.parse(json);
    this._.classifier = natural.BayesClassifier.restore(memory);
  }
}

module.exports = Classifier;