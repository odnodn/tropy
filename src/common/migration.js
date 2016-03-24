'use strict'

require('./promisify')

const { readdirAsync: ls, readFileAsync: read } = require('fs')
const { basename, extname, resolve, join } = require('path')
const { debug } = require('./log')

const root = resolve(__dirname, '..', '..', 'db', 'migrate')


class Migration {

  static async all(dir = root) {
    return (await ls(dir))
      .sort()
      .map(migration => new this(join(dir, migration)))
  }

  static async since(number = 0, dir = root) {
    return (await this.all(dir)).filter(m => m.fresh(number))
  }

  static async migrate(db) {
    const version = await db.version()
    const migrations = await this.since(version)

    for (let migration of migrations) {
      await migration.up(db)
    }

    return migrations.length || 0
  }

  constructor(path) {
    this.path = path
    this.type = extname(this.path).slice(1)
    this.number = Number(basename(path).split('.', 2)[0])
  }

  up(db) {
    debug(`migrating ${db.path} to #${this.number}`)

    return db.transaction(async function (tx) {
      if (this.type === 'js') {
        await require(this.path).up(tx)
      } else {
        await tx.exec(String(await read(this.path)))
      }

      await tx.version(this.number)
    }.bind(this))
  }

  fresh(number) {
    return !number || this.number > number
  }
}

module.exports = Migration
