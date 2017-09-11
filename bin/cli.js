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

const { resolve } = onepath;
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
      filename: './database/database.sqlite'
    },
    migrations: {
      tableName: 'migrations',
      directory: './database/migrations',
      stub: './database/stub.migration.js'
    },
    seeds: {
      directory: './database/seeds',
    },
    useNullAsDefault: true,
  },
};

const DEFAULT_DELIM = ':';

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

    if (_.commands[0] === 'init') {
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

    // Reco instance
    const reco = new Reco(_.config);

    switch(_.commands[0]) {
      case 'man':
      this.printManual();
      exit();
      break;
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
        .catch(log);
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
        .catch(log);
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
        async.eachSeries(
          list,
          (pair, next) => {
            const lbl = trim(pair[0]);
            const con = trim(pair[1]);
            reco.addLabel(lbl, con, rfc)
            .then(() => {
              if (verbose) log('Label stored:', lbl);
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
      case 'concept':
        const concept = trim(_.commands.slice(1).join(' '));
        if (!concept) return log('You must specify a concept.');
        reco.addConcept(concept, rfc)
        .then((id) => {
          log('Concept stored.');
          if (verbose) {
            log('');
            log('Database id: %s', id);
          }
          exit();
        })
        .catch(log);
      break;
      case 'concepts':
        const consPath = _.commands.slice(1).join(' ');
        if (!exists(consPath)) return log('File not found: "%s".', consPath);
        if (!isFile(consPath)) return log('Not a file.');
        async.eachSeries(
          read(consPath).split('\n')
          .filter(trim),
          (concept, next) => {
            reco.addConcept(concept, rfc)
            .then(() => next())
            .catch(next);
          },
          (error) => {
            if (error) return log(error);
            log('Concepts stored.');
            exit();
          }
        );
      break;
      case 'flush':
        reco.flush()
        .then(() => {
          log('Database flushed.');
          exit();
        })
        .catch(log);
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
        .then((result) => {
          log(result.label);
          if (verbose) {
            const sliceAmount = verbose === 1 ? 10: verbose;
            const maxLabelSize = Math.max.apply(Math, result.classifications.slice(0, sliceAmount).map(x => x.label.length));
            log('');
            log('Classifications');
            log('---------------');
            log(result.classifications.slice(0, sliceAmount).map(x => {
              const { label, value } = x;
              const pad = Array(maxLabelSize - label.length).fill(' ').join('');
              return `${ label }  ${ pad }  ${ (value * 100).toFixed(2) }%`;
            }).join('\n'));
            log('');
          }
          exit();
        })
        .catch(log);
      break;
      default:
        this.printHelp();
        log('');
        log('Invalid command:', _.commands[0]);
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
    fs.ensureDirSync(resolve(config.database.migrations.directory));
    fs.ensureDirSync(resolve(config.database.seeds.directory));
    fs.copySync(
      onepath('~/../lib/stub.migration.js'), 
      resolve(`${ config.database.migrations.directory }/0.js`)
    );
    if (config.database.migrations.stub) {
      fs.copySync(
        onepath('~/../lib/stub.migration.js'),
        resolve(config.database.migrations.stub)
      );
    }
  }

  /**
  * Get ./reco.json file.
  */
  getConfig() {
    const { _ } = this;
    try {
      _.config = JSON.parse(read(_.configPath));
      _.config.database.connection.filename = resolve(_.config.database.connection.filename);
      _.config.database.migrations.directory = resolve(_.config.database.migrations.directory);
      _.config.database.migrations.stub = resolve(_.config.database.migrations.stub);
      _.config.database.seeds.directory = resolve(_.config.database.seeds.directory);
    } catch(ex) {
      if (ex.code === 'ENOENT') {
        log('Configuration missing. run `reco init`.')
      } else {
        log(ex);
      }
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