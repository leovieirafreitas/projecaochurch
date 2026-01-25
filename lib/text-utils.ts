/**
 * Utilitário centralizado para quebra de texto em slides.
 * Garante que o Monitor de Retorno e o Projetor usem a mesma lógica de corte.
 */

export const splitTextIdeally = (text: string, limit: number = 180): string[] => {
    if (!text) return [];
    if (text.length <= limit) return [text];

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            parts.push(remaining);
            break;
        }

        // Procura o melhor ponto de corte perto do limite (procura de trás pra frente)
        // Ordem de preferência: . (ponto) -> , (vírgula) -> ; (ponto e vírgula) -> espaço
        let cutPoint = remaining.lastIndexOf('.', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf('?', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf('!', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf(':', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf(';', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf(',', limit);
        if (cutPoint === -1 || cutPoint < limit * 0.6) cutPoint = remaining.lastIndexOf(' ', limit);

        if (cutPoint === -1) cutPoint = limit; // Corta na força bruta se não achar espaço
        else cutPoint += 1; // Inclui o caractere de pontuação

        parts.push(remaining.substring(0, cutPoint).trim());
        remaining = remaining.substring(cutPoint).trim();
    }
    return parts;
};
