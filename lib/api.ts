import { Bible, BibleCollection, BookCollection, ChapterCollection, Passage } from '@/types/bible';

const API_BASE_URL = 'https://api.youversion.com/v1';
const API_KEY = process.env.NEXT_PUBLIC_YOUVERSION_API_KEY;

const headers = {
    'X-YouVersion-Developer-Token': API_KEY || '',
    'Accept': 'application/json',
};

// Dados de exemplo para fallback
const SAMPLE_BIBLES: Bible[] = [
    {
        id: '211',
        name: 'Nova Versão Internacional',
        abbreviation: 'NVI',
        language: { id: 'pt', name: 'Português' }
    },
    {
        id: '1',
        name: 'Almeida Revista e Atualizada',
        abbreviation: 'ARA',
        language: { id: 'pt', name: 'Português' }
    },
    {
        id: '212',
        name: 'Almeida Revista e Corrigida',
        abbreviation: 'ARC',
        language: { id: 'pt', name: 'Português' }
    }
];

const SAMPLE_BOOKS = [
    { id: 'GEN', name: 'Gênesis', abbreviation: 'Gn', testament: 'OLD' as const },
    { id: 'EXO', name: 'Êxodo', abbreviation: 'Êx', testament: 'OLD' as const },
    { id: 'LEV', name: 'Levítico', abbreviation: 'Lv', testament: 'OLD' as const },
    { id: 'NUM', name: 'Números', abbreviation: 'Nm', testament: 'OLD' as const },
    { id: 'DEU', name: 'Deuteronômio', abbreviation: 'Dt', testament: 'OLD' as const },
    { id: 'JOS', name: 'Josué', abbreviation: 'Js', testament: 'OLD' as const },
    { id: 'JDG', name: 'Juízes', abbreviation: 'Jz', testament: 'OLD' as const },
    { id: 'RUT', name: 'Rute', abbreviation: 'Rt', testament: 'OLD' as const },
    { id: '1SA', name: '1 Samuel', abbreviation: '1Sm', testament: 'OLD' as const },
    { id: '2SA', name: '2 Samuel', abbreviation: '2Sm', testament: 'OLD' as const },
    { id: 'MAT', name: 'Mateus', abbreviation: 'Mt', testament: 'NEW' as const },
    { id: 'MRK', name: 'Marcos', abbreviation: 'Mc', testament: 'NEW' as const },
    { id: 'LUK', name: 'Lucas', abbreviation: 'Lc', testament: 'NEW' as const },
    { id: 'JHN', name: 'João', abbreviation: 'Jo', testament: 'NEW' as const },
    { id: 'ACT', name: 'Atos', abbreviation: 'At', testament: 'NEW' as const },
    { id: 'ROM', name: 'Romanos', abbreviation: 'Rm', testament: 'NEW' as const },
];

export async function getBibles(languageRanges: string[] = ['pt']): Promise<Bible[]> {
    try {
        const params = new URLSearchParams();
        languageRanges.forEach(lang => params.append('language_ranges[]', lang));
        params.append('page_size', '100');

        const response = await fetch(`${API_BASE_URL}/bibles?${params.toString()}`, {
            headers,
            next: { revalidate: 3600 },
            cache: 'force-cache'
        });

        if (!response.ok) {
            console.warn(`API retornou ${response.status}, usando dados de exemplo`);
            return SAMPLE_BIBLES;
        }

        const data: BibleCollection = await response.json();
        return data.data.length > 0 ? data.data : SAMPLE_BIBLES;
    } catch (error) {
        console.error('Erro ao buscar bíblias:', error);
        return SAMPLE_BIBLES;
    }
}

export async function getBible(bibleId: string): Promise<Bible | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/bibles/${bibleId}`, {
            headers,
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            return SAMPLE_BIBLES.find(b => b.id === bibleId) || SAMPLE_BIBLES[0];
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erro ao buscar bíblia:', error);
        return SAMPLE_BIBLES[0];
    }
}

export async function getBooks(bibleId: string) {
    try {
        const response = await fetch(`${API_BASE_URL}/bibles/${bibleId}/books`, {
            headers,
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            console.warn(`API retornou ${response.status}, usando dados de exemplo`);
            return SAMPLE_BOOKS;
        }

        const data: BookCollection = await response.json();
        return data.data.length > 0 ? data.data : SAMPLE_BOOKS;
    } catch (error) {
        console.error('Erro ao buscar livros:', error);
        return SAMPLE_BOOKS;
    }
}

export async function getChapters(bibleId: string, bookId: string) {
    try {
        const response = await fetch(`${API_BASE_URL}/bibles/${bibleId}/books/${bookId}/chapters`, {
            headers,
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            // Gerar capítulos de exemplo (a maioria dos livros tem entre 1-50 capítulos)
            const numChapters = bookId === 'GEN' ? 50 : bookId === 'MAT' ? 28 : 10;
            return Array.from({ length: numChapters }, (_, i) => ({
                id: `${bookId}.${i + 1}`,
                number: i + 1,
                book_id: bookId
            }));
        }

        const data: ChapterCollection = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erro ao buscar capítulos:', error);
        return Array.from({ length: 10 }, (_, i) => ({
            id: `${bookId}.${i + 1}`,
            number: i + 1,
            book_id: bookId
        }));
    }
}

// Função auxiliar para gerar passagens de exemplo
function getSamplePassage(passageId: string): Passage {
    const [bookId, chapterNum] = passageId.split('.');
    const bookName = SAMPLE_BOOKS.find(b => b.id === bookId)?.name || bookId;

    const passages: Record<string, string> = {
        'GEN.1': `No princípio, Deus criou os céus e a terra.

A terra era sem forma e vazia; havia trevas sobre a face do abismo, e o Espírito de Deus se movia sobre a face das águas.

Disse Deus: "Haja luz", e houve luz. Deus viu que a luz era boa, e separou a luz das trevas.

Deus chamou à luz "dia", e às trevas chamou "noite". Passaram-se a tarde e a manhã; esse foi o primeiro dia.

Depois disse Deus: "Haja um firmamento entre as águas, separando águas de águas".`,

        'MAT.1': `Registro da genealogia de Jesus Cristo, filho de Davi, filho de Abraão:

Abraão gerou Isaque; Isaque gerou Jacó; Jacó gerou Judá e seus irmãos;

Judá gerou Perez e Zerá, cuja mãe foi Tamar; Perez gerou Esrom; Esrom gerou Arão;

Arão gerou Aminadabe; Aminadabe gerou Naassom; Naassom gerou Salmom;

Salmom gerou Boaz, cuja mãe foi Raabe; Boaz gerou Obede, cuja mãe foi Rute; Obede gerou Jessé;

e Jessé gerou o rei Davi. Davi gerou Salomão da que fora mulher de Urias.`,

        'JHN.3': `Havia entre os fariseus um líder dos judeus, chamado Nicodemos.

Ele veio a Jesus, à noite, e disse: "Mestre, sabemos que ensinas da parte de Deus, pois ninguém pode realizar os sinais miraculosos que estás fazendo, se Deus não estiver com ele".

Em resposta, Jesus declarou: "Digo-lhe a verdade: Ninguém pode ver o Reino de Deus, se não nascer de novo".

Perguntou Nicodemos: "Como alguém pode nascer, sendo velho? É claro que não pode entrar pela segunda vez no ventre de sua mãe e renascer!"

Respondeu Jesus: "Digo-lhe a verdade: Ninguém pode entrar no Reino de Deus, se não nascer da água e do Espírito."`
    };

    const content = passages[passageId] || `Este é o capítulo ${chapterNum} de ${bookName}.

O texto completo estará disponível quando a API YouVersion estiver configurada corretamente.

Para ver o conteúdo real da Bíblia, certifique-se de que sua chave de API está correta no arquivo .env.local

Esta é uma demonstração da interface de leitura da Bíblia Online.`;

    return {
        id: passageId,
        reference: `${bookName} ${chapterNum}`,
        content,
        verses: Array.from({ length: 5 }, (_, i) => ({
            id: `${passageId}.${i + 1}`,
            number: i + 1
        }))
    };
}

export async function getPassage(bibleId: string, passageId: string): Promise<Passage | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/bibles/${bibleId}/passages/${passageId}?content_type=text&include_notes=false&include_titles=true`,
            {
                headers,
                next: { revalidate: 3600 }
            }
        );

        if (!response.ok) {
            console.warn(`API retornou ${response.status} para passagem ${passageId}, usando dados de exemplo`);
            return getSamplePassage(passageId);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erro ao buscar passagem:', error);
        return getSamplePassage(passageId);
    }
}
