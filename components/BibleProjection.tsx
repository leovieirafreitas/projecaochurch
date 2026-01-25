
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
            refColor: refColor,
            showRef: showRef
        };

        // SALVAR NO LOCATION STORAGE
        localStorage.setItem(storageKey, JSON.stringify(newSettings));
        window.dispatchEvent(new Event('storage'));

    }, [fontSize, textAlign, verticalAlign, color, refColor, background, backgroundColor, textBox, refPos, refFontSize, isBold, isUppercase, fontFamily, isLoaded, storageKey, showRef, refContent]);

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

    // --- TEMAS (SUPABASE) ---
    const [themes, setThemes] = useState<any[]>([]);
    const [showThemesModal, setShowThemesModal] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<{ id: string, name: string } | null>(null);
    const [newThemeName, setNewThemeName] = useState('');

    const loadThemes = async () => {
        const { data } = await supabase.from('themes').select('*').order('created_at', { ascending: false });
        if (data) setThemes(data);
    };

    useEffect(() => { if (showThemesModal) loadThemes(); }, [showThemesModal]);

    const startNewTheme = () => {
        setCurrentTheme(null);
        setNewThemeName('');
        // Reseta configs para um padrao limpo
        setFontSize(30);
        setColor('#ffffff');
        setBackground(null);
        setBackgroundColor('#000000');
        alert('Modo Novo Tema Ativado. Configure e depois salve.');
        setShowThemesModal(false);
    };

    const uploadBackground = async (base64Data: string) => {
        try {
            const res = await fetch(base64Data);
            const blob = await res.blob();
            // Garante extensão
            const ext = blob.type.split('/')[1] || 'jpg';
            const fileName = `${Date.now()}-bg.${ext}`;

            // Upload com UPSERT falso
            const { error: uploadError } = await supabase.storage
                .from('backgrounds')
                .upload(fileName, blob, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Erro Upload:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('backgrounds')
                .getPublicUrl(fileName);

            console.log('URL Publica Gerada:', publicUrl);
            return publicUrl;
        } catch (e) {
            console.error('Catch Upload:', e);
            throw e;
        }
    };

    const saveTheme = async () => {
        const themeName = newThemeName.trim() || currentTheme?.name;
        if (!themeName) return alert('Digite um nome para o tema');

        if (!background) {
            if (!confirm('ATENÇÃO: Este tema está SEM IMAGEM DE FUNDO. Deseja continuar?')) return;
        }

        let finalBackground = background;

        if (background && background.startsWith('data:')) {
            try {
                // Feedback visual simples
                const confirmUpload = confirm('A imagem de fundo será enviada para a nuvem. Isso pode levar alguns segundos. Continuar?');
                if (!confirmUpload) return;

                finalBackground = await uploadBackground(background);
                alert('Imagem enviada com sucesso! URL: ' + finalBackground);
            } catch (e: any) {
                return alert('FALHA AO ENVIAR IMAGEM: ' + (e.message || JSON.stringify(e)));
            }
        }

        // Settings atuais
        const currentSettings = {
            fontSize, textAlign, verticalAlign, color,
            backgroundImage: finalBackground, // URL da nuvem
            backgroundColor,
            fontFamily, textBox, refPos, refContent,
            refFontSize, refColor, showRef,
            fontWeight: isBold ? 'bold' : 'normal',
            textTransform: isUppercase ? 'uppercase' : 'none',
            isAdvancedLayout: true
        };

        console.log('Salvando Settings:', currentSettings);

        let result;
        if (currentTheme) {
            // UPDATE
            console.log('Atualizando tema:', currentTheme.id);
            result = await supabase.from('themes').update({
                name: themeName,
                background_url: finalBackground,
                settings: currentSettings
            }).eq('id', currentTheme.id);
        } else {
            // INSERT
            console.log('Criando novo tema');
            result = await supabase.from('themes').insert([{
                name: themeName,
                type: storageKey.includes('music') ? 'music' : 'bible',
                background_url: finalBackground,
                settings: currentSettings
            }])
                .select();
        }

        if (result.error) alert('Erro ao salvar tema: ' + result.error.message);
        else {
            if (!currentTheme && result.data) {
                setCurrentTheme({ id: result.data[0].id, name: themeName });
            }
            loadThemes();
            alert('Tema salvo na nuvem com sucesso!');
        }
    };

    const applyTheme = (themeFn: any) => {
        setCurrentTheme({ id: themeFn.id, name: themeFn.name });
        setNewThemeName(themeFn.name);

        const s = themeFn.settings;
        if (!s) return;

        // Aplicar
        if (s.fontSize) setFontSize(Number(s.fontSize));
        if (s.textAlign) setTextAlign(s.textAlign);
        if (s.verticalAlign) setVerticalAlign(s.verticalAlign);
        if (s.color) setColor(s.color);

        // Prioriza coluna dedicada, fallback pro JSON antigo
        const bgUrl = themeFn.background_url || s.backgroundImage;
        setBackground(bgUrl);

        if (s.backgroundColor) setBackgroundColor(s.backgroundColor);
        if (s.textBox) setTextBox(s.textBox);
        if (s.refPos) setRefPos(s.refPos);
        if (s.refContent) setRefContent(s.refContent);
        if (s.showRef !== undefined) setShowRef(s.showRef);
        if (s.refFontSize) setRefFontSize(s.refFontSize);
        if (s.refColor) setRefColor(s.refColor);
        if (s.fontWeight === 'bold') setIsBold(true); else setIsBold(false);
        if (s.textTransform === 'uppercase') setIsUppercase(true); else setIsUppercase(false);
        if (s.fontFamily) setFontFamily(s.fontFamily);

        setShowThemesModal(false);
    };

    const deleteTheme = async (id: string, e: any) => {
        e.stopPropagation();
        if (!confirm('Excluir este tema?')) return;
        await supabase.from('themes').delete().eq('id', id);
        loadThemes();
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 select-none" onMouseUp={stopDragging} onMouseLeave={stopDragging}>

            {/* MODAL DE TEMAS */}
            {showThemesModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                        {/* Header com Botões */}
                        <div className="p-4 bg-gray-900 border-b border-gray-800 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-bold">📂 Gerenciar Temas</h3>
                                <button onClick={() => setShowThemesModal(false)} className="text-gray-400 hover:text-white">✕</button>
                            </div>
                            <button onClick={startNewTheme} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-2 rounded text-sm shadow-lg border border-green-500/50 transition transform active:scale-95">
                                ➕ Criar Novo Tema em Branco
                            </button>
                        </div>

                        {/* Editor de Nome e Ação */}
                        <div className="p-4 bg-gray-800/50 border-b border-gray-800 flex flex-col gap-2">
                            <span className="text-xs text-gray-400 uppercase font-bold">Tema Atual: {currentTheme ? currentTheme.name : 'Novo (Sem nome)'}</span>
                            <div className="flex gap-2">
                                <input
                                    value={newThemeName}
                                    onChange={e => setNewThemeName(e.target.value)}
                                    className="flex-1 bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                                    placeholder={currentTheme ? `Renomear ${currentTheme.name}...` : "Nome do novo tema..."}
                                />
                            </div>

                            <div className="flex gap-2 justify-end">
                                {currentTheme && (
                                    <button
                                        onClick={() => { setCurrentTheme(null); saveTheme(); }}
                                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-bold border border-gray-600"
                                        title="Cria um novo tema baseada nas configurações atuais"
                                    >
                                        📄 Salvar como Novo
                                    </button>
                                )}
                                <button
                                    onClick={saveTheme}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition hover:shadow-blue-500/20 flex-1"
                                >
                                    {currentTheme ? '💾 Atualizar Existente' : '💾 Salvar Novo Tema'}
                                </button>
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#111]">
                            {themes.filter(t => t.type === (storageKey.includes('music') ? 'music' : 'bible') || !t.type).map(theme => (
                                <div key={theme.id} onClick={() => applyTheme(theme)} className={`p-2 rounded border cursor-pointer group flex gap-3 items-center transition ${currentTheme?.id === theme.id ? 'bg-blue-900/20 border-blue-500 shadow-inner' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}>

                                    {/* Miniatura */}
                                    <div className="w-12 h-8 rounded bg-black border border-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {(theme.background_url || theme.settings?.backgroundImage) ? (
                                            <img src={theme.background_url || theme.settings.backgroundImage} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[8px] text-gray-500">Sem Img</span>
                                        )}
                                    </div>

                                    <span className={`text-sm font-medium flex-1 ${currentTheme?.id === theme.id ? 'text-blue-300' : 'text-gray-300 group-hover:text-white'}`}>
                                        {theme.name}
                                    </span>
                                    <button onClick={(e) => deleteTheme(theme.id, e)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-900/30 p-1 rounded transition">🗑️</button>
                                </div>
                            ))}
                            {themes.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">Nenhum tema salvo. Crie o primeiro!</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLBAR */}
            {/* TOOLBAR RESPONSIVA */}
            <div className="w-full max-w-[95vw] bg-gray-900 rounded-lg p-2 gap-2 mb-4 border border-gray-800 shadow-xl shrink-0 flex flex-wrap items-center justify-center lg:justify-between overflow-x-auto">

                {/* GRUPO 1: FUNDO E GUIAS */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800">
                    <button onClick={() => setShowThemesModal(true)} className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white px-3 py-1 rounded text-xs font-bold border border-purple-500 shadow-lg" title="Gerenciar Temas">
                        📂 Temas
                    </button>
                    {currentTheme && (
                        <button onClick={saveTheme} className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-bold border border-green-500 shadow active:scale-95 transition flex gap-1 items-center" title={`Salvar alterações em '${currentTheme.name}'`}>
                            💾 Salvar
                        </button>
                    )}
                    <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 active:scale-95 transition" title="Carregar Imagem de Fundo">
                        🖼️ Img <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    <div className="w-px h-4 bg-gray-700"></div>
                    {/* Chroma */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => setBackgroundColor('#00FF00')} className="w-4 h-4 rounded bg-[#00FF00] border border-gray-600 hover:scale-110 active:scale-95 transition" title="Fundo Verde"></button>
                        <button onClick={() => setBackgroundColor('#0000FF')} className="w-4 h-4 rounded bg-[#0000FF] border border-gray-600 hover:scale-110 active:scale-95 transition" title="Fundo Azul"></button>
                        <button onClick={() => setBackgroundColor('#000000')} className="w-4 h-4 rounded bg-black border border-gray-600 hover:scale-110 active:scale-95 transition" title="Fundo Preto"></button>
                        <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-5 h-5 rounded border-none bg-transparent cursor-pointer" title="Cor Fundo Personalizada" />
                    </div>
                </div>

                {/* GRUPO 2: TEXTO PRINCIPAL */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800">
                    <span className="text-gray-500 text-[9px] font-bold uppercase">TXT</span>
                    <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-10 bg-gray-800 border border-gray-700 text-white rounded px-0 py-1 text-xs text-center" title="Tamanho Fonte" />

                    {/* V Align */}
                    <div className="flex bg-gray-800 rounded border border-gray-700 mx-1">
                        <button onClick={() => setVerticalAlign('flex-start')} title="Alinhar Topo" className={`px-2 py-1 text-xs hover:bg-gray-700 ${verticalAlign === 'flex-start' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>⬆</button>
                        <button onClick={() => setVerticalAlign('center')} title="Alinhar Centro" className={`px-2 py-1 text-xs hover:bg-gray-700 ${verticalAlign === 'center' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>⬍</button>
                        <button onClick={() => setVerticalAlign('flex-end')} title="Alinhar Base" className={`px-2 py-1 text-xs hover:bg-gray-700 ${verticalAlign === 'flex-end' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>⬇</button>
                    </div>

                    {/* H Align */}
                    <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700">
                        <button onClick={() => setTextAlign('left')} className={`p-1 w-6 rounded text-[10px] ${textAlign === 'left' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`} title="Alinhar Esquerda">Esq</button>
                        <button onClick={() => setTextAlign('center')} className={`p-1 w-6 rounded text-[10px] ${textAlign === 'center' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`} title="Centralizar">Cen</button>
                    </div>

                    {/* V Align */}
                    <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700">
                        <button onClick={() => setVerticalAlign('flex-start')} className={`p-1 w-5 rounded text-[10px] ${verticalAlign === 'flex-start' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`} title="Topo">⬆</button>
                        <button onClick={() => setVerticalAlign('center')} className={`p-1 w-5 rounded text-[10px] ${verticalAlign === 'center' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`} title="Meio">↕</button>
                        <button onClick={() => setVerticalAlign('flex-end')} className={`p-1 w-5 rounded text-[10px] ${verticalAlign === 'flex-end' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`} title="Base">⬇</button>
                        <label className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                            <input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} className="form-checkbox h-3 w-3 text-blue-600 rounded border-gray-300" />
                            Título
                        </label>
                    </div>

                    <div className="w-px h-4 bg-gray-700"></div>

                    <button onClick={() => setIsBold(!isBold)} className={`w-6 h-6 rounded text-xs font-bold border ${isBold ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700'}`} title="Negrito">B</button>
                    <button onClick={() => setIsUppercase(!isUppercase)} className={`w-6 h-6 rounded text-[8px] font-bold border ${isUppercase ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700'}`} title="Maiúsculas">AA</button>

                    <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-[10px] rounded px-1 py-1 w-20 truncate cursor-pointer outline-none hover:bg-gray-700">
                        {AVAILABLE_FONTS.map(font => <option key={font.value} value={font.value}>{font.name.split(' ')[0]}</option>)}
                    </select>

                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" title="Cor do Texto" />
                </div>

                {/* GRUPO 3: REFERÊNCIA */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800">
                    <span className="text-gray-500 text-[9px] font-bold uppercase">REF</span>
                    <input type="number" value={refFontSize} onChange={e => setRefFontSize(Number(e.target.value))} className="w-10 bg-gray-800 border border-gray-700 text-white rounded px-0 py-1 text-xs text-center" title="Tamanho Ref" />
                    <input type="color" value={refColor} onChange={e => setRefColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" title="Cor da Referência" />
                </div>

                {/* GUIAS E FECHAR */}
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowGuides(!showGuides)} className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition ${showGuides ? 'bg-purple-900/50 text-purple-200 border-purple-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                        {showGuides ? 'Guias ON' : 'Guias OFF'}
                    </button>
                    <button onClick={onClose} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-900/50 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1">
                        ✕ <span className="hidden sm:inline">Fechar</span>
                    </button>
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
                                        fontFamily: fontFamily,
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
                                        fontFamily: fontFamily,
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
