
import React, { useState, useEffect, useRef } from 'react';
import { splitTextIdeally } from '../lib/text-utils';
import { supabase } from '../lib/supabaseClient';

interface BibleProjectionProps {
    verseText: string;
    reference: string;
    onClose: () => void;
    storageKey?: string; // Opcional, default bible_settings
}

const AVAILABLE_FONTS = [
    { name: 'Inter (Padrão)', value: 'Inter, sans-serif' },
    { name: 'Wondra', value: 'Wondra, sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Lora (Serifa)', value: 'Lora, serif' },
    { name: 'Montserrat', value: 'Montserrat, sans-serif' },
];

// DIMENSÕES VIRTUAIS FIXAS (Mesma do Monitor e Projeção)
const VIRTUAL_WIDTH = 1024;
const VIRTUAL_HEIGHT = 576; // 16:9

export default function BibleProjection({ verseText, reference, onClose, storageKey = 'bible_settings' }: BibleProjectionProps) {
    const [background, setBackground] = useState<string | null>(null);
    const [backgroundColor, setBackgroundColor] = useState('#000000'); // Estado para cor de fundo (Chroma)

    // ESTILO
    const [fontSize, setFontSize] = useState(30);
    const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
    const [verticalAlign, setVerticalAlign] = useState<'flex-start' | 'center' | 'flex-end'>('center'); // Novo estado
    const [color, setColor] = useState('#000000');

    const [isBold, setIsBold] = useState(false);
    const [isUppercase, setIsUppercase] = useState(false);
    const [fontFamily, setFontFamily] = useState('Inter, sans-serif');

    // CAIXA DE TEXTO & GUIAS
    const [textBox, setTextBox] = useState({ x: 50, y: 50, w: 80, h: 40 });
    const [showGuides, setShowGuides] = useState(true);

    // REFERÊNCIA
    const [refFontSize, setRefFontSize] = useState(20);
    const [refFontFamily, setRefFontFamily] = useState('Inter, sans-serif'); // Nova fonte independente
    const [refColor, setRefColor] = useState('#ffffff'); // Cor independente da referência
    const [showRef, setShowRef] = useState(true); // Mostrar/Ocultar Referência
    const [refPos, setRefPos] = useState({ x: 50, y: 90 });
    const [refContent, setRefContent] = useState(reference);
    const [isEditingRef, setIsEditingRef] = useState(false);

    // PAGINAÇÃO
    const [pages, setPages] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [isEditing, setIsEditing] = useState(false);

    // Dragging & Scaling
    const dragMode = useRef<'text' | 'ref' | 'resizeText' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Container externo (responsivo)
    const [scale, setScale] = useState(1);

    const [isLoaded, setIsLoaded] = useState(false);

    // Ajusta o Scale para caber na tela do editor
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                const scaleX = clientWidth / VIRTUAL_WIDTH;
                const scaleY = clientHeight / VIRTUAL_HEIGHT;
                setScale(Math.min(scaleX, scaleY) * 0.95); // 95% para margem
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        // Pequeno delay para garantir que o container montou
        setTimeout(handleResize, 100);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Carregar configurações salvas
    useEffect(() => {
        const savedSettings = localStorage.getItem(storageKey);
        if (savedSettings) {
            try {
                const style = JSON.parse(savedSettings);
                if (style.fontSize) setFontSize(parseInt(style.fontSize));
                if (style.textAlign) setTextAlign(style.textAlign);
                if (style.verticalAlign) setVerticalAlign(style.verticalAlign);
                if (style.color) setColor(style.color);
                if (style.backgroundImage) setBackground(style.backgroundImage);
                if (style.backgroundColor) setBackgroundColor(style.backgroundColor);
                if (style.textBox) setTextBox(style.textBox);
                if (style.refPos) setRefPos(style.refPos);
                if (style.refContent) setRefContent(style.refContent); // Recuperar posição customizada se houver
                if (style.showRef !== undefined) setShowRef(style.showRef);
                if (style.refFontSize) setRefFontSize(style.refFontSize);
                if (style.refFontFamily) setRefFontFamily(style.refFontFamily);
                if (style.refColor) setRefColor(style.refColor);
                if (style.fontWeight === 'bold') setIsBold(true);
                if (style.textTransform === 'uppercase') setIsUppercase(true);
                if (style.fontFamily) setFontFamily(style.fontFamily);
            } catch (e) { }
        }
        setIsLoaded(true);
    }, [storageKey]);

    // Salva automaticamente
    useEffect(() => {
        if (!isLoaded) return;

        const newSettings = {
            fontSize: fontSize.toString(),
            textAlign,
            verticalAlign,
            color,
            backgroundImage: background,
            backgroundColor: backgroundColor,
            fontFamily: fontFamily,
            fontWeight: isBold ? 'bold' : 'normal',
            textTransform: isUppercase ? 'uppercase' : 'none',
            isAdvancedLayout: true,
            textBox: textBox,
            refPos: refPos,
            refContent: refContent,

            refFontSize: refFontSize,
            refFontFamily: refFontFamily,
            refColor: refColor,
            showRef: showRef
        };

        // SALVAR NO LOCATION STORAGE
        try {
            localStorage.setItem(storageKey, JSON.stringify(newSettings));
            window.dispatchEvent(new Event('storage'));
        } catch (e: any) {
            console.error('Erro ao salvar no LocalStorage:', e);
            if (e.name === 'QuotaExceededError') {
                alert('⚠️ A imagem de fundo é muito grande para ser salva automaticamente!\nPor favor, escolha uma imagem menor ou com menos resolução para garantir que suas alterações não sejam perdidas.');
            }
        }
    }, [fontSize, textAlign, verticalAlign, color, refColor, background, backgroundColor, textBox, refPos, refFontSize, refFontFamily, isBold, isUppercase, fontFamily, isLoaded, storageKey, showRef, refContent]);

    useEffect(() => { setRefContent(reference); }, [reference]);

    useEffect(() => {
        const parts = splitTextIdeally(verseText, 180);
        setPages(parts);
        setCurrentPage(0);
    }, [verseText]);

    const handlePageContentChange = (newContent: string) => {
        const updatedPages = [...pages];
        updatedPages[currentPage] = newContent;
        setPages(updatedPages);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Sempre usar FileReader para preview local
        // O upload real para o Supabase acontecerá apenas ao salvar o Tema
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setBackground(ev.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    // DRAG AND DROP
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragMode.current || isEditing || isEditingRef) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;

        const SNAP_TOLERANCE = 2;
        const x = Math.abs(rawX - 50) < SNAP_TOLERANCE ? 50 : rawX;
        const y = Math.abs(rawY - 50) < SNAP_TOLERANCE ? 50 : rawY;

        if (dragMode.current === 'text') {
            setTextBox(prev => ({ ...prev, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }));
        } else if (dragMode.current === 'ref') {
            setRefPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
        } else if (dragMode.current === 'resizeText') {
            const newW = Math.abs(rawX - textBox.x) * 2;
            const newH = Math.abs(rawY - textBox.y) * 2;
            setTextBox(prev => ({ ...prev, w: Math.max(10, newW), h: Math.max(10, newH) }));
        }
    };

    const stopDragging = () => { dragMode.current = null; };

    // --- TEMAS (read-only do Supabase) ---
    const [themes, setThemes] = useState<any[]>([]);
    const [showThemesModal, setShowThemesModal] = useState(false);

    const loadThemes = async () => {
        // Apenas leitura dos temas globais
        const { data } = await supabase.from('themes').select('*').order('created_at', { ascending: false });
        if (data) setThemes(data);
    };

    useEffect(() => { if (showThemesModal) loadThemes(); }, [showThemesModal]);

    const applyTheme = (themeFn: any) => {
        const s = themeFn.settings;
        if (!s) return;

        // Aplicar estilos do tema selecionado ao estado local
        if (s.fontSize) setFontSize(Number(s.fontSize));
        if (s.textAlign) setTextAlign(s.textAlign);
        if (s.verticalAlign) setVerticalAlign(s.verticalAlign);
        if (s.color) setColor(s.color);

        // Prioriza URL da nuvem
        const bgUrl = themeFn.background_url || s.backgroundImage;
        setBackground(bgUrl);

        if (s.backgroundColor) setBackgroundColor(s.backgroundColor);
        if (s.textBox) setTextBox(s.textBox);
        if (s.refPos) setRefPos(s.refPos);
        if (s.refContent) setRefContent(s.refContent); // Reseta conteúdo ref se necessário? Não, mantemos a ref atual, só aplicamos estilo.
        // Ops, se o tema salva posição da ref, aplicamos. Mas o conteudo da ref deve ser dinamico.
        // O refContent aqui era pra ser customizado? Sim. Mas ao aplicar tema, o usuario geralmente quer manter o conteudo texto? 
        // O refContent é o texto da referencia (ex: "Joao 3:16"). Isso vem da props `reference`.
        // Mas se o usuario editou manualmente o texto da referencia, ao aplicar tema, mantemos ou resetamos? 
        // Vamos manter o que o tema diz SOBRE POSIÇÃO E ESTILO. O conteúdo `reference` vem da prop.

        if (s.showRef !== undefined) setShowRef(s.showRef);
        if (s.refFontSize) setRefFontSize(s.refFontSize);
        if (s.refColor) setRefColor(s.refColor);
        if (s.fontWeight === 'bold') setIsBold(true); else setIsBold(false);
        if (s.textTransform === 'uppercase') setIsUppercase(true); else setIsUppercase(false);
        if (s.fontFamily) setFontFamily(s.fontFamily);

        setShowThemesModal(false);
        alert('Tema aplicado! Para tornar essa mudança permanente, vá em Arquivo > Salvar Projeto.');
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 select-none" onMouseUp={stopDragging} onMouseLeave={stopDragging}>

            {/* MODAL DE TEMAS (APENAS LEITURA) */}
            {showThemesModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                        <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-white font-bold text-lg">Galeria de Temas</h3>
                                <p className="text-gray-400 text-xs">Escolha um modelo base. As alterações são salvas no seu Projeto local.</p>
                            </div>
                            <button onClick={() => setShowThemesModal(false)} className="text-gray-400 hover:text-white text-2xl">X</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-[#111]">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {themes.filter(t => t.type === (storageKey.includes('music') ? 'music' : 'bible') || !t.type).map(theme => (
                                    <div
                                        key={theme.id}
                                        onClick={() => applyTheme(theme)}
                                        className="group relative aspect-video bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer overflow-hidden transition hover:shadow-xl hover:scale-[1.02]"
                                    >
                                        {/* Preview do Fundo */}
                                        <div className="absolute inset-0 bg-black">
                                            {(theme.background_url || theme.settings?.backgroundImage) ? (
                                                <img src={theme.background_url || theme.settings?.backgroundImage} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" style={{ backgroundColor: theme.settings?.backgroundColor }}></div>
                                            )}
                                        </div>

                                        {/* Preview do Texto (Simulado) */}
                                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center pointer-events-none">
                                            {/* Vazio */}
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 border-t border-white/10">
                                            <p className="text-white text-xs font-bold truncate">{theme.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {themes.length === 0 && <div className="text-center text-gray-500 mt-10">Carregando temas...</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLBAR PROFISSIONAL */}
            <div className="w-full max-w-[95vw] bg-[#1e1e1e] rounded-lg p-2 gap-3 mb-4 border border-[#333] shadow-2xl shrink-0 flex flex-wrap items-center justify-between overflow-x-auto select-none">

                {/* ESQUERDA: TEMAS E IMAGEM */}
                <div className="flex items-center gap-2 mr-4">
                    <button
                        onClick={() => setShowThemesModal(true)}
                        className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 px-3 py-1.5 rounded transition border border-[#444]"
                        title="Galeria de Temas"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-xs font-semibold">Temas</span>
                    </button>

                    <label className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 px-3 py-1.5 rounded cursor-pointer transition border border-[#444]" title="Carregar Imagem de Fundo">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="text-xs font-semibold">Imagem</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>

                    {/* Quick Colors (Mantido conforme pedido) */}
                    <div className="flex items-center gap-1 ml-2 bg-[#111] p-1 rounded border border-[#333]">
                        {['#00ff00', '#0000ff', '#000000', '#ffffff'].map(c => (
                            <button
                                key={c}
                                onClick={() => setBackgroundColor(c)}
                                className="w-4 h-4 rounded-sm border border-gray-600 hover:scale-110 transition"
                                style={{ backgroundColor: c }}
                                title={`Fundo ${c}`}
                            />
                        ))}
                    </div>
                </div>

                {/* CENTRO: FORMATAÇÃO DE TEXTO */}
                <div className="flex items-center gap-3 bg-[#111] px-3 py-1.5 rounded border border-[#333]">

                    {/* Fonte Tamanho */}
                    <div className="flex items-center gap-1">
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">TXT</span>
                        <input
                            type="number"
                            value={fontSize}
                            onChange={e => setFontSize(Number(e.target.value))}
                            className="w-12 bg-[#2d2d2d] border border-[#444] text-white rounded px-1 py-1 text-xs text-center focus:border-blue-500 outline-none"
                            title="Tamanho da Fonte"
                        />
                    </div>

                    <div className="w-px h-6 bg-[#333]"></div>

                    {/* Alinhamento Vertical (Ícones SVG) */}
                    <div className="flex bg-[#2d2d2d] rounded border border-[#444] overflow-hidden">
                        <button onClick={() => setVerticalAlign('flex-start')} className={`p-1.5 hover:bg-[#3d3d3d] ${verticalAlign === 'flex-start' ? 'bg-[#007acc] text-white' : 'text-gray-400'}`} title="Topo">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14M12 4v16M8 16l4 4 4-4" /></svg>
                        </button>
                        <button onClick={() => setVerticalAlign('center')} className={`p-1.5 hover:bg-[#3d3d3d] ${verticalAlign === 'center' ? 'bg-[#007acc] text-white' : 'text-gray-400'}`} title="Centro">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M12 4v16" /></svg>
                        </button>
                        <button onClick={() => setVerticalAlign('flex-end')} className={`p-1.5 hover:bg-[#3d3d3d] ${verticalAlign === 'flex-end' ? 'bg-[#007acc] text-white' : 'text-gray-400'}`} title="Base">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 20h14M12 4v16M8 8l4-4 4 4" /></svg>
                        </button>
                    </div>

                    {/* Alinhamento Horizontal */}
                    <div className="flex bg-[#2d2d2d] rounded border border-[#444] overflow-hidden">
                        <button onClick={() => setTextAlign('left')} className={`p-1.5 hover:bg-[#3d3d3d] ${textAlign === 'left' ? 'bg-[#007acc] text-white' : 'text-gray-400'}`} title="Esquerda">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" /></svg>
                        </button>
                        <button onClick={() => setTextAlign('center')} className={`p-1.5 hover:bg-[#3d3d3d] ${textAlign === 'center' ? 'bg-[#007acc] text-white' : 'text-gray-400'}`} title="Centro">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M9 18h6" /></svg>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-[#333]"></div>

                    {/* Estilo */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsBold(!isBold)}
                            className={`w-7 h-7 flex items-center justify-center rounded border transition ${isBold ? 'bg-[#007acc] border-[#005c99] text-white' : 'bg-[#2d2d2d] border-[#444] text-gray-400 hover:text-white'}`}
                            title="Negrito"
                        >
                            <span className="font-bold text-xs">B</span>
                        </button>

                        <button
                            onClick={() => setIsUppercase(!isUppercase)}
                            className={`w-7 h-7 flex items-center justify-center rounded border transition ${isUppercase ? 'bg-[#007acc] border-[#005c99] text-white' : 'bg-[#2d2d2d] border-[#444] text-gray-400 hover:text-white'}`}
                            title="Maiúsculas"
                        >
                            <span className="text-[10px] font-bold">AA</span>
                        </button>
                    </div>

                    {/* Fonte Familia */}
                    <select
                        value={fontFamily}
                        onChange={e => setFontFamily(e.target.value)}
                        className="bg-[#2d2d2d] border border-[#444] text-white text-xs rounded px-2 py-1.5 w-24 outline-none hover:bg-[#3d3d3d] transition"
                    >
                        {AVAILABLE_FONTS.map(font => <option key={font.value} value={font.value}>{font.name.split(' ')[0]}</option>)}
                    </select>

                    {/* Cor Texto */}
                    <div className="relative w-6 h-6 rounded overflow-hidden border border-[#555] cursor-pointer hover:border-white transition" title="Cor do Texto">
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0 opacity-100" />
                    </div>
                </div>

                {/* DIREITA: REF E AÇÕES */}
                <div className="flex items-center gap-4">

                    {/* Referência */}
                    <div className="flex items-center gap-2 bg-[#111] px-2 py-1.5 rounded border border-[#333]">
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">REF</span>
                        <input
                            type="number"
                            value={refFontSize}
                            onChange={e => setRefFontSize(Number(e.target.value))}
                            className="w-12 bg-[#2d2d2d] border border-[#444] text-white rounded px-1 py-1 text-xs text-center focus:border-blue-500 outline-none"
                            title="Tamanho Referência"
                        />
                        <select
                            value={refFontFamily}
                            onChange={e => setRefFontFamily(e.target.value)}
                            className="bg-[#2d2d2d] border border-[#444] text-white text-[10px] rounded px-1 py-1 w-20 outline-none hover:bg-[#3d3d3d] transition truncate"
                            title="Fonte da Referência"
                        >
                            {AVAILABLE_FONTS.map(font => <option key={font.value} value={font.value}>{font.name.split(' ')[0]}</option>)}
                        </select>
                        <div className="relative w-5 h-5 rounded overflow-hidden border border-[#555] cursor-pointer hover:border-white transition" title="Cor da Referência">
                            <input type="color" value={refColor} onChange={e => setRefColor(e.target.value)} className="absolute -top-2 -left-2 w-8 h-8 cursor-pointer p-0 border-0" />
                        </div>
                    </div>

                    {/* Checkbox Título */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition ${showRef ? 'bg-blue-600 border-blue-600' : 'border-gray-500 group-hover:border-gray-300'}`}>
                            {showRef && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs font-semibold ${showRef ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>Título</span>
                        <input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} className="hidden" />
                    </label>

                    <div className="w-px h-8 bg-[#333]"></div>

                    {/* Botões Ação */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowGuides(!showGuides)}
                            className={`px-3 py-1.5 rounded border text-xs font-bold transition flex items-center gap-1 ${showGuides ? 'bg-purple-900/30 text-purple-300 border-purple-800' : 'bg-[#2d2d2d] text-gray-400 border-[#444] hover:text-white'}`}
                        >
                            Guias
                        </button>

                        <button
                            onClick={onClose}
                            className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-3 py-1.5 rounded text-xs font-bold transition"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTAINER RESPONSIVO (WRAPPER) */}
            <div
                ref={containerRef}
                className="w-full flex-1 flex items-center justify-center overflow-hidden relative"
            >
                {/* VIRTUAL CANVAS FIXO 1024x576 SCALED */}
                <div
                    className="shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-gray-800 overflow-hidden relative group/canvas cursor-crosshair"
                    style={{
                        height: `${VIRTUAL_HEIGHT}px`,
                        width: `${VIRTUAL_WIDTH}px`,
                        backgroundColor: backgroundColor,
                        transform: `scale(${scale})`,
                        transformOrigin: 'center center',
                    }}
                    onMouseMove={handleMouseMove}
                >
                    {background && <img src={background} alt="Background" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}

                    {/* Guias */}
                    {showGuides && (
                        <div className="absolute inset-0 pointer-events-none z-50">
                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-500/50"></div>
                            <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-500/50"></div>
                            <div className="absolute inset-[10%] border border-dashed border-yellow-500/30"></div>
                        </div>
                    )}

                    {/* REFERÊNCIA (Com refColor) */}
                    {showRef && (
                        <div
                            className="absolute z-40 cursor-move hover:ring-1 hover:ring-blue-500/50 rounded"
                            style={{ left: `${refPos.x}%`, top: `${refPos.y}%`, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => { if (!isEditingRef) { dragMode.current = 'ref'; e.stopPropagation(); } }}
                        >
                            {isEditingRef ? (
                                <input
                                    value={refContent}
                                    onChange={e => setRefContent(e.target.value)}
                                    onBlur={() => setIsEditingRef(false)}
                                    autoFocus
                                    className="bg-blue-500/20 text-white text-center rounded px-1 py-0 outline-none font-bold shadow-lg backdrop-blur-sm pointer-events-auto"
                                    style={{
                                        fontSize: `${refFontSize}px`,
                                        fontFamily: refFontFamily,
                                        width: (refContent.length + 1) + 'ch',
                                        textTransform: isUppercase ? 'uppercase' : 'none'
                                    }}
                                />
                            ) : (
                                <div
                                    onClick={() => setIsEditingRef(true)}
                                    className="font-extrabold tracking-wider cursor-text pointer-events-auto"
                                    style={{
                                        fontSize: `${refFontSize}px`,
                                        fontFamily: refFontFamily,
                                        color: refColor,
                                        textShadow: refColor === '#ffffff' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none',
                                        textTransform: isUppercase ? 'uppercase' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {refContent}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CAIXA DE TEXTO */}
                    <div
                        className="absolute z-30 group/box"
                        style={{
                            left: `${textBox.x}%`,
                            top: `${textBox.y}%`,
                            width: `${textBox.w}%`,
                            height: `${textBox.h}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <div className={`absolute inset-0 border-2 border-dashed pointer-events-none transition-colors ${showGuides ? 'border-purple-500/40' : 'border-transparent group-hover/box:border-blue-500/50'}`}></div>

                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize opacity-0 group-hover/box:opacity-100 z-50 pointer-events-auto border border-white"
                            onMouseDown={(e) => { dragMode.current = 'resizeText'; e.stopPropagation(); }}></div>

                        <div className="absolute inset-0 cursor-move z-0 pointer-events-auto"
                            onMouseDown={(e) => { if (!isEditing) { dragMode.current = 'text'; e.stopPropagation(); } }}></div>

                        <div
                            className="relative w-full h-full flex flex-col p-2 z-10 pointer-events-none"
                            style={{ justifyContent: verticalAlign }}
                        >
                            {isEditing ? (
                                <textarea
                                    value={pages[currentPage]}
                                    onChange={e => handlePageContentChange(e.target.value)}
                                    onBlur={() => setIsEditing(false)}
                                    autoFocus
                                    className="w-full h-full bg-blue-500/20 text-white rounded p-1 resize-none outline-none leading-tight shadow-lg backdrop-blur-sm pointer-events-auto no-scrollbar"
                                    style={{
                                        fontSize: `${fontSize}px`,
                                        textAlign: textAlign,
                                        fontFamily: fontFamily,
                                        fontWeight: isBold ? 'bold' : 'normal',
                                        textTransform: isUppercase ? 'uppercase' : 'none'
                                    }}
                                />
                            ) : (
                                <p
                                    className="leading-tight cursor-text whitespace-pre-wrap w-full pointer-events-auto"
                                    onClick={() => setIsEditing(true)}
                                    style={{
                                        fontSize: `${fontSize}px`,
                                        textAlign: textAlign,
                                        color: color,
                                        textShadow: 'none',
                                        fontFamily: fontFamily,
                                        fontWeight: isBold ? 'bold' : 'normal',
                                        textTransform: isUppercase ? 'uppercase' : 'none',
                                        width: '100%',
                                        maxHeight: '100%',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {pages[currentPage]}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between w-full max-w-4xl bg-gray-900/50 p-2 rounded-full border border-gray-800 backdrop-blur shrink-0">
                <div className="text-gray-400 text-xs px-4">
                    {showGuides ? 'Guias LIGADAS.' : 'Guias desligadas.'}
                </div>
                <div className="flex-1 text-center flex justify-end px-4">
                    {/* Paginacao */}
                    {pages.length > 1 && (
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(c => Math.max(0, c - 1))} className="px-3 py-1 bg-blue-600 rounded text-xs text-white">Ant</button>
                            <span className="text-white text-xs py-1">{currentPage + 1}/{pages.length}</span>
                            <button onClick={() => setCurrentPage(c => Math.min(pages.length - 1, c + 1))} className="px-3 py-1 bg-blue-600 rounded text-xs text-white">Próx</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
