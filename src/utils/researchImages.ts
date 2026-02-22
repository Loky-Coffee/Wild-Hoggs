// Import all research images at build time using Vite's glob import
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/research/**/*.webp',
  { eager: true }
);

export interface ImageMetadata {
  src: string;
  width: number;
  height: number;
  format: string;
}

// Create a lookup map: category/tech-id -> optimized image
const imageMap = new Map<string, ImageMetadata>();

// Populate map from glob imports
Object.entries(imageModules).forEach(([path, module]) => {
  // Extract "category/tech-id" from path
  // Path format: /src/assets/images/research/category/tech-id.webp
  const match = path.match(/research\/([^/]+)\/([^/]+)\.webp$/);
  if (match) {
    const [, category, techId] = match;
    const key = `${category}/${techId}`;
    imageMap.set(key, module.default);
  }
});

/**
 * Get optimized research image by category and tech ID
 * Returns null if image not found (for fallback handling)
 *
 * @example
 * const image = getResearchImage('alliance-recognition', 'collect-wood');
 * if (image) {
 *   console.log(image.src); // /_astro/collect-wood.abc123.webp
 * }
 */
export function getResearchImage(category: string, techId: string): ImageMetadata | null {
  const key = `${category}/${techId}`;
  return imageMap.get(key) || null;
}

/**
 * Check if a research image exists
 *
 * @example
 * if (hasResearchImage('field', 'arms-assembly')) {
 *   // Image is available
 * }
 */
export function hasResearchImage(category: string, techId: string): boolean {
  return imageMap.has(`${category}/${techId}`);
}
