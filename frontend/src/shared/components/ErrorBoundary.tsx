import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

/**
 * Menangkap error render yang tak tertangani agar aplikasi tidak menjadi
 * layar putih kosong. Menampilkan halaman error ramah dengan opsi memuat ulang
 * atau kembali ke beranda.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log ke konsol untuk diagnosis; bisa diarahkan ke layanan monitoring nanti.
    console.error("[SIPERAH] Uncaught UI error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleHome = (): void => {
    window.location.hash = "#/";
    this.setState({ hasError: false, message: undefined });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--bg, #f8fafc)",
          color: "var(--ink, #1e293b)",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            textAlign: "center",
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 16,
            padding: "40px 32px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 10px" }}>
            Terjadi kesalahan tak terduga
          </h1>
          <p style={{ color: "var(--ink-soft, #64748b)", fontSize: "0.95rem", margin: "0 0 24px", lineHeight: 1.6 }}>
            Maaf, ada bagian aplikasi yang gagal ditampilkan. Data Anda aman. Coba muat
            ulang halaman, atau kembali ke beranda.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "none",
                background: "#1e40af",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Muat ulang
            </button>
            <button
              onClick={this.handleHome}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "1px solid var(--line, #e2e8f0)",
                background: "transparent",
                color: "var(--ink, #1e293b)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Kembali ke beranda
            </button>
          </div>
          {this.state.message && (
            <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-soft, #94a3b8)", wordBreak: "break-word" }}>
              Detail: {this.state.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
