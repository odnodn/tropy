'use strict'

const assert = require('assert')
const { pick } = require('../common/util')
const { freeze } = Object

const Registry = new Map()

class Command {
  #adjtime = 0
  #suspended

  constructor(action, options = {}) {
    this.action = action
    this.options = options
  }

  get duration() {
    return this.done ?
      (this.done - this.init - this.#adjtime) : 0
  }

  get id() {
    return this.action.meta.seq
  }

  get isReversible() {
    return !this.error && !!this.undo && !!this.action.meta.history
  }

  get history() {
    return {
      undo: this.undo,
      redo: this.redo || this.action,
      mode: this.action.meta.history
    }
  }

  get type() {
    return this.action.type
  }

  suspend() {
    this.#suspended = Date.now()
  }

  resume() {
    this.#adjtime += (Date.now() - this.#suspended)
  }

  run = function* () {
    try {
      this.init = Date.now()
      this.result = yield this.exec()
      var hasRunToCompletion = true

    } catch (error) {
      this.error = error
      yield this.abort()

    } finally {
      this.cancelled = !hasRunToCompletion
      this.done = Date.now()
      yield this.finally()
    }

    freeze(this)
    return this
  };

  *abort() {
  }

  *finally() {
  }

  toJSON() {
    return pick(this, [
      'action',
      'done',
      'error',
      'init',
      'result'
    ])
  }

  toString() {
    return `${this.type}#${this.id}`
  }

  static create(action, options) {
    return new (Registry.get(action.type))(action, { ...options })
  }

  static register(type, Cmd = this) {
    assert(type, 'missing action type')
    assert(Cmd.prototype instanceof Command || Cmd === Command)

    assert(!Registry.has(type), `command ${type} already registered!`)

    Registry.set(type, Cmd)
  }
}

module.exports = {
  Command,
  Registry
}
