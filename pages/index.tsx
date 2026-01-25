
import Head from 'next/head'
import dynamic from 'next/dynamic'

// Carregamento Dinâmico com SSR Desativado
// Isso previne erros de hidratação e servidor (Window not found) na Vercel
const BibleSearch = dynamic(() => import('../components/BibleSearch'), {
    ssr: false,
    loading: () => <div style={{ color: 'white', padding: 20 }}>Carregando Sistema...</div>
})

export default function Home() {
    return (
        <div>
            <Head>
                <title>Bíblia Online - Chama Church</title>
                <meta name="description" content="Sistema de Projeção Bíblica Online" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main>
                <BibleSearch />
            </main>
        </div>
    )
}
