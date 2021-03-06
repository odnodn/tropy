'use strict'

const { call, put, select } = require('redux-saga/effects')
const { Command } = require('./command')
const mod = require('../models')
const act = require('../actions')
const { NOTE } = require('../constants')
const { getSelectableNoteId } = require('../selectors')


class Load extends Command {
  *exec() {
    const { db } = this.options
    const { payload } = this.action

    const notes = yield call(mod.note.load, db, payload)

    return notes
  }
}

Load.register(NOTE.LOAD)


class Create extends Command {
  *exec() {
    const { db } = this.options
    const { payload } = this.action
    const { state, text, photo, selection, created } = payload

    const type = (selection != null) ? 'selection' : 'photo'
    const id = (selection != null) ? selection : photo

    const note = yield call(db.transaction, tx =>
      mod.note.create(tx, { id, state, text }))

    note.created = created

    yield put(act[type].notes.add({ id, notes: [note.id] }))
    yield put(act.note.select({ note: note.id, photo, selection }))

    this.undo = act.note.delete({ photo, selection, notes: [note.id] })
    this.redo = act.note.restore({ photo, selection, notes: [note.id] })

    return { [note.id]: note }
  }
}

Create.register(NOTE.CREATE)


class Save extends Command {
  *exec() {
    const { db } = this.options
    const { payload, meta } = this.action
    const { id, state, text, modified } = payload

    const original = yield select(({ notes }) => notes[id])
    const data = { id, state, text, modified }

    yield call(mod.note.save, db, {
      id, state, text: meta.changed ? text : undefined
    },  modified)

    yield put(act.note.update(data))

    this.undo = act.note.save({
      id,
      text: original.text,
      state: original.state
    })

    return data
  }
}

Save.register(NOTE.SAVE)


class Delete extends Command {
  *exec() {
    const { db } = this.options
    const { payload } = this.action
    const { photo, selection, notes } = payload

    const type = (selection != null) ? 'selection' : 'photo'
    const id = (selection != null) ? selection : photo

    const [isSelected, nextId] = yield select(state => [
      state.nav.note === notes[0], getSelectableNoteId(state)
    ])

    yield call(db.transaction, tx => mod.note.delete(tx, notes))

    if (isSelected) {
      yield put(act.note.select({ photo, selection, note: nextId }))
    }

    yield put(act[type].notes.remove({ id, notes }))

    this.undo = act.note.restore(payload)

    return payload
  }
}

Delete.register(NOTE.DELETE)


class Restore extends Command {
  *exec() {
    const { db } = this.options
    const { payload } = this.action
    const { photo, selection, notes } = payload

    const type = (selection != null) ? 'selection' : 'photo'
    const id = (selection != null) ? selection : photo

    yield call(mod.note.restore, db, notes)
    yield put(act[type].notes.add({ id, notes }))

    this.undo = act.note.delete(payload)

    return payload
  }
}

Restore.register(NOTE.RESTORE)


module.exports = {
  Create,
  Delete,
  Load,
  Restore,
  Save
}
