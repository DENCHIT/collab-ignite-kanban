/**
 * Converts URLs in text to clickable HTML links
 */
export function linkifyText(text: string): string {
  // URL regex pattern that matches http/https URLs
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  
  return text.replace(urlRegex, (url) => {
    // Clean up URL by removing trailing punctuation that's likely not part of the URL
    const cleanUrl = url.replace(/[.,;:!?)]$/, '');
    const trailingPunctuation = url.slice(cleanUrl.length);
    
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 underline underline-offset-2">${cleanUrl}</a>${trailingPunctuation}`;
  });
}