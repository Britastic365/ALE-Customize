// Log before and after carousel selector
const carousel = audible.querySelector('adbl-product-carousel[skip-link-title="Listeners also enjoyed..."]');
console.log("Carousel found:", !!carousel);

if (!carousel) {
    console.warn("No carousel found for", key, "on", parentBook && parentBook.asin);
    return;
}

// (rest of your code, add more logs as needed)