export default {
    methods: {
        getDataFromCarousel: function(parentBook, audible, key, carouselID) {
            // Find the carousel element
            if (!audible || typeof audible.querySelector !== "function") {
                console.error("Invalid 'audible' for querySelector:", audible);
                return;
            }
            const carousel = audible.querySelector('adbl-product-carousel[skip-link-title="Listeners also enjoyed..."]');
            console.log("Carousel found:", !!carousel);

            if (!carousel) {
                console.warn("No carousel found for", key, "on", parentBook && parentBook.asin);
                return;
            }

            const books = [];
            // Guard: carousel is always a DOM element here
            const flyouts = carousel.querySelectorAll(".carousel-product");

            _.each(flyouts, function(el) {
                if (!el || typeof el.querySelector !== "function") {
                    console.error("Invalid element 'el' for querySelector in flyouts:", el);
                    return;
                }

                const book = {};

                // image
                let imageEl = null;
                if (el && typeof el.querySelector === "function") {
                    imageEl = el.querySelector('[id^="product-carousel-image"]');
                }
                let image = imageEl ? (imageEl.getAttribute("src") || imageEl.getAttribute("data-lazy")) : null;
                if (!image) return false;

                let coverId = image.match(/\/images\/I\/(.*)._SL/);
                if (coverId && coverId[1]) coverId = "" + DOMPurify.sanitize(coverId[1]);
                if (!coverId) return false;
                book.cover = coverId;

                // bookASIN
                let bookASINEl = null;
                if (el && typeof el.querySelector === "function") {
                    bookASINEl = el.querySelector("[data-asin]");
                }
                let bookASIN = bookASINEl ? bookASINEl.getAttribute("data-asin") : null;
                if (bookASIN) bookASIN = "" + DOMPurify.sanitize(bookASIN);
                if (!bookASIN) return false;
                book.asin = bookASIN;

                // flyout list and subheading
                let list = null;
                if (el && typeof el.querySelector === "function") {
                    list = el.querySelector("[id^=product-list-flyout] ul");
                }
                let listItems = null, subHeading = null;
                if (list && typeof list.querySelectorAll === "function") {
                    listItems = list.querySelectorAll("li:not(.bc-size-base)");
                    if (typeof list.querySelector === "function") {
                        subHeading = list.querySelector("li.bc-size-base:nth-child(2)");
                        if (subHeading && typeof subHeading.querySelector === "function") {
                            let shTrailingComma = subHeading.querySelector('.bc-pub-offscreen');
                            if (shTrailingComma && typeof shTrailingComma.remove === "function") shTrailingComma.remove();
                        }
                        if (subHeading && typeof subHeading.textContent === "string") {
                            subHeading = subHeading.textContent;
                            subHeading = DOMPurify.sanitize(subHeading.trim());
                            if (subHeading) book.subHeading = subHeading;
                        }
                    }
                }

                if (listItems) {
                    _.each(listItems, function(liEl, i) {
                        if (!liEl || typeof liEl.querySelector !== "function") {
                            console.error("Invalid element 'liEl' for querySelector in listItems:", liEl);
                            return;
                        }
                        // trailing comma
                        let trailingComma = null;
                        if (liEl && typeof liEl.querySelector === "function") {
                            trailingComma = liEl.querySelector('.bc-pub-offscreen');
                        }
                        if (trailingComma && typeof trailingComma.remove === "function") trailingComma.remove();

                        let text = liEl.textContent;
                        if (text) text = DOMPurify.sanitize(text.trimAll && text.trimAll() || text.trim());
                        if (text && (!liEl.querySelector("h2")) && text.trimToColon) text = text.trimToColon();
                        if (!text) return false;

                        var line = i + 1;
                        switch (line) {
                            case 1:
                                book.title = text;
                                break;
                            case 2:
                                book.authors = text;
                                break;
                            case 3:
                                book.narrators = text;
                                break;
                            case 4:
                                book.length = text;
                                break;
                        }
                    });
                }

                books.push(book);

            });

            if (books.length > 0) parentBook[key] = books;

        },
    }
};