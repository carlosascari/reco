#!/usr/bin/env node

/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* All rights reserved
*/

const fs = require('fs-extra');
const async = require('async');
const minimist = require('minimist');
const chalk = require('chalk');
const onepath = require('onepath')();
const Reco = require('..');

const { resolve, sep } = onepath;
const { argv, exit, stdout } = process;
const { log } = console;
const { defineProperty } = Object;

const read = (path) => fs.readFileSync(path, { encoding: 'utf8' });
const write = (path, value) => fs.writeFileSync(path, value);
const exists = (path) => { try { fs.statSync(path); return true; } catch(x) { return false; } };
const isFile = (path) => exists(path) ? fs.statSync(path).isFile() : false;
const isDir = (path) => exists(path) ? fs.statSync(path).isDirectory() : false;
const readdir = (path) => fs.readdirSync(path);
const trim = (s) => s ? s.trim() : '';

const help = read(onepath('~/help.txt'));
const manual = read(onepath('~/manual.txt'));

// Configuration created with `reco init`
const STUB_CONFIG = {
  version: Reco.version,
  database: {
    client: 'sqlite3',
    connection: {
      filename: `.${ sep }database${ sep }database.sqlite`
    },
    migrations: {
      tableName: 'migrations',
      directory: `.${ sep }database${ sep }migrations`,
      stub: `.${ sep }database${ sep }stub.migration.js`
    },
    seeds: {
      directory: `.${ sep }database${ sep }seeds`,
    },
    useNullAsDefault: true,
  },
};

const DEFAULT_DELIM = ':';

// Available commands
const AVAIL_CMDS = ['init', 'create', 'xml', 'xmls', 'label', 'labels', 'train', 'test', 'man'];

/**
* Command-line interface
*/
class Cli {

  /**
  * @contructor
  * @param {Array<String>} [args=process.argv.slice(2)]
  */
  constructor(args=argv.slice(2)) {
    const _ = defineProperty(this, '_', { value: {} })._;
    _.args = minimist(args);
    _.commands = _.args._;
    _.configPath = resolve('./reco.json');

    if (!_.commands.length) {
      this.clearScreen();
      this.printHelp();
      exit();
    }

    const command = _.commands[0];
    if (AVAIL_CMDS.indexOf(command) === -1) {
      log('Invalid command:', command);
      exit();
    }

    if (command === 'man') {
      this.printManual();
      exit();
    }

    if (command === 'init') {
      this.createConfigFile();
      log('Created ./reco.json.');
      exit();
    }

    this.getConfig();

    if (!_.config) {
      log('./reco.json is Missing. run: reco init');
      exit();
    }
    
    // Options
    const delim = _.args.delim === true ? DEFAULT_DELIM : _.args.delim;
    const verbose = +_.args.v;
    const rfc =  _.args.rfc;
    let progessCounter = 0;

    // Reco instance
    const reco = new Reco(_.config);

    _.eachMethod = 'each';
    if (_.config.database.client.indexOf('sqlite') === 0) {
      _.eachMethod = 'eachSeries';
    }

    switch(command) {
      case 'create':
        this.createProject();
        log('Project created.');
        exit();
      break;
      case 'xml':
        const xmlPath = _.commands.slice(1).join(' ');
        if (!exists(xmlPath)) return log('File not found: "%s".', xmlPath);
        if (!isFile(xmlPath)) return log('Not a file.');
        reco.addXmlInvoice(read(xmlPath))
        .then((id) => {
          log('Invoice stored.');
          if (verbose) {
            log('Database id: %s', id);
          }
          exit();
        })
        .catch(error => {
          log(error);
          exit();
        });
      break;
      case 'xmls':
        const xmls = [];
        const xmlDir = _.commands.slice(1).join(' ');
        if (!exists(xmlDir)) return log('Folder not found: "%s"', xmlDir);
        if (!isDir(xmlDir)) return log('Not a folder.');
        readdir(xmlDir)
        .map(path => resolve(xmlDir, path))
        .filter(isFile)
        .map(read)
        .forEach(path => xmls.push(path));
        async.eachSeries(
          xmls,
          (xml, next) => {
            if (verbose) {
              progessCounter++
              log('Progress: %s%', ((progessCounter/xmls.length)*100).toFixed(2))
            }
            reco.addXmlInvoice(xml)
            .then(() => next())
            .catch(next);
          },
          (error) => {
            if (error) return log(error);
            log('Invoices stored.');
            exit();
          }
        );
      break;
      case 'label':
        const lbl = trim(_.commands[1]);
        const con = trim(_.commands[2]);
        if (!lbl) return log('You must specify a label.');
        if (!con) return log('You must specify a concept.');
        reco.addLabel(lbl, con, rfc)
        .then((id) => {
          log('Label stored.');
          if (verbose) {
            log('');
            log('Database id: %s', id)
          }
          exit();
        })
        .catch(error => {
          log(error);
          exit();
        });
      break;
      case 'labels':
        const lblsPath = _.commands.slice(1).join(' ');
        if (!exists(lblsPath)) return log('File not found: "%s".', lblsPath);
        if (!isFile(lblsPath)) return log('Not a file.');
        const file = read(lblsPath);
        const lines = file.split('\n').filter(trim);
        let list = lines;
        if (delim) {
          list = lines.map(line => line.split(delim));
        } else {
          list = lines.map(line => [line, line]);
        }
        async[_.eachMethod](
          list,
          (pair, next) => {
            const lbl = trim(pair[0]);
            const con = trim(pair[1]);
            reco.addLabel(lbl, con, rfc)
            .then(() => {
              if (verbose) {
                progessCounter++;
                log('Label stored: (%s%) %s', ((progessCounter/list.length)*100).toFixed(2), lbl);
              }
              next();
            })
            .catch(next);
          },
          (error) => {
            if (error) return log(error);
            log('Labels stored.');
            exit();
          }
        );
      break;
      case 'train':
        reco.train()
        .then(() => {
          log('Training complete.');
          exit();
        })
        .catch(log);
      break;
      case 'test':
        const test = _.commands.slice(1).join(' ');
        if (!test) return log('You must specify a concept to test.');
        reco.test(test, rfc)
        .then(stats => {
          const result = stats.mashup;
          result.label = result[0].label;
          log(result.label);
          if (verbose) {
            const sliceAmount = verbose === 1 ? 10: verbose;
            const maxLabelSize = Math.max.apply(Math, result.slice(0, sliceAmount).map(x => x.label.length));
            log('');
            log('Classifications');
            log('---------------');
            log(result.slice(0, sliceAmount).map(x => {
              const { label, value } = x;
              const pad = Array(maxLabelSize - label.length).fill(' ').join('');
              return `${ label }  ${ pad }  ${ (value * 100).toFixed(2) }%`;
            }).join('\n'));
            log('');
          }
          exit();
        })
        .catch(error => {
          if (error.message === 'classifier not trained') {
            log('Classifier has not been trained.')
          } else {
            log(error);
          }
          exit();
        });
      break;
      default:
        this.printHelp();
        log('');
        log('Invalid command:', command);
        exit();
    }
  }

  /**
  * Clear console screen.
  */
  clearScreen() {
    stdout.write('\u001b[2J\u001b[0;0H');
  }

  /**
  * Create a reco configuration file in cwd.
  */
  createConfigFile() {
    const { _ } = this;
    const json = JSON.stringify(STUB_CONFIG, null, 4);
    write(_.configPath, `${ json }\n`);
  }

  /**
  * Create new project based on contents of ./reco.json
  */
  createProject() {
    const { config } = this._;
    if (config.database.migrations) {
      fs.ensureDirSync(resolve(config.database.migrations.directory));  
      fs.copySync(
        onepath('~/../lib/stub.migration.js'), 
        resolve(`${ config.database.migrations.directory }${ sep }0.js`)
      );
      if (config.database.migrations.stub) {
        fs.copySync(
          onepath('~/../lib/stub.migration.js'),
          resolve(config.database.migrations.stub)
        );
      }
    }
    if (config.database.seeds) {
      fs.ensureDirSync(resolve(config.database.seeds.directory));  
    }
  }

  /**
  * Get ./reco.json file.
  */
  getConfig() {
    const { _ } = this;
    let configFile;

    try {
      configFile = read(_.configPath);
    } catch(ex) {
      if (ex.code === 'ENOENT') {
        log('Configuration missing. run `reco init`.')
      } else {
        log(ex);
      }
      exit();
    }

    try {
      _.config = JSON.parse(configFile);
    } catch(ex) {
      log('Invalid configuration file (./reco.json). Could not parse JSON.');
      exit();
    }

    try {
      const database = _.config.database;
      if (!database) {
        log('Invalid configuration file (./reco.json). `database` property is missing.');
        exit();
      } 
      const { connection, migrations, seeds, client } = database;
      if (!client) {
        log('Invalid configuration file (./reco.json). `database.client` property is missing.');
        exit();
      } 
      if (connection && connection.filename) connection.filename = resolve(connection.filename);
      if (migrations && migrations.directory) migrations.directory = resolve(migrations.directory);
      if (migrations && migrations.stub) migrations.stub = resolve(migrations.stub);
      if (seeds && seeds.directory) seeds.directory = resolve(seeds.directory);
    } catch(ex) {
      log(ex);
      exit();
    }
  }

  /**
  * Print basic usage information.
  */
  printHelp() {
    stdout.write(help);
  }

  /**
  * Print full help information.
  */
  printManual() {
    stdout.write(manual);
  }
}

/**
* Start command line interface.
*/
new Cli();