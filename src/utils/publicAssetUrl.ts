/**
 * public 目录静态资源 URL（图片、视频等）。
 * 须配合 vite.config 的 base，避免 GitHub Pages 子路径下资源 404。
 */
export function publicAssetUrl(path: string): string {
  const normalized = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}
