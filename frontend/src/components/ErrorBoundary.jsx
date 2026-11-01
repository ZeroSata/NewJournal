import React from 'react'

/**
 * ErrorBoundary: исключение в рендере графика или страницы больше
 * не укладывает всё приложение белым экраном.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // в консоли — чтобы можно было сообщить о баге
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login-wrap">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>😵</div>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Что-то сломалось / Something broke</h1>
            <p className="text-sm text-muted" style={{ marginBottom: 18 }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              className="btn btn--primary"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              Перезагрузить / Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
