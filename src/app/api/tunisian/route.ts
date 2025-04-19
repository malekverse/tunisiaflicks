import { JSDOM } from 'jsdom';

export async function GET(req, res) {
  try {
    // Fetch the HTML content of the page using the native fetch API
    const response = await fetch('https://www.tunigazelle-news.xyz');
    const data = await response.text();

    // Parse the HTML using jsdom
    const dom = new JSDOM(data);
    const document = dom.window.document;

    // Select the elements containing the data you want to scrape
    const widgets = document.querySelectorAll('.widget.Image');
    const movieData = [];

    widgets.forEach((widget) => {
      const titleElement = widget.querySelector('.headline .title');
      const linkElement = widget.querySelector('.widget-content a');
      const imageElement = widget.querySelector('.widget-content img');

      // Extract the data from the elements
      const title = titleElement ? titleElement.textContent.trim() : null;
      const link = linkElement ? linkElement.href : null;
      const image = imageElement ? imageElement.src : null;

      // Add the scraped data to the array
      if (title && link && image) {
        movieData.push({ title, link, image });
      }
    });

    // Send the scraped data as a response
    return new Response(
      JSON.stringify({ success: true, results: movieData }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping website:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to scrape data' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
