// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

const Apify = require("apify");

Apify.main(async () => {
  // Get input of the actor.
  // If you'd like to have your input checked and generate a user interface
  // for it, add INPUT_SCHEMA.json file to your actor.
  // For more information, see https://apify.com/docs/actor/input-schema
  const input = await Apify.getInput();

  if (!input || !input.url)
    throw new Error(
      'Invalid input, must be a JSON object with the "url" field!'
    );

  console.log("Launching Puppeteer...");
  const browser = await Apify.launchPuppeteer();
  const page = await browser.newPage();

  const reviews = [];
  const data = {};
  let currentPage = 0;
  let hasNextPage = false;
  do {
    currentPage++;

    // Go to next page
    await page.goto(
      currentPage == 1 ? input.url : `${input.url}?page=${currentPage}`
    );
    await page.waitFor(1000);

    // Fetch content
    const content = await page.evaluate(async () => {
      const name = document.querySelector(".header__title").textContent;
      const category = document.querySelector(
        ".venue__category > .category__text"
      ).textContent;
      const totalRating = document
        .querySelector(".details__list")
        .querySelectorAll("meta")[1]
        .getAttribute("content");

      const reviews = [];
      const reviewsSelector = document.querySelectorAll(
        ".reviews > .comment__item"
      );
      for (review of reviewsSelector) {
        const rating = review.getAttribute("data-rating");
        const title = review
          .querySelector(".comment__title")
          .textContent.replace(" - Edit", "");
        const text = review.querySelector(".ellipsis__reviews").textContent;
        const author = review.querySelector(".media__title").textContent;
        reviews.push({
          rating,
          title,
          text,
          author
        });
      }
      const hasNextPage = !document
        .querySelector(".pagination__item.next")
        .classList.contains("disabled");

      return {
        name,
        category,
        totalRating,
        reviews,
        hasNextPage
      };
    });

    if (currentPage == 1) {
      data.name = content.name;
      data.category = content.category;
      data.totalRating = content.totalRating;
    }
    hasNextPage = content.hasNextPage;
    reviews.push(...content.reviews);
  } while (hasNextPage);

  console.log('Closing Puppeteer...');
  await browser.close();

  // Save output
  const output = {
    ...data,
    reviews
  };
  console.log("Output:");
  console.dir(output);
  await Apify.setValue("OUTPUT", output);
});
