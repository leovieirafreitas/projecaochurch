const fs = require('fs');

const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Clean verse text to remove numbers
content = content.replace(
    /setActiveSlide\(\{ text: v\.text, ref, copyright: currentCopyright \}\);/,
    `// Remove verse numbers from text (e.g., "22 E Obede..." -> "E Obede...")
        const cleanedText = v.text.replace(/^\\d+\\s*/, '').trim();
        
        setActiveSlide({ text: cleanedText, ref, copyright: currentCopyright });`
);

// Fix 2: Add blue highlight for selected verse (change bg-blue-100 to bg-blue-500 with white text)
content = content.replace(
    /className=\{`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group \$\{activeSlide\?\.text === v\.text \? 'bg-blue-100' : ''\}`\}/,
    `className={\`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group \${activeSlide?.text === v.text ? 'bg-blue-500' : ''}\`}`
);

// Fix 3: Update text colors for selected verse
content = content.replace(
    /className=\{`text-xs font-bold w-6 pt-0\.5 text-right shrink-0 \$\{activeSlide\?\.text === v\.text \? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'\}`\}/,
    `className={\`text-xs font-bold w-6 pt-0.5 text-right shrink-0 \${activeSlide?.text === v.text ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}\`}`
);

content = content.replace(
    /className=\{`text-sm leading-snug \$\{activeSlide\?\.text === v\.text \? 'text-gray-900 font-medium' : 'text-gray-600'\}`\}/,
    `className={\`text-sm leading-snug \${activeSlide?.text === v.text ? 'text-white font-semibold' : 'text-gray-600'}\`}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Versículos corrigidos!');
console.log('- Números removidos do texto projetado');
console.log('- Destaque azul adicionado ao versículo selecionado');
