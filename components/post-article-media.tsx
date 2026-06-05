import type { Category, Post, PostTag, Tag } from "@/lib/generated/prisma";
import { buildAllVideoUrls, buildGalleryImageUrls } from "@/lib/post-gallery";

export type PostWithCategoryTags = Post & {
  category: Category;
  tags: Array<PostTag & { tag: Tag }>;
};

export { buildGalleryImageUrls };

/** @deprecated 前台详情已改用 PostRichContent；列表卡片等仍可用 */
export function PostArticleMedia({ post }: { post: PostWithCategoryTags }) {
  const galleryImages = buildGalleryImageUrls(post);
  const videos = buildAllVideoUrls(post);

  if (videos.length > 0) {
    return (
      <video
        className="article-video"
        src={videos[0]}
        poster={post.coverUrl}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  if (post.type === "GALLERY" && galleryImages.length > 1) {
    return (
      <div className="article-gallery">
        {galleryImages.map((src, i) => (
          <img className="article-gallery-item" key={`${src}-${i}`} src={src} alt="" loading="lazy" />
        ))}
      </div>
    );
  }

  if (post.type === "GALLERY" && galleryImages.length === 1) {
    return <img className="article-cover" src={galleryImages[0]} alt={post.title} />;
  }

  return <img className="article-cover" src={post.coverUrl} alt={post.title} />;
}
