'use strict'

const { DOMParser, DOMSerializer } = require('prosemirror-model')
const { EditorState } = require('prosemirror-state')
const { defaultMarkdownSerializer } = require('prosemirror-markdown')
const { schema } = require('./schema')
const { warn } = require('../../common/log')

const serializer = DOMSerializer.fromSchema(schema)
const parser = DOMParser.fromSchema(schema)

const serialize = (note, {
  format = { text: true, html: true },
  localize = true
} = {}) => (
  (note == null) ? null :
    Object
      .entries(format)
      .reduce((acc, [fmt, include]) => {
        if (include) {
          switch (fmt) {
            case 'text':
              acc.text = toValue(note.text, localize, note.language)
              break
            case 'html':
              acc.html = toValue(
                toHTML(note.state.doc),
                localize,
                note.language)
              break
            case 'markdown':
              acc.markdown = toValue(
                toMarkdown(note.state.doc),
                localize,
                note.language)
              break
          }
        }
        return acc
      }, {})
)


const toValue = (value, localize, language) => (
  (localize && language) ?
    { '@value': value, '@language': language } :
    value
)

const fromHTML = (html) => {
  let dom = (new window.DOMParser).parseFromString(html, 'text/html')
  let doc = parser.parse(dom)
  let text = doc.textBetween(0, doc.content.size, ' ', ' ')

  return {
    state: EditorState.create({ schema, doc }).toJSON(),
    text
  }
}


const toHTML = (doc) => {
  try {
    let node = schema.nodeFromJSON(doc)
    let frag = serializer.serializeFragment(node)

    return Array
      .from(frag.children, el => el.outerHTML)
      .join('')

  } catch (e) {
    warn({ stack: e.stack }, 'failed to convert doc to HTML')
    return ''
  }
}

const toMarkdown = (doc) => {
  try {
    let node = schema.nodeFromJSON(doc)
    return defaultMarkdownSerializer.serialize(node)

  } catch (e) {
    warn({ stack: e.stack }, 'failed to convert doc to markdown')
    return ''
  }
}

module.exports = {
  fromHTML,
  serialize,
  toHTML,
  toMarkdown
}
