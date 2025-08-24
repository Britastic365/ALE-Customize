//replaced each mention of hotpotato.wishlist with hotpotato.books to save wishlist data with library data so it would be processed the same by process-series-pages.js
export default {
  methods: {
    getDataFromWishlist: function(hotpotato, wishlistFetched) {
      if ( !_.find(hotpotato.config.steps, { name: "wishlist" }) ) {
        
        this.$store.commit("resetProgress");
        wishlistFetched(null, hotpotato);
        
      } else {
        
        
        this.$store.commit('update', [
          { key: 'bigStep.step', value: 0 },
        ]);
        
        this.$store.commit('update', [
          { key: 'bigStep.title', value: 'Wishlist' },
          { key: 'bigStep.step', add: 1 },
          { key: 'subStep.step', value: 1 },
          { key: 'subStep.max', value: 2 },
          { key: 'progress.text', value: this.$store.state.storageHasData.wishlist ? "Updating old books and adding new books..." : "Scanning wishlist for books..." },
          { key: 'progress.step', value: 0 },
          { key: 'progress.max', value: 0 },
        ]);

        const vue = this;
        waterfall(
          [
            function(callback) {
              vue.scrapingPrep({
                url: vue.wishlistUrl,
                returnResponse: true,
                returnAfterFirstCall: true,
                done: function(prep) {
                  const html = _.get(prep, "response.data");
                  if ( !html ) callback(null, prep);
                  
                  const audible = $($.parseHTML( html )).find("div.adbl-main")[0];
                  const wishlistLengthEl = audible.querySelector('.adbl-library-refinement-section > div:nth-child(1) span');
                  let wishlistLength = wishlistLengthEl ? wishlistLengthEl.textContent : null;
                  if ( wishlistLength ) wishlistLength = parseFloat( DOMPurify.sanitize(wishlistLength.match(/\d+/)[0]) )
                  delete prep.response;
                  
                  // Forcing smaller pageSize...
                  // - Wishlist pages load a bit faster with less items. I had hopes loading pages with fewer items in parallel would be faster, but it wasn't really in my test.
                  // prep.pageSize = 20;
                  // prep.urlObj.query.pageSize = prep.pageSize;

                  const pagesLength = prep.pageSize ? Math.ceil(wishlistLength / prep.pageSize) : 1;
                  prep.pageNumbers = _.range(1, pagesLength + 1);

                  callback(null, prep);
                  
                }
              }); // Stopping after the first call then doing some sleuthing around to figure out the amount of pages to scrape, rather than doing a second call (just because wisthlist loads super slow)
            },

            function(prep, callback) {
              vue.amapxios({
                requests: _.map(prep.pageNumbers, function(page) {
                  prep.urlObj.query.page = page;
                  return prep.urlObj.toString();
                }),
                step: function(response, stepCallback) {
                  vue.getBooksWishlist(response, hotpotato, stepCallback);
                },
                flatten: true,
                done: function(books) {
                  callback(null, books);
                }
              });
            }
          ],
          function(err, books) {

            if ( books.length ) hotpotato.books = (hotpotato.books || []).concat(books); //replaced .wishlist with .books to add to books, not replace it
            
            vue.$nextTick(function() {
              hotpotato.config.getStorePages = 'wishlist';
              wishlistFetched(null, hotpotato);
            });
            
          }
        );
      }
    },
    
    getBooksWishlist: function(response, hotpotato, completeStep) {
      let vue = this;
      const audible = $($.parseHTML(response.data)).find("div.adbl-main")[0];
      response.data = null;
      const wishlist = [];
    
      const wishlistRows = audible.querySelectorAll('#adbl-library-content-main li.productListItem');
      $(wishlistRows).each(function() {
        const _thisRow = this;
        
        let asin  = _thisRow.querySelector('[data-asin]');
        if (  asin ) asin = asin.getAttribute("data-asin");
        if ( !asin ) {
          asin = _thisRow.querySelector('[id^="product-list-flyout-"]');
          if ( asin ) asin = asin.getAttribute('id').replace('product-list-flyout-', '');
        }
        asin  = DOMPurify.sanitize( asin );
        
        let carryOnMyWaywardPines = hotpotato.books ? !_.find( hotpotato.books, { asin: asin }) : true; //replaced .wishlist with .books
        if ( carryOnMyWaywardPines ) {
          
          let bookInMemory = _.find(hotpotato.books, ["asin",  asin]);
          let fullScan_ALL_partialScan_NEW = (vue.$store.state.storageHasData.wishlist && !bookInMemory) || !vue.$store.state.storageHasData.wishlist;
          let book = vue.$store.state.storageHasData.wishlist && bookInMemory ? bookInMemory : {};
          
          book.asin = asin;
          
          let title = _thisRow.querySelector(":scope > div:nth-child(1) > div > div > div > div > div > span > ul > li:nth-child(1) > a");
          if ( title ) {
            let bookAddress = title.getAttribute("href");
                bookAddress = DOMPurify.sanitize(bookAddress);
            let storePageUrl = new Url( window.location.origin + bookAddress );
            storePageUrl.clearQuery();
            book.storePageRequestUrl = storePageUrl.toString();
          }
          
          if ( fullScan_ALL_partialScan_NEW ) {
            
            // SUBTITLE
            const subtitle = _thisRow.querySelector(":scope > div:nth-child(1) > div > div > div > div > div > span > ul > li:nth-child(2) > span.bc-color-secondary");
            if ( subtitle ) book.subtitle = DOMPurify.sanitize( subtitle.textContent.trimAll() );
            // SHORT TITLE
            if ( title ) {
              title = title.textContent.trimAll();
              book.titleShort = DOMPurify.sanitize( title );
              // FULL TITLE
              book.title = book.subtitle ? (title +': '+ book.subtitle) : title;
            }
            
            // SAMPLE
            const sample = _thisRow.querySelector("[data-mp3]");
            if (sample) book.sample = DOMPurify.sanitize( sample.getAttribute("data-mp3") );
            
            // SERIES
            const series = _thisRow.querySelector(".seriesLabel > span");
            if ( series ) book.series = vue.getSeries( series );
            // if ( series ) book.series = vue.getSeries( series, 'reverseOutput');
            
            // LENGTH
            const length = _thisRow.querySelector(".runtimeLabel > span");
            if (length) book.length = vue.shortenLength( length.textContent );
            
            // RELEASE DATE
            const releaseDate = _thisRow.querySelector(".releaseDateLabel > span");
            if (releaseDate) book.releaseDate = vue.fixDates( releaseDate );
            
            // AUTHORS
            const authors = _thisRow.querySelectorAll(".authorLabel > a");
            if (authors.length > 0) book.authors = vue.getArray(authors);
            
            // NARRATORS
            const narrators = _thisRow.querySelectorAll(".narratorLabel > a");
            if (narrators.length > 0) book.narrators = vue.getArray(narrators);
            
            const language = _thisRow.querySelector(".languageLabel");
            if ( language ) book.language = DOMPurify.sanitize(language.textContent.trimToColon());
            
          }
          
          // COVER
          const coverWrapper = _thisRow.querySelector('[data-trigger^="product-list-flyout"]');
          if ( coverWrapper ) {
            let coverLink = coverWrapper.querySelector(':scope > a');
            if ( coverLink ) {
              let coverUrl = coverLink.getAttribute('src');
              if ( !coverUrl ) {
                const coverImg = coverLink.querySelector(':scope > img');
                if ( coverImg ) coverUrl = coverImg.getAttribute('src');
              }
              coverUrl = DOMPurify.sanitize( coverUrl );
              if ( coverUrl && coverUrl.lastIndexOf("img-coverart-prod-unavailable") < 0 ) {
                let coverId = coverUrl.match(/\/images\/I\/(.*)._SL/);
                    coverId = _.get( coverId, '[1]');
                if ( coverId ) book.cover = coverId;
              }
            }
          }
          
          const ratingsWrappers = _thisRow.querySelector(".ratingsLabel");
          if ( ratingsWrappers ) {
            const starsWrapper = _thisRow.querySelector(".bc-review-stars");
            if ( starsWrapper ) {
              const ratingSpan   = starsWrapper.nextElementSibling;
              const ratingsSpan  = ratingSpan.nextElementSibling;
              // RATING
              book.rating = Number( DOMPurify.sanitize(ratingSpan.textContent.match(/^\d\.?(\d)?/g)) ); // returns the first number
              // RATINGS
              let ratings = ratingsSpan.textContent;
              if ( ratings ) {
                ratings = DOMPurify.sanitize(ratings);
                ratings = ratings.match(/\d/g);
                ratings = _.isArray(ratings) ? _.join(ratings, '') : ratings;
                ratings = parseFloat(ratings);
                book.ratings = ratings;// returns all numbers merged into one
              }
            }
          }
          
          // From plus catalog
          const fromPlusCatalog = _thisRow.querySelector('.discovery-add-to-library-button');
          if (fromPlusCatalog) book.fromPlusCatalog = true;
          
          const getPrice = ( el ) => {
            
            // If "el" is a string, then use it as a selector
            // otherwise, assume it's a DOM element already.
            el = _.isString(el) ? _thisRow.querySelector(el) : el;
            
            // Abort if element is not found
            if ( !el ) return;

            let price = el.textContent;
                price = DOMPurify.sanitize(price);
                price = price.trimAll(); // Trim all extra whitespace
                price = price.match(/\d+(\.|\,)?/gm); // Get all numbers
                price = _.isArray(price) ? _.join(price, '') : price; // Merge all numbers — Note: the previous matching step catches commas and periods, so they are not needed when joining.
                price = parseFloat(price); // Convert string into a number
                
            return price;
            
          };
          
          const buyBox = _thisRow.querySelector('#adbl-buy-box-container');
          const regularPriceEl = !buyBox ? null : buyBox.querySelector('[id^="buybox-regular-price"]');
          const useMemberPrice = !regularPriceEl ? null : regularPriceEl.querySelector(':scope > span.bc-text-strike');
          const memberPriceEl  = !buyBox ? null : buyBox.querySelector(' [id^="buybox-member-price"]');
          
          if ( !useMemberPrice && regularPriceEl ) {
            
            const regularPrice = getPrice( regularPriceEl );
            if ( regularPrice > -1 ) book.price = regularPrice;
            
          }
          else if ( useMemberPrice && memberPriceEl ) {
            
            const memberPrice = getPrice( memberPriceEl.querySelector('.bc-color-price') );
            if ( memberPrice > -1 ) book.price = memberPrice;
            
          }
          
          // On sale
          let saleEnded;
          const saleEndedEl = _thisRow.querySelector('.adblSaleHasEnded');
          if ( saleEndedEl ) {
            let saleEndedAttribute = saleEndedEl.getAttribute('hidden');
            if ( saleEndedAttribute ) saleEndedAttribute = DOMPurify.sanitize(saleEndedAttribute);
            saleEnded = !_.isNil(saleEndedAttribute) && saleEndedAttribute != false;
          }
          const saleContainer = _thisRow.querySelector('.adblSaleTimerContainer');
          
          if ( saleContainer && !saleEnded) book.onSale = true;
          if ( saleContainer ) {
            
            const salePrice = _thisRow.querySelector('[id^="buybox-sale-price"]')
            if ( salePrice ) {
              const salePercentage = salePrice.querySelector('.sale-discount-percentage');
              if ( salePercentage ) {
                const salePriceEl = salePercentage.previousElementSibling;
                if ( salePriceEl ) {
                  
                  const salePrice = getPrice(salePriceEl);
                  if ( salePrice > -1 ) book.price = salePrice;
                  
                }
              }
            }
          }
          
          book = _.omitBy(book, _.isNil);
          
          // - - - - - - -
          
          if ( vue.$store.state.storageHasData.books ) {
            let newAddition = !bookInMemory;
            let newFromStorage = bookInMemory && bookInMemory.isNew;
            if ( newAddition || newFromStorage ) book.isNew = true;
          }
          
          if (fullScan_ALL_partialScan_NEW) {
            book.isNewThisRound = true;
            vue.$store.commit('update', { key: 'progress.max', add: 1 });
          }
          
          wishlist.push(book);
          
        }
        
      });
      
      completeStep(wishlist);
      
    },
        
  }
};
