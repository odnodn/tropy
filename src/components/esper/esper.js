'use strict'

const React = require('react')
const { PureComponent } = React
const { EsperView } = require('./view')
const { EsperToolbar } = require('./toolbar')
const { bool, func, node, number, object, string } = require('prop-types')
const { get, restrict, shallow } = require('../../common/util')
const { isHorizontal, rotate } = require('../../common/math')
const { Rotation } = require('../../common/iiif')
const { assign } = Object
const debounce = require('lodash.debounce')
const throttle = require('lodash.throttle')

const { TOOL, MODE } = require('../../constants/esper')

const {
  ESPER: {
    MAX_ZOOM,
    MIN_ZOOM,
    ROTATE_DURATION,
    ZOOM_DURATION,
    ZOOM_STEP_SIZE,
    ZOOM_WHEEL_FACTOR
  }
} = require('../../constants/sass')


class Esper extends PureComponent {
  constructor(props) {
    super(props)
    this.state = this.getEmptyState(props)
  }

  componentDidMount() {
    this.ro = new ResizeObserver(([e]) => {
      this.resize(e.contentRect)
    })

    this.ro.observe(this.view.container)
  }

  componentWillUnmount() {
    this.ro.disconnect()
  }

  componentWillReceiveProps(props) {
    if (!shallow(props, this.props)) {
      const state = this.getStateFromProps(props)

      if (this.shouldViewReset(props, state)) {
        this.view.reset(state)
      }

      this.setState(state)
    }
  }

  shouldViewReset(props, state) {
    if (state.src !== this.state.src) return true
    if (get(props.photo, ['id']) !== get(this.props.photo, ['id'])) return true

    if (state.angle !== this.state.angle) return true
    if (state.mirror !== this.state.mirror) return true

    return false
  }

  get isEmpty() {
    return this.props.photo == null || this.props.photo.pending === true
  }

  get isDisabled() {
    return this.props.isDisabled || this.isEmpty
  }

  get bounds() {
    return this.view.bounds
  }

  getEmptyState(props = this.props) {
    return {
      mode: props.mode,
      tool: props.tool,
      zoom: props.zoom,
      minZoom: props.minZoom,
      angle: 0,
      mirror: false,
      width: 0,
      height: 0,
      aspect: 0,
      src: null
    }
  }

  getStateFromProps(props) {
    const state = this.getEmptyState(props)
    const { photo } = props

    if (photo != null && !photo.pending) {
      state.src = `${photo.protocol}://${photo.path}`

      assign(state, this.getOrientationState(photo))
      assign(state, this.getAngleBounds({
        angle: state.angle,
        width: photo.width,
        height: photo.height
      }))
    }

    assign(state, this.getZoomBounds(this.view.bounds, state, props))

    return state
  }


  getZoomToFill(screen, state, props = this.props) {
    return Math.min(props.maxZoom, screen.width / state.width)
  }

  getZoomToFit(screen, state, props) {
    return Math.min(props.minZoom,
      Math.min(screen.width / state.width, screen.height / state.height))
  }

  getZoomBounds(
    screen = this.view.bounds,
    state = this.state,
    props = this.props
  ) {
    let { zoom, width, height } = state
    let { minZoom } = props
    let zoomToFill = minZoom

    if (width > 0 && height > 0) {
      minZoom = this.getZoomToFit(screen, state, props)
      zoomToFill = this.getZoomToFill(screen, state, props)

      switch (state.mode) {
        case 'fill':
          zoom = zoomToFill
          break
        case 'fit':
          zoom = minZoom
          break
      }

      if (minZoom > zoom) zoom = minZoom
    }

    return { minZoom, zoom, zoomToFill }
  }

  getAngleBounds({ angle, width, height }) {
    if (width === 0 || height === 0) {
      return {
        width: 0, height: 0, aspect: 0
      }
    }

    if (isHorizontal(angle)) {
      return {
        width, height, aspect: width / height
      }
    }

    return {
      width: height, height: width, aspect: height / width
    }
  }

  getOrientationState({ angle, mirror, orientation }) {
    return Rotation
      .fromExifOrientation(orientation)
      .add({ angle, mirror })
      .toJSON()
  }

  setView = (view) => {
    this.view = view
  }

  resize = throttle(({ width, height }) => {
    const { minZoom, zoom, zoomToFill } = this.getZoomBounds({ width, height })

    this.view.resize({
      width, height, zoom, mirror: this.state.mirror
    })

    this.setState({ minZoom, zoom, zoomToFill })
  }, 20)

  persist = debounce(() => {
    const { angle, mirror } = this.state

    this.props.onPhotoSave({
      id: this.props.photo.id,
      data: { angle, mirror }
    })
  }, 1000)

  handleRotationChange = (by) => {
    const state = {
      ...this.state,
      angle: rotate(this.state.angle, by),
      width: this.props.photo.width,
      height: this.props.photo.height
    }

    assign(state, this.getAngleBounds(state))
    assign(state, this.getZoomBounds(this.view.bounds, state))

    this.setState(state)

    this.view.rotate(state, ROTATE_DURATION)
    this.view.scale(state, ROTATE_DURATION)

    this.persist()
  }

  handleZoomChange = ({ x, y, zoom }, animate) => {
    zoom = restrict(zoom, this.state.minZoom, this.props.maxZoom)

    this.setState({ zoom, mode: 'zoom' })
    this.view.scale({
      x, y, zoom, mirror: this.state.mirror
    }, animate ? ZOOM_DURATION : 0)
  }

  handleMirrorChange = () => {
    let { angle, zoom, mirror } = this.state

    mirror = !mirror

    if (!isHorizontal(angle)) angle = rotate(angle, 180)

    this.setState({ angle, mirror })

    this.view.scale({ zoom, mirror })
    this.view.rotate({ angle })

    this.persist()
  }

  handleModeChange = (mode) => {
    let { minZoom, mirror, zoom, zoomToFill  } = this.state

    switch (mode) {
      case 'fill':
        zoom = zoomToFill
        break
      case 'fit':
        zoom = minZoom
        break
    }

    this.setState({ zoom, mode })
    this.view.scale({ zoom, mirror }, ZOOM_DURATION)
  }

  handleToolChange = (tool) => {
    this.setState({ tool })
  }

  handleWheel = ({ x, y, dy, dx, ctrl }) => {
    if (ctrl) {
      this.handleZoomChange({
        x, y, zoom: this.state.zoom + dy * ZOOM_WHEEL_FACTOR
      })
    } else {
      this.view.move({
        x: this.view.image.x - dx,
        y: this.view.image.y - dy
      })
    }
  }

  handleDoubleClick = ({ x, y, shift }) => {
    const step = shift ?
      -ZOOM_STEP_SIZE : ZOOM_STEP_SIZE

    this.handleZoomChange({
      x, y, zoom: this.state.zoom + step
    }, ZOOM_DURATION)
  }

  render() {
    const { isDisabled } = this

    return (
      <section className="esper">
        <EsperHeader>
          <EsperToolbar
            isDisabled={isDisabled}
            mode={this.state.mode}
            tool={this.state.tool}
            zoom={this.state.zoom}
            minZoom={this.state.minZoom}
            maxZoom={this.props.maxZoom}
            onMirrorChange={this.handleMirrorChange}
            onModeChange={this.handleModeChange}
            onToolChange={this.handleToolChange}
            onRotationChange={this.handleRotationChange}
            onZoomChange={this.handleZoomChange}/>
        </EsperHeader>
        <EsperView
          ref={this.setView}
          tool={this.state.tool}
          onDoubleClick={this.handleDoubleClick}
          onWheel={this.handleWheel}/>
      </section>
    )
  }

  static propTypes = {
    isDisabled: bool,
    maxZoom: number.isRequired,
    minZoom: number.isRequired,
    zoom: number.isRequired,
    mode: string.isRequired,
    photo: object,
    tool: string.isRequired,
    onPhotoSave: func.isRequired
  }

  static defaultProps = {
    maxZoom: MAX_ZOOM,
    minZoom: MIN_ZOOM,
    zoom: 1,
    mode: MODE.FIT,
    tool: TOOL.PAN
  }
}


const EsperHeader = ({ children }) => (
  <header className="esper-header draggable">{children}</header>
)

EsperHeader.propTypes = {
  children: node
}


module.exports = {
  EsperHeader,
  Esper
}
