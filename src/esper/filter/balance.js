'use strict'

const PIXI = require('pixi.js')
const res = require('../../common/res')
const { restrict } = require('../../common/util')
const frag = res.shader.load('balance.frag')


class BalanceFilter extends PIXI.Filter {
  #max = 100
  #min = -100
  #precision = 0.0032

  constructor(a = 0, b = 0) {
    super(undefined, frag)
    this.a = a
    this.b = b
  }

  get a() {
    return this.uniforms.a
  }

  set a(value) {
    this.uniforms.a = this.restrict(value)
  }

  get b() {
    return this.uniforms.b
  }

  set b(value) {
    this.uniforms.b = this.restrict(value)
  }

  set(a, b) {
    this.a = a
    this.b = b
  }

  restrict(value) {
    return restrict(value, this.#min, this.#max) * this.#precision
  }
}

module.exports = {
  BalanceFilter
}
