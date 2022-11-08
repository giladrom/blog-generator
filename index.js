import { Configuration, OpenAIApi } from "openai";
import Dotenv from "dotenv";
import { createApi } from "unsplash-js";
import * as cheerio from "cheerio";
import random from "random";
import pThrottle from "p-throttle";

// Local imports
import { dogBreeds } from "./breeds.js";

// TODO: Train AI with previous blog posts
// TODO: Get consistent HTML out of OpenAI
// TODO: Find affordable keyword database for post optimization

//* Initialize throttling so we don't hit the Google API limit
//* 1 query every 2 seconds
const throttle = pThrottle({
  limit: 1,
  interval: 2000,
});

//* Read .env parameters into process.env
Dotenv.config();

//* Initialize OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

//* Initialize Unsplash
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_API_KEY,
  fetch: fetch,
});

//* Post Blog article to Shopify

function post_article(title, html, photos) {
  return new Promise(async (resolve, reject) => {
    const $ = cheerio.load(html, null, false);

    const response = await fetch(
      `https://${process.env.SHOP}/admin/api/2022-10/blogs.json`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOP_API_KEY,
        },
      }
    );
    const data = await response.json();
    const blog_id = data.blogs[0].id;

    const article_title = $("h1").text();
    if (article_title.length > 0) {
      $("h1").remove();
      title = article_title;
    }

    const article = {
      article: {
        blog_id: blog_id,
        title: title,
        author: "Gilad Rom",
        tags: "dogs, puppies, advice, health, tips, care",
        body_html: $.html(),
        published: false,
        // handle: "breeds/my-new-blog-test",
        // image: {
        //   src: photos.response.results[0].urls.regular,
        //   alt: photos.response.results[0].alt_description,
        // },
        image: {
          src: photos[0],
        },
      },
    };

    fetch(
      `https://${process.env.SHOP}/admin/api/2022-10/blogs/241253187/articles.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOP_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(article),
      }
    )
      .then(async (res) => {
        resolve(await res.json());
      })
      .catch((error) => {
        reject(error.errors);
      });
  });
}

//* Generate article text using OpenAI

function generate_article(prompt) {
  return new Promise((resolve, reject) => {
    openai
      .createCompletion({
        model: "text-davinci-002",
        prompt: prompt,
        temperature: 0.3,
        max_tokens: 4000 - prompt.length,
        n: 1,
      })
      .then((completion) => {
        resolve(completion.data.choices);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//* Retrieve a list of subject photos from Unsplash
//! NOTE: Unsplash does not have enough photos for every subject
function get_photos_from_unsplash(subject) {
  return new Promise((resolve, reject) => {
    unsplash.search
      .getPhotos({
        query: subject,
        page: 1,
        perPage: 20,
        // orientation: "landscape",
        // content_filter: "high",
        orderBy: "relevant",
      })
      .then((res) => {
        // TODO: normalize response to match Google search result

        console.log(res.response.results);
        resolve(res);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//* Retrieve a list of subject photos from Google
//  TODO: properly scale images so they fit the full-page width.

function get_photos_from_google(subject) {
  return new Promise((resolve, reject) => {
    const google_url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&searchType=image&safe=active&num=10&imgSize=large&q=${subject}`;

    fetch(google_url)
      .then(async (res) => {
        var body = await res.json();

        console.log(google_url);

        console.log(body);
        const urls = body.items.map((item) => {
          return item.link;
        });
        resolve(urls);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//* Return formatted html img tag

function img(photos, index) {
  //* Unsplash
  // const photo_object = photos.response.results[index + 1];
  // const attr = `<p>Photo by <a href="${photo_object.user.links.html}?utm_source=blog_generator&utm_medium=referral">${photo_object.user.name}</a> on <a href="https://unsplash.com/?utm_source=blog_generator&utm_medium=referral">Unsplash</a></p>`;

  // return img_tag + attr;

  //* Google
  const img_tag = `<img src="${photos[index + 1]}">`;
  return img_tag;
}

//* Insert img tag inside HTML document
//  TODO: Space out photos properly

function add_photos_to_html(html, photos) {
  const $ = cheerio.load(html, null, false);
  var elem = true;

  if ($("h2").length > 1) {
    $("h2").each((i, elem) => {
      var img_tag = img(photos, i);
      $(elem).before(img_tag);
    });
  } else {
    $("p").each((i, elem) => {
      var img_tag = img(photos, i);
      $(elem).before(img_tag);
    });
  }

  return $.html();
}

//* Execute all queries inside a throttle function

const throttled = throttle(async (breed) => {
  const prompt = `Write a long form blog post in the style of Taylor Lorenz about how to care for a ${breed} puppy and their breed specific needs, health issues and diet. Output as html: <html>
`;

  console.log(`Getting photos for ${breed}...`);

  const photos = await get_photos_from_google(`${breed} dog`);

  console.log(`Generating article for ${breed}...`);

  generate_article(prompt)
    .then((article) => {
      // console.log("*** OPENAI OUTPUT ***");
      // console.log(article[0].text);
      // console.log("*** OPENAI OUTPUT ***");

      console.log("Adding photos...");
      const html = add_photos_to_html(article[0].text, photos);
      // console.log("*** WITH IMAGES ***");
      // console.log(html);
      // console.log("*** WITH IMAGES ***");

      console.log("Posting article");
      const title = `What you should know before adopting a ${breed} puppy`;
      post_article(title, html, photos)
        .then((res) => {
          console.log(res);
        })
        .catch((error) => {
          console.error(error);
        });
    })
    .catch((error) => {
      console.error(error);
    });
});

dogBreeds.forEach(async (breed) => {
  (async () => {
    console.log(await throttled(breed));
  })();
});
