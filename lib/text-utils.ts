/**
 * Utilitário centralizado para quebra de texto em slides.
 * Garante que o Monitor de Retorno e o Projetor usem a mesma lógica de corte.
 */

export const splitTextIdeally = (text: string, limit: number = 180): string[] => {
    if (!text) return [];
    // V100: Tolerância Elástica (15%) para evitar quebras desnecessárias.
    // Se o texto exceder o limite em pouco (ex: 200 chars vs 180 limite), mantemos junto.
    if (text.length <= limit * 1.15) return [text];

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            parts.push(remaining);
            break;
        }

        // 1. Busca corte ideal (Ponto, Vírgula, Espaço)
        let cutPoint = findBestCut(remaining, limit);

        // 2. Lógica Anti-Órfã (V100)
        // Se o que sobra for muito curto, forçamos um corte anterior.
        const remainderLength = remaining.length - cutPoint;
        const ORPHAN_THRESHOLD = 50; // Aumentado para 50 (V100) para garantir chunks maiores

        if (remainderLength > 0 && remainderLength < ORPHAN_THRESHOLD) {
            // Tenta achar um corte anterior mais cedo (recuando até 40% do slide)
            // Ex: Em vez de cortar no caractere 170, tenta cortar no 130 (última vírgula/ponto)
            const earlierLimit = Math.max(limit * 0.6, limit - 60);
            const earlierCut = findBestCut(remaining, earlierLimit);

            // Se achou um corte anterior válido (que não seja curto demais), usa ele
            if (earlierCut > limit * 0.3) {
                cutPoint = earlierCut;
            }
        }

        // Avança o ponteiro (inclui a pontuação no slide anterior se for pontuação)
        // Ajuste: Se o corte foi num espaço, não incluímos o espaço no final visualmente (trim resolve), 
        // mas precisamos avançar o índice corretamente.

        let splitIndex = cutPoint;
        // Se cortou em pontuação, inclui ela. Se espaço, tanto faz (trim limpa).
        // A função findBestCut retorna o índice DA pontuação/espaço.
        // Vamos incluir a pontuação no slide atual.
        if (cutPoint < remaining.length) {
            splitIndex++;
        }

        parts.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }
    return parts;
};

// V105: GEOMETRIC SPLITING (PHYSICS-BASED)
// Calculates exact fit based on rendered pixel width/height.
export const splitTextGeometrically = (
    text: string,
    maxWidth: number,
    maxHeight: number,
    fontSize: number,
    fontFamily: string = "Inter, sans-serif",
    fontWeight: string = "normal"
): string[] => {
    // Fallback for SSR or invalid dimensions
    if (typeof document === 'undefined' || maxWidth <= 0 || maxHeight <= 0) {
        return splitTextIdeally(text, 200);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return splitTextIdeally(text, 200);

    // Font format for Canvas
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const words = text.split(' ');
    const slides: string[] = [];
    let currentSlideLines: string[] = [];
    let currentHeight = 0;

    // Line Height (Matches Tailwind 'leading-tight' which is 1.25)
    const lineHeight = fontSize * 1.25;

    let currentLineWords: string[] = [];
    let currentLineWidth = 0;
    const spaceWidth = ctx.measureText(' ').width;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordWidth = ctx.measureText(word).width;

        // Calculate new width if we add this word
        const newWidth = currentLineWidth + (currentLineWords.length > 0 ? spaceWidth : 0) + wordWidth;

        if (newWidth <= maxWidth) {
            // Fits in current line
            currentLineWords.push(word);
            currentLineWidth = newWidth;
        } else {
            // Line full. Push current line to slide logic.
            const lineStr = currentLineWords.join(' ');

            // If current line was empty (single word > maxWidth), force push it to avoid infinite loop
            if (currentLineWords.length === 0) {
                // Determine if this single giant word fits height?
                // Just handle as regular line logic below
                currentLineWords.push(word); // Force it in
            } else {
                // 2. Verifica se a linha montada cabe na altura restante do slide
                // Se já tem linhas e adicionar mais essa vai estourar a altura...
                if (currentSlideLines.length > 0 && currentHeight + lineHeight > maxHeight) {
                    // ...então fecha o slide atual
                    slides.push(currentSlideLines.join('\n'));
                    currentSlideLines = [];
                    currentHeight = 0;
                }

                // Adiciona a linha (seja no slide vazio ou no atual que ainda cabe)
                currentSlideLines.push(lineStr);
                currentHeight += lineHeight;

                // Começa nova linha com a palavra atual que não coube na linha anterior
                currentLineWords = [word];
                currentLineWidth = wordWidth;
            }
        }
    }

    // Processa a última linha que sobrou no buffer
    if (currentLineWords.length > 0) {
        const lineStr = currentLineWords.join(' ');

        // Verifica se essa última linha cabe
        if (currentSlideLines.length > 0 && currentHeight + lineHeight > maxHeight) {
            slides.push(currentSlideLines.join('\n'));
            slides.push(lineStr); // Novo slide só pra ela
        } else {
            currentSlideLines.push(lineStr);
            slides.push(currentSlideLines.join('\n'));
        }
    } else if (currentSlideLines.length > 0) {
        // Se sobrou slide aberto sem palavras pendentes (raro, mas possível)
        slides.push(currentSlideLines.join('\n'));
    }

    return slides.length > 0 ? slides : [text];
};


// Helper function para achar corte
function findBestCut(text: string, max: number): number {
    const slice = text.substring(0, max + 1); // +1 para pegar caso o char "max" seja o ponto

    // Ordem de preferência
    let idx = slice.lastIndexOf('.');
    if (isValidCut(idx, max)) return idx;

    idx = slice.lastIndexOf('?');
    if (isValidCut(idx, max)) return idx;

    idx = slice.lastIndexOf('!');
    if (isValidCut(idx, max)) return idx;

    idx = slice.lastIndexOf(';');
    if (isValidCut(idx, max)) return idx;

    idx = slice.lastIndexOf(':');
    if (isValidCut(idx, max)) return idx;

    idx = slice.lastIndexOf(',');
    if (isValidCut(idx, max)) return idx;

    // Se não achou pontuação, vai no espaço
    idx = slice.lastIndexOf(' ');
    if (isValidCut(idx, max)) return idx;

    // Se não achou nada (palavra gigante), corta na marra
    return max;
}

function isValidCut(idx: number, max: number) {
    // Corte deve existir e não ser muito no começo (evitar slides de 1 palavra se possível)
    return idx !== -1 && idx > max * 0.2;
}
