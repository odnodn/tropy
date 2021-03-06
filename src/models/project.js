'use strict'

const assert = require('assert')
const { dirname, join } = require('path')
const uuid = require('uuid').v4
const { all } = require('bluebird')
const { into, update } = require('../common/query')
const { info } = require('../common/log')
const os = require('../common/os')
const { paths } = require('../common/release')

module.exports = {
  async create(db, { name, base, id = uuid() }) {
    info(`creating project "${name}" ${id}`)
    await db.read(join(paths.db, 'schema', 'project.sql'))
    await db.run(...into('project').insert({
      project_id: id,
      name,
      base
    }))
  },

  async load(db) {
    const [project, items] = await all([
      db.get(`
        SELECT project_id AS id, name, base FROM project LIMIT 1`),
      db.get(`
        SELECT COUNT (id) AS total
          FROM items LEFT OUTER JOIN trash USING (id)
          WHERE deleted IS NULL`)
    ])

    assert(project != null, 'no project found')

    switch (project.base) {
      case 'project':
        project.base = dirname(db.path)
        break
      case 'home':
        project.base = os.home
        break
      case 'documents':
      case 'pictures':
        project.base = ARGS[project.base]
        break
    }

    project.items = items.total

    return project
  },

  async optimize(db) {
    await db.exec(
      "INSERT INTO fts_notes(fts_notes) VALUES ('optimize')")
    await db.exec(
      "INSERT INTO fts_metadata(fts_metadata) VALUES ('optimize')")
    await db.exec(
      'VACUUM')
  },

  async reindex(db, { check } = {}) {
    if (check) {
      await db.check()
    }
    await db.exec(
      'REINDEX')
    await db.exec(
      "INSERT INTO fts_notes(fts_notes) VALUES ('rebuild')")
    await db.exec(
      "INSERT INTO fts_metadata(fts_metadata) VALUES ('rebuild')")
  },

  save(db, { id, ...props }) {
    return db.run(
      ...update('project').set(props).where({ project_id: id })
    )
  }
}
