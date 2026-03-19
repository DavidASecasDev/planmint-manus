import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
  article?: {
    publishedTime?: string;
    author?: string;
    section?: string;
  };
}

export const SEOHead = ({
  title,
  description,
  canonical,
  ogImage = 'https://planmint.app/og-image.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
  article,
}: SEOHeadProps) => {
  const fullTitle = title.includes('PlanMint') ? title : `${title} | PlanMint`;
  const siteUrl = 'https://planmint.app';
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : undefined;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to update/create meta tags
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Basic meta tags
    setMeta('description', description);
    
    // Robots
    if (noIndex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }

    // Open Graph
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:image', ogImage, true);
    setMeta('og:site_name', 'PlanMint', true);
    if (canonicalUrl) {
      setMeta('og:url', canonicalUrl, true);
    }

    // Article specific OG tags
    if (article && ogType === 'article') {
      if (article.publishedTime) {
        setMeta('article:published_time', article.publishedTime, true);
      }
      if (article.author) {
        setMeta('article:author', article.author, true);
      }
      if (article.section) {
        setMeta('article:section', article.section, true);
      }
    }

    // Twitter
    setMeta('twitter:card', twitterCard);
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);
    setMeta('twitter:site', '@planmintapp');

    // Canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonicalUrl) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    } else if (canonicalLink) {
      canonicalLink.remove();
    }

    return () => {
      // Cleanup on unmount if needed
    };
  }, [fullTitle, description, canonicalUrl, ogImage, ogType, twitterCard, noIndex, article]);

  return null;
};
