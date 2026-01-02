#!/usr/bin/env node

/**
 * Product Link Enrichment Script
 *
 * Fetches product schema data from URLs in gifts.json and enriches links with:
 * - Product name
 * - Price
 * - Image
 * - Brand/Author
 *
 * Amazon Handling:
 * Amazon doesn't use standard JSON-LD Product schemas, so this script uses
 * custom HTML selectors to extract data. Amazon may block automated requests.
 *
 * Alternatives for Amazon:
 * - Use Amazon Product Advertising API (https://webservices.amazon.com/paapi5/documentation/)
 * - Use SerpAPI (https://serpapi.com/) for reliable Amazon data extraction
 * - Use npm packages like 'amazon-product-api' or 'amazon-product-data-scraper'
 *
 * Note: Amazon actively blocks scrapers. For production use, consider using
 * their official API or a paid service.
 */

import { readFile, writeFile } from 'fs/promises';
import { load } from 'cheerio';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isAmazonUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('amazon.');
  } catch {
    return false;
  }
}

async function extractAmazonProduct($) {
  const schema = {
    '@type': 'Product',
  };

  // Extract title
  const title = $('#productTitle').text().trim() ||
                $('#ebooksProductTitle').text().trim();
  if (title) {
    schema.name = title;
  }

  // Extract price - try multiple selectors
  let price = $('.a-price .a-offscreen').first().text().trim();
  if (!price) {
    price = $('#kindle-price').text().trim();
  }
  if (!price) {
    price = $('#price_inside_buybox').text().trim();
  }
  if (!price) {
    price = $('#priceblock_ourprice').text().trim();
  }
  if (!price) {
    price = $('#priceblock_dealprice').text().trim();
  }
  if (!price) {
    price = $('.a-color-price').first().text().trim();
  }

  if (price) {
    // Remove currency symbol and extract numeric value
    const priceMatch = price.match(/[\d.,]+/);
    if (priceMatch) {
      schema.offers = {
        price: priceMatch[0].replace(',', ''),
        priceCurrency: 'USD',
      };
    }
  }

  // Extract image
  const image = $('#landingImage').attr('data-old-hires') ||
                $('#landingImage').attr('src') ||
                $('#imgBlkFront').attr('src') ||
                $('#ebooksImgBlkFront').attr('src') ||
                $('#main-image').attr('src');

  if (image && !image.includes('data:image')) {
    schema.image = image;
  }

  // Extract brand/author
  const brand = $('#bylineInfo').text().trim() ||
                $('.author .contributorNameID').text().trim() ||
                $('.author a').first().text().trim() ||
                $('#brand').text().trim();

  if (brand) {
    // Clean up "by " or "visit the " prefixes
    const cleanBrand = brand.replace(/^(by|visit the)\s+/i, '').trim();
    if (cleanBrand) {
      schema.brand = { name: cleanBrand };
    }
  }

  // Return null if we didn't extract any meaningful data
  if (!schema.name && !schema.offers && !schema.image) {
    return null;
  }

  return schema;
}

async function fetchProductSchema(url) {
  try {
    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Check if this is an Amazon URL and use custom extractor
    if (isAmazonUrl(url)) {
      console.log('Using Amazon-specific extractor');
      return await extractAmazonProduct($);
    }

    // Find all JSON-LD scripts for non-Amazon sites
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      try {
        const content = $(scripts[i]).html();
        if (!content) continue;

        const jsonData = JSON.parse(content);

        // Handle both single objects and arrays
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const item of items) {
          // Check if this is a Product schema or contains a Product
          if (item['@type'] === 'Product') {
            return extractProductData(item);
          }

          // Check for nested Product in @graph
          if (item['@graph']) {
            const product = item['@graph'].find(node => node['@type'] === 'Product');
            if (product) {
              return extractProductData(product);
            }
          }
        }
      } catch (parseErr) {
        console.error(`Error parsing JSON-LD: ${parseErr.message}`);
      }
    }

    console.log(`No Product schema found for ${url}`);
    return null;
  } catch (err) {
    console.error(`Error fetching ${url}: ${err.message}`);
    return null;
  }
}

function extractProductData(product) {
  const schema = {
    '@type': 'Product',
    name: product.name || '',
  };

  if (product.image) {
    // Handle image as string or array or object
    if (typeof product.image === 'string') {
      schema.image = product.image;
    } else if (Array.isArray(product.image)) {
      schema.image = product.image[0];
    } else if (product.image.url) {
      schema.image = product.image.url;
    }
  }

  if (product.brand) {
    if (typeof product.brand === 'string') {
      schema.brand = { name: product.brand };
    } else if (product.brand.name) {
      schema.brand = { name: product.brand.name };
    }
  }

  if (product.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;

    if (offer.price || offer.lowPrice) {
      schema.offers = {
        price: String(offer.price || offer.lowPrice || ''),
        priceCurrency: offer.priceCurrency || 'USD',
      };
    }
  }

  return schema;
}

async function enrichLinks() {
  try {
    // Read gifts.json
    const giftsData = JSON.parse(await readFile('public/data/gifts.json', 'utf-8'));
    let hasChanges = false;

    const now = new Date();

    for (const gift of giftsData.gifts) {
      for (const link of gift.links) {
        // Skip if schema was fetched less than 7 days ago
        if (link.schemaFetchedAt) {
          const fetchedDate = new Date(link.schemaFetchedAt);
          const daysSinceFetch = (now - fetchedDate) / SEVEN_DAYS_MS;

          if (daysSinceFetch < 1) {
            console.log(`Skipping ${link.url} (fetched ${daysSinceFetch.toFixed(1)} days ago)`);
            continue;
          }
        }

        // Fetch and update schema
        const schema = await fetchProductSchema(link.url);

        if (schema) {
          link.schema = schema;
          link.schemaFetchedAt = now.toISOString();
          hasChanges = true;
          console.log(`✓ Enriched: ${schema.name}`);
        }

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (hasChanges) {
      await writeFile('public/data/gifts.json', JSON.stringify(giftsData, null, 2) + '\n');
      console.log('\n✓ gifts.json updated with enriched data');
    } else {
      console.log('\nNo updates needed');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

enrichLinks();
