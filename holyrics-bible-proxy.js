/**
 * HOLYRICS BIBLE API PROXY
 * 
 * Este script cria endpoints customizados no Holyrics para sua aplicação
 * acessar os dados da Bíblia.
 * 
 * INSTALAÇÃO:
 * 1. Abra o Holyrics
 * 2. Vá em Ferramentas → JavaScript
 * 3. Clique em "Novo Script"
 * 4. Cole este código
 * 5. Salve como "Bible API Proxy"
 * 6. Execute o script
 * 
 * ENDPOINTS CRIADOS:
 * - GET /bible/versions - Lista versões disponíveis
 * - GET /bible/books?version=pt_nvi - Lista livros
 * - GET /bible/text?version=pt_nvi&reference=João 3:16 - Obtém versículos
 */

function myCustomAction(content) {
    var action = content.action || '';
    var params = content.params || {};

    h.log('Bible API Proxy - Action: ' + action);

    // Endpoint: Listar versões
    if (action === 'get_bible_versions') {
        var versions = h.hly('GetBibleVersionsV2');
        return {
            status: 'ok',
            data: versions.data
        };
    }

    // Endpoint: Obter texto de versículo
    if (action === 'get_bible_text') {
        var version = params.version || 'pt_nvi';
        var reference = params.reference || '';

        if (!reference) {
            return {
                status: 'error',
                error: 'Reference is required'
            };
        }

        try {
            // Usar a função ShowVerse para "mostrar" o versículo
            // e depois pegar da apresentação atual
            h.hly('ShowVerse', {
                input: {
                    references: reference,
                    version: version,
                    quick_presentation: true
                }
            });

            // Aguardar um pouco para o Holyrics processar
            h.sleep(500);

            // Pegar a apresentação atual
            var presentation = h.hly('GetCurrentQuickPresentation');

            if (presentation.status === 'ok' && presentation.data) {
                var slides = presentation.data.slides || [];
                var text = '';

                // Concatenar texto de todos os slides
                for (var i = 0; i < slides.length; i++) {
                    if (slides[i].text) {
                        text += slides[i].text + '\n';
                    }
                }

                // Fechar apresentação rápida
                h.hly('CloseCurrentQuickPresentation');

                return {
                    status: 'ok',
                    data: {
                        reference: reference,
                        version: version,
                        text: text.trim(),
                        slides: slides
                    }
                };
            }

            return {
                status: 'error',
                error: 'Could not get presentation'
            };

        } catch (e) {
            return {
                status: 'error',
                error: e.toString()
            };
        }
    }

    // Endpoint: Listar livros da Bíblia
    if (action === 'get_bible_books') {
        // Retornar lista estática dos 66 livros
        var books = [
            { id: 'GEN', name: 'Gênesis', testament: 'OT' },
            { id: 'EXO', name: 'Êxodo', testament: 'OT' },
            { id: 'LEV', name: 'Levítico', testament: 'OT' },
            { id: 'NUM', name: 'Números', testament: 'OT' },
            { id: 'DEU', name: 'Deuteronômio', testament: 'OT' },
            { id: 'JOS', name: 'Josué', testament: 'OT' },
            { id: 'JDG', name: 'Juízes', testament: 'OT' },
            { id: 'RUT', name: 'Rute', testament: 'OT' },
            { id: '1SA', name: '1 Samuel', testament: 'OT' },
            { id: '2SA', name: '2 Samuel', testament: 'OT' },
            { id: '1KI', name: '1 Reis', testament: 'OT' },
            { id: '2KI', name: '2 Reis', testament: 'OT' },
            { id: '1CH', name: '1 Crônicas', testament: 'OT' },
            { id: '2CH', name: '2 Crônicas', testament: 'OT' },
            { id: 'EZR', name: 'Esdras', testament: 'OT' },
            { id: 'NEH', name: 'Neemias', testament: 'OT' },
            { id: 'EST', name: 'Ester', testament: 'OT' },
            { id: 'JOB', name: 'Jó', testament: 'OT' },
            { id: 'PSA', name: 'Salmos', testament: 'OT' },
            { id: 'PRO', name: 'Provérbios', testament: 'OT' },
            { id: 'ECC', name: 'Eclesiastes', testament: 'OT' },
            { id: 'SNG', name: 'Cantares', testament: 'OT' },
            { id: 'ISA', name: 'Isaías', testament: 'OT' },
            { id: 'JER', name: 'Jeremias', testament: 'OT' },
            { id: 'LAM', name: 'Lamentações', testament: 'OT' },
            { id: 'EZK', name: 'Ezequiel', testament: 'OT' },
            { id: 'DAN', name: 'Daniel', testament: 'OT' },
            { id: 'HOS', name: 'Oséias', testament: 'OT' },
            { id: 'JOL', name: 'Joel', testament: 'OT' },
            { id: 'AMO', name: 'Amós', testament: 'OT' },
            { id: 'OBA', name: 'Obadias', testament: 'OT' },
            { id: 'JON', name: 'Jonas', testament: 'OT' },
            { id: 'MIC', name: 'Miquéias', testament: 'OT' },
            { id: 'NAM', name: 'Naum', testament: 'OT' },
            { id: 'HAB', name: 'Habacuque', testament: 'OT' },
            { id: 'ZEP', name: 'Sofonias', testament: 'OT' },
            { id: 'HAG', name: 'Ageu', testament: 'OT' },
            { id: 'ZEC', name: 'Zacarias', testament: 'OT' },
            { id: 'MAL', name: 'Malaquias', testament: 'OT' },
            { id: 'MAT', name: 'Mateus', testament: 'NT' },
            { id: 'MRK', name: 'Marcos', testament: 'NT' },
            { id: 'LUK', name: 'Lucas', testament: 'NT' },
            { id: 'JHN', name: 'João', testament: 'NT' },
            { id: 'ACT', name: 'Atos', testament: 'NT' },
            { id: 'ROM', name: 'Romanos', testament: 'NT' },
            { id: '1CO', name: '1 Coríntios', testament: 'NT' },
            { id: '2CO', name: '2 Coríntios', testament: 'NT' },
            { id: 'GAL', name: 'Gálatas', testament: 'NT' },
            { id: 'EPH', name: 'Efésios', testament: 'NT' },
            { id: 'PHP', name: 'Filipenses', testament: 'NT' },
            { id: 'COL', name: 'Colossenses', testament: 'NT' },
            { id: '1TH', name: '1 Tessalonicenses', testament: 'NT' },
            { id: '2TH', name: '2 Tessalonicenses', testament: 'NT' },
            { id: '1TI', name: '1 Timóteo', testament: 'NT' },
            { id: '2TI', name: '2 Timóteo', testament: 'NT' },
            { id: 'TIT', name: 'Tito', testament: 'NT' },
            { id: 'PHM', name: 'Filemom', testament: 'NT' },
            { id: 'HEB', name: 'Hebreus', testament: 'NT' },
            { id: 'JAS', name: 'Tiago', testament: 'NT' },
            { id: '1PE', name: '1 Pedro', testament: 'NT' },
            { id: '2PE', name: '2 Pedro', testament: 'NT' },
            { id: '1JN', name: '1 João', testament: 'NT' },
            { id: '2JN', name: '2 João', testament: 'NT' },
            { id: '3JN', name: '3 João', testament: 'NT' },
            { id: 'JUD', name: 'Judas', testament: 'NT' },
            { id: 'REV', name: 'Apocalipse', testament: 'NT' }
        ];

        return {
            status: 'ok',
            data: books
        };
    }

    return {
        status: 'error',
        error: 'Unknown action: ' + action
    };
}

// Log de inicialização
h.log('Bible API Proxy iniciado!');
h.log('Endpoints disponíveis:');
h.log('  - get_bible_versions');
h.log('  - get_bible_books');
h.log('  - get_bible_text');
