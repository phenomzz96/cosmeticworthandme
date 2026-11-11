import { Component, type ReactNode } from 'react'

/**
 * Một trang gặp lỗi khi hiển thị: chỉ vùng nội dung báo lỗi (đầu trang, chân trang, giỏ hàng vẫn dùng được),
 * có nút tải lại. Chuyển sang trang khác thì tự hết báo lỗi.
 */
export class RouteErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  componentDidCatch(error: unknown) {
    console.error('Lỗi hiển thị trang:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="container-page py-16 text-center" role="alert">
        <h1 className="text-3xl">Trang chưa hiển thị được</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">Có thể kết nối mạng vừa bị gián đoạn hoặc website vừa được cập nhật. Tải lại trang để thử lại.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-control bg-ink px-6 font-medium text-on-ink hover:bg-ink-hover">
            Tải lại trang
          </button>
          <a href="/" className="inline-flex h-11 items-center rounded-control border border-border px-6 font-medium hover:border-text">
            Về trang chủ
          </a>
        </div>
      </div>
    )
  }
}
