import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Formats XML sitemap files with proper indentation
 */
function formatXML(xml) {
  let formatted = '';
  let indent = '';
  const tab = '   '; // 3 spaces like in the example

  // Split on >< and process each node
  const nodes = xml.split(/>\s*</);

  nodes.forEach((node, index) => {
    // Check if this is a closing tag
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length);
    }

    // Add the node with proper formatting
    if (index === 0) {
      // First node - starts with <
      formatted += indent + node + '>\n';
    } else if (index === nodes.length - 1) {
      // Last node - ends with >
      formatted += indent + '<' + node + '\n';
    } else {
      // Middle nodes
      formatted += indent + '<' + node + '>\n';
    }

    // Check if this is an opening tag (increase indent for next line)
    if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?xml')) {
      indent += tab;
    }
  });

  return formatted.trim();
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
