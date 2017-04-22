'use strict'

const { PROJECT, HISTORY } = require('../constants')

const {
  OPEN, OPENED, CLOSE, CLOSED, SAVE, UPDATE
} =  PROJECT


module.exports = {

  opened(payload, meta) {
    return {
      type: OPENED,
      error: (payload instanceof Error),
      payload,
      meta: { ipc: true, ...meta }
    }
  },

  open(payload, meta) {
    return { type: OPEN, payload, meta }
  },

  closed(payload, meta) {
    return { type: CLOSED, payload, meta }
  },

  close(payload, meta) {
    return { type: CLOSE, payload, meta }
  },


  save(payload, meta) {
    return {
      type: SAVE,
      payload,
      meta: {
        async: true,
        history: HISTORY.TICK,
        ...meta
      }
    }
  },

  update(payload, meta) {
    return {
      type: UPDATE,
      payload,
      meta: { ipc: true, ...meta }
    }
  }

}
