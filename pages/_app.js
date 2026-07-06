import '../styles/globals.css'
import AuthGate from '../components/AuthGate'

export default function App({ Component, pageProps }) {
  return (
    <AuthGate>
      <Component {...pageProps} />
    </AuthGate>
  )
}
