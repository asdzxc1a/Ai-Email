import { SessionProvider } from 'next-auth/react';
import '../styles/globals.css'; // Assuming you might have a global CSS file

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

export default MyApp;
