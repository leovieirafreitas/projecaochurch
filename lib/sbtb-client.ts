import { smartFetch } from './http-adapter';

// Client for SBTB Web Service (https://abibliasagrada.com.br/dlls/sbtb_ws.dll)
// Protocol: SOAP 1.1

const SERVICE_URL = 'https://abibliasagrada.com.br/dlls/sbtb_ws.dll/soap/ISBTB_WS';

// Mapping from App Book IDs to SBTB Book Nums
// Derived from GetBookList request (Version 1 - ACF)
export const SBTB_BOOK_MAPPING: Record<string, number> = {
    'MAT': 1, 'MRK': 2, 'LUK': 3, 'JHN': 4, 'ACT': 5, 'ROM': 6,
    '1CO': 7, '2CO': 8, 'GAL': 9, 'EPH': 10, 'PHP': 11, 'COL': 12,
    '1TH': 13, '2TH': 14, '1TI': 15, '2TI': 16, 'TIT': 17, 'PHM': 18,
    'HEB': 19, 'JAS': 20, '1PE': 21, '2PE': 22, '1JN': 23, '2JN': 24,
    '3JN': 25, 'JUD': 26, 'REV': 27,
    'GEN': 28, 'EXO': 29, 'LEV': 30, 'NUM': 31, 'DEU': 32, 'JOS': 33,
    'JDG': 34, 'RUT': 35, '1SA': 36, '2SA': 37, '1KI': 38, '2KI': 39,
    '1CH': 40, '2CH': 41, 'EZR': 42, 'NEH': 43, 'EST': 44, 'JOB': 45,
    'PSA': 46, 'PRO': 47, 'ECC': 48, 'SNG': 49, 'ISA': 50, 'JER': 51,
    'LAM': 52, 'EZK': 53, 'DAN': 54, 'HOS': 55, 'JOL': 56, 'AMO': 57,
    'OBA': 58, 'JON': 59, 'MIC': 60, 'NAM': 61, 'HAB': 62, 'ZEP': 63,
    'HAG': 64, 'ZEC': 65, 'MAL': 66
};

export class SbtbClient {

    private static async soapRequest(method: string, bodyObj: Record<string, any>) {
        let bodyXml = Object.entries(bodyObj).map(([k, v]) => `<${k}>${v}</${k}>`).join('');

        const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${method} xmlns="urn:ModSBTBUnit-ISBTB_WS">
      ${bodyXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;

        const res = await smartFetch(SERVICE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml',
            },
            body: envelope
        });

        if (!res.ok) throw new Error(`SOAP Request failed: ${res.status}`);
        const text = await res.text();
        return text;
    }

    private static extractReturn(soapXml: string): string {
        const match = soapXml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
        if (match) {
            // Unescape XML entities
            return match[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }
        return '';
    }

    static async getChapterText(versionNum: number, bookId: string, chapter: number) {
        const bookNum = SBTB_BOOK_MAPPING[bookId];
        if (!bookNum) throw new Error(`Book not found: ${bookId}`);

        // 1. Get Total Verses
        const totalParams = { Version: versionNum, BookCode: bookNum, Chapter: chapter };
        const totalXml = await this.soapRequest('GetTotalVerses', totalParams);

        let totalVerses = 0;
        const totalMatch = totalXml.match(/<return[^>]*>(\d+)<\/return>/);
        if (totalMatch) totalVerses = parseInt(totalMatch[1]);

        if (totalVerses === 0) return null;

        // 2. Get Verses
        const verseParams = {
            Version: versionNum,
            BookCode: bookNum,
            Chapter: chapter,
            IniVerse: 1,
            EndVerse: totalVerses
        };

        const versesXmlRaw = await this.soapRequest('GetVerses', verseParams);
        const innerXml = this.extractReturn(versesXmlRaw);

        // Output format: <verselist ...><verse num="1">Text</verse>...</verselist>

        // Parse verses
        const verses: { num: number, text: string }[] = [];
        const regex = /<verse num="(\d+)">([\s\S]*?)<\/verse>/g;
        let m;
        while ((m = regex.exec(innerXml)) !== null) {
            verses.push({ num: parseInt(m[1]), text: m[2] });
        }

        // Build HTML for App
        let html = `<div class="yv-content">`;
        verses.forEach(v => {
            // Clean Text & Decode Entities
            let clean = v.text
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/[\n\r]+/g, ' ')
                .trim();

            // Limpar/Normalizar HTML "estranho" que vem no texto (ex: SPAN style=...)
            // Removemos tags e mantemos só o texto se quiser, ou fazemos um replace mais preciso.
            // Para "ACF Corrigida", parece que vem tags de formatação. O ideal seria processar ou limpar.
            // Se o usuário quer o texto limpo, removemos as tags. 
            // Se quer formatação, deixamos. 
            // Vou remover tags HTML explicitas de formatação que poluem, como <span>...</span>
            clean = clean.replace(/<[^>]+>/g, '');

            html += `<span class="verse" data-usfm="${bookId}.${chapter}.${v.num}">`;
            html += `<span class="label">${v.num}</span>`;
            html += `<span class="content"> ${clean} </span>`;
            html += `</span> `;
        });
        html += `</div>`;

        return {
            content: html,
            copyright: 'A Bíblia Sagrada - Almeida Corrigida Fiel | acf - © 1994, 1995, 2007, 2011 Sociedade Bíblica Trinitariana do Brasil, Trinitarian Bible Society.',
            reference: `ACF ${bookId} ${chapter}`
        };
    }

    static async getChapters(versionNum: number, bookId: string) {
        const bookNum = SBTB_BOOK_MAPPING[bookId];
        if (!bookNum) return [];

        const params = { BookCode: bookNum };
        const xml = await this.soapRequest('GetTotalChapters', params);
        const match = xml.match(/<return[^>]*>(\d+)<\/return>/);
        const total = match ? parseInt(match[1]) : 0;

        const chapters = [];
        for (let i = 1; i <= total; i++) {
            chapters.push({
                id: `${bookId}.${i}`,
                passage_id: `${bookId}.${i}`,
                number: String(i)
            });
        }
        return chapters;
    }
}
