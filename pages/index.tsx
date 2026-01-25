
import Head from 'next/head'
import BibleSearch from '../components/BibleSearch'

export default function Home() {
    return (
        <div>
            <Head>
                <title>Bíblia Online - YouVersion</title>
                <meta name="description" content="Bíblia Online integrada com YouVersion API" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <BibleSearch />
        </div>
    )
}
