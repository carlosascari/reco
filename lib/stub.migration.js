exports.up = (knex, Promise) => {
  return Promise.all([

    knex.schema.createTable('clients', (table) => {
      table.increments('id').primary();
      table.string('rfc');
      table.string('name');
    }),

    knex.schema.createTable('suppliers', (table) => {
      table.increments('id').primary();
      table.string('rfc');
      table.string('name');
    }),

    knex.schema.createTable('concepts', (table) => {
      table.increments('id').primary();
      table.string('description', 1000);
    }),

    knex.schema.createTable('invoices', (table) => {
      table.increments('id').primary();
      table.integer('client_id').references('id').inTable('clients');
      table.integer('supplier_id').references('id').inTable('suppliers');
      table.string('sello', 500);
      table.string('xml');
      table.string('hash');
      table.dateTime('date');
    }),

    knex.schema.createTable('labels', (table) => {
      table.increments('id').primary();
      table.string('name');
    }),

    knex.schema.createTable('classifiers', (table) => {
      table.increments('id').primary();
      table.integer('supplier_id').nullable().references('id').inTable('suppliers');
      table.string('json');
    }),

    knex.schema.createTable('invoices_to_concepts', (table) => {
      table.increments('id').primary();
      table.integer('invoice_id').references('id').inTable('invoices');
      table.integer('concept_id').references('id').inTable('concepts');
    }),

    knex.schema.createTable('labels_to_concepts', (table) => {
      table.increments('id').primary();
      table.integer('label_id').references('id').inTable('labels');
      table.integer('concept_id').references('id').inTable('concepts');
      table.integer('supplier_id').nullable().references('id').inTable('suppliers');
    }),

    knex.schema.createTable('labels_to_classifiers', (table) => {
      table.increments('id').primary();
      table.integer('label_id').references('id').inTable('labels');
      table.integer('classifier_id').references('id').inTable('concepts');
    }),
  ]);
};

exports.down = (knex, Promise) => {
  return Promise.all([
    knex.schema.dropTable('clients'),
    knex.schema.dropTable('suppliers'),
    knex.schema.dropTable('concepts'),
    knex.schema.dropTable('invoices'),
    knex.schema.dropTable('labels'),
    knex.schema.dropTable('classifiers'),
    knex.schema.dropTable('invoices_to_concepts'),
    knex.schema.dropTable('labels_to_concepts'),
    knex.schema.dropTable('labels_to_classifiers'),
  ]);
};
