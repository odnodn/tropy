'use strict'

const PIXI = require('pixi.js')
const res = require('../../common/res')
const { restrict } = require('../../common/util')
const frag = res.shader.load('balance.frag')


class BalanceFilter extends PIXI.Filter {
  #max = 100
  #min = -100
  #precision = 0.0016

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

  get c() {
    return this.uniforms.c
  }

  set b(value) {
    this.uniforms.b = this.restrict(value)
    this.uniforms.c = this.uniforms.b * (0.3 / (this.#precision * this.#max))
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
