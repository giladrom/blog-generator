# Automatic Blog Generator for Shopify using OpenAI/GPT3 and Google Custom Search

### Requirements

1. OpenAI Account
2. Google Custom Search Engine API key
3. Shopify API Key with article permissions
4. (Optional) Unsplash API Key

### Setup

Create a .env file with the following:

```
OPENAI_API_KEY=<OpenAI API Key>
SHOP=<Shopify store URL>
SHOP_API_KEY=<Shopify store API Key>
UNSPLASH_API_KEY=<Unsplash API Key>
GOOGLE_SEARCH_API_KEY=<Custom search engine API Key>
GOOGLE_SEARCH_ENGINE_ID=<Custom Search engine ID>
BLOG_AUTHOR=<Your name>
```

### Running

```
node index.js
```
