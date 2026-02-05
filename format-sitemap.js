import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Formats XML sitemap files with proper indentation
 */
function formatXML(xml) {
  let formatted = '';
  let indent = '';
  const tab = '   '; // 3 spaces like in the example

  xml.split(/>\s*</).forEach((node) => {
    if (node.match(/^\/\w/)) {
      // Closing tag
      indent = indent.substring(tab.length);
    }

    formatted += indent + '<' + node + '>\n';

    if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?xml')) {
      // Opening tag (not self-closing, not xml declaration)
      indent += tab;
    }
  });

  return formatted.substring(1, formatted.length - 1);
}

/**
 * Format all sitemap files in dist directory
 */
function formatSitemaps() {
  const distDir = './dist';

  try {
    const files = readdirSync(distDir);
    const sitemapFiles = files.filter(f => f.endsWith('.xml') && f.includes('sitemap'));

    console.log(`\n📝 Formatting ${sitemapFiles.length} sitemap file(s)...`);

    sitemapFiles.forEach(file => {
      const filePath = join(distDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const formatted = formatXML(content);
      writeFileSync(filePath, formatted, 'utf-8');
      console.log(`   ✓ ${file} formatted`);
    });

    console.log('✅ Sitemap formatting complete!\n');
  } catch (error) {
    console.error('❌ Error formatting sitemaps:', error.message);
    process.exit(1);
  }
}

formatSitemaps();
