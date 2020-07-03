'use strict'

const { empty, list, pick } = require('../common/util')
const { props } = require('../common/export')
const { into } = require('../common/query')
const { all } = require('bluebird')
const { assign } = Object

const mod = {
  metadata: require('./metadata'),

  selection: {
    async load(db, ids) {
      const selections = {}

      await all([
        db.each(`
          SELECT
              id,
              photo_id AS photo,
              x,
              y,
              width,
              height,
              angle,
              mirror,
              negative,
              brightness,
              contrast,
              hue,
              saturation,
              sharpen,
              temperature,
              tint,
              template,
              datetime(created, "localtime") AS created,
              datetime(modified, "localtime") AS modified
            FROM subjects
              JOIN images USING (id)
              JOIN selections USING (id)${
          (ids != null) ? ` WHERE id IN (${list(ids)})` : ''
        }`,
        ({ id, created, modified, mirror, negative, ...data }) => {
          data.created = new Date(created)
          data.modified = new Date(modified)
          data.mirror = !!mirror
          data.negative = !!negative

          if (id in selections) assign(selections[id], data)
          else selections[id] = assign({ id, notes: [] }, data)
        }),

        db.each(`
          SELECT id, note_id AS note
            FROM notes JOIN selections USING (id)
            WHERE ${(ids != null) ? `id IN (${list(ids)}) AND` : ''}
              deleted IS NULL
            ORDER BY id, created`,
          ({ id, note }) => {
            if (id in selections) selections[id].notes.push(note)
            else selections[id] = { id, notes: [note] }
          }
        )
      ])

      return selections
    },

    async create(db, {
        template,
        photo,
        x,
        y,
        position,
        data,
        ...image
      }) {
      const { id } = await db.run(
        ...into('subjects').insert({ template }))

      await db.run(
        ...into('images').insert({ id, ...pick(image, props.image) }))

      await db.run(...into('selections').insert({
        id,
        photo_id: photo,
        position,
        x,
        y
      }))

      if (!empty(data)) {
        await mod.metadata.update(db, { id, data })
      }

      return (await mod.selection.load(db, [id]))[id]
    },

    async order(db, photo, selections, offset = 0) {
      if (selections.length) {
        return db.run(`
          UPDATE selections
            SET position = CASE id
              ${selections.map((_, idx) =>
                (`WHEN ? THEN ${offset + idx + 1}`)).join(' ')}
              END
            WHERE photo_id = ?`,
          ...selections, photo)
      }
    },

    async delete(db, ...ids) {
      return db.run(`
        INSERT INTO trash (id)
          VALUES ${ids.map(id => `(${id})`).join(',')}`)
    },

    async restore(db, ...ids) {
      return db.run(`
        DELETE FROM trash WHERE id IN (${list(ids)})`
      )
    },

    async prune(db) {
      return db.run(`
        DELETE FROM subjects
          WHERE id IN (
            SELECT id FROM trash JOIN selections USING (id)
          )`
      )
    }
  }
}

module.exports = mod.selection
