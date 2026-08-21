const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('src/pages')
  .filter(f => f.endsWith('.tsx'))
  .map(f => path.join('src/pages', f));
files.push('src/components/Dashboard.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/className="p-6 max-w-7xl mx-auto space-y-6"/g, 'className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6"');
  content = content.replace(/className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"/g, 'className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"');
  content = content.replace(/className="flex w-full md:w-auto items-center space-x-3"/g, 'className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-3"');
  content = content.replace(/className="relative flex-1 md:w-64"/g, 'className="relative flex-1 sm:w-64"');
  content = content.replace(/className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg/g, 'className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg');
  content = content.replace(/className="bg-\[#3AAFA9\] hover:bg-\[#2B7A78\] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center space-x-2 shrink-0"/g, 'className="w-full sm:w-auto bg-[#3AAFA9] hover:bg-[#2B7A78] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0"');
  content = content.replace(/className="bg-\[#1E1E1E\] hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"/g, 'className="w-full sm:w-auto bg-[#1E1E1E] hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"');
  content = content.replace(/<h1 className="text-2xl font-bold text-slate-800">/g, '<h1 className="text-xl sm:text-2xl font-bold text-slate-800">');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
