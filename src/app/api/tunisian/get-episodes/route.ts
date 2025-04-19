import { JSDOM } from 'jsdom';

export async function POST(req, res) {
  const { link } = await req.json();

  const scrapePage = async (url) => {
    try {
      const response = await fetch('https://www.tunigazelle-news.xyz' + url);
      const data = await response.text();

      const dom = new JSDOM(data);
      const document = dom.window.document;

      // Get page title for the series
      const pageTitle = document.querySelector('.blog-title')?.textContent?.trim() || '';
      
      const episodes = [];
      const postItems = document.querySelectorAll('.post');

      postItems.forEach((post) => {
        const titleElement = post.querySelector('.entry-title a');
        const imageElement = post.querySelector('.post-body img');
        
        if (titleElement) {
          const title = titleElement.textContent.trim();
          const link = titleElement.href;
          const image = imageElement ? imageElement.src : null;
          
          if (title && link) {
            episodes.push({ title, link, image });
          }
        }
      });

      const nextLink = document.querySelector('.loadMore a.blog-pager-older-link');
      const nextUrl = nextLink ? nextLink.href : null;

      console.log('Next URL:', nextUrl);

      return { episodes, nextUrl };
    } catch (error) {
      console.error('Error scraping page:', error);
      throw error;
    }
  };

  try {
    let allEpisodes = [];
    let currentPageUrl = link;

    let iterationCount = 0;
    const maxIterations = 10;

    while (currentPageUrl && iterationCount < maxIterations) {
      const { episodes, nextUrl } = await scrapePage(currentPageUrl);
      allEpisodes = [...allEpisodes, ...episodes];

      currentPageUrl = nextUrl || null;

      iterationCount++;
    }

    allEpisodes = allEpisodes.reverse();

    // Get the title from the first page
    const pageTitle = document.querySelector('.blog-title')?.textContent?.trim() || 'Episodes';
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        episodes: allEpisodes,
        title: pageTitle 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping episodes:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to scrape episodes' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
