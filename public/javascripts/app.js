/*
 * app.js
 * 
 * Core application code for the bicycle routing map.
 * 
 * Copyright (c) 2011 Matt Schemmel
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of 
 * this software and associated documentation files (the "Software"), to deal in the 
 * Software without restriction, including without limitation the rights to use, 
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the 
 * Software, and to permit persons to whom the Software is furnished to do so, 
 * subject to the following conditions:
 *  - The above copyright notice and this permission notice shall be included in 
 *    all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE 
 * OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function() {
  // Module shared variables.
  //  These variables are global in scope and should be checked for validity
  //  prior to usage.
    /// Single instance of the google maps geocoder that will be used to translate
    /// street addresses into lat/long coordinates
    var geocoder = new google.maps.Geocoder();
    /**
     * Holder for the result of the browser geolocation method.
     * 
     * @undefined Prior to the first invocation of the geolocator.
     * @null If geolocation fails for any reason, including permission denial.
     */ 
    var browserGeolocation;
    /**
     * Reference to the Google map object encapsulating the displayed map. 
     */
    var map;
    /**
     * Reference to the directions renderer used to overlay the routing
     *  directions on the underlying map. Persisted as a module-private
     *  method so that the rendering options may be updated on the fly.
     *  (There does not seem to be a random-access method to retrieve
     *  the renderer from the map reference itself).
     */
    var renderer;

  // CONSTANTS
    // Geographical center of the United States (not really accurate)
    var US_CENTER = new google.maps.LatLng(37.3002752813443, -93.33984375);

    // Attribute names
    var ATTR_LOCATION = "location";
    
    // Cookie names and constant values. Usage TBD
    var COOKIE_CENTER = "app-center"; // Cookie value provides the text and lat/long of the center of the map
    var COOKIE_ZOOM = "app-zoom"; // Cookie value provides the zoom level.

  // METHOD DEFINITIONS  
    /**
     * Utility method for logging a single message to the console, if available.
     * 
     * @param {Object} message
     * 
     * TODO Integrate an existing jQuery logging library.
     * TODO Determine whether are any common build scripts for stripping "log"
     *       functions from JS files.
     * TODO How does Rails handle differences between development and production scripts?
     */
    function log ( message ) {
        if(console) { console.log(message); }
    }

    /**
     * Toggles the visbility of the map directions controls. Used to maximize the
     *  amount of space available to the map display itself.
     */
    function toggleControls() {
        var controlBody = $('#controls > .bd');
        
        // If the main control area is open, toggle it closed; otherwise,
        //  toggle it open.
        var isVisible = controlBody.filter(':visible').length;
        
        if ( isVisible ) {
            controlBody.slideUp(100, function() {
               // On completion of the slide-up, flip the image.
               // Ideally, this would probably be on the controls section rather
               //  than directly modifying the utton's own class.
                $('#toggle-button').removeClass("open").addClass("closed");
            });
            
        } else {
            // Animate the opening.
            controlBody.slideDown(100, function() {
                // On completion of the slide-down, flip the image.
                $('#toggle-button').removeClass("closed").addClass("open");
            });
        }
    }
    
    /**
     * Clear the error status from the given element.
     * @param {Object} el DOM element
     */
    function clearError ( el ) {
        $(el).removeClass("status-error");
        $(el).addClass("status-ok");
    }

    /**
     * Displays the given error message on the error message holder
     *  ocntained within the given <code>el</code>.
     * @param {Object} el DOM element.
     * @param {Object} message The error message to be displayed. May contain
     *                         HTML formatting.
     */
    function displayError ( el, message ) {
        $(".errorMessage", el).html(message);
        $(el).removeClass("status-ok").addClass("status-error");
    }
    
    /**
     * Close all 'help' dialogs. To be used by triggers that
     *  represent nontrivial user interaction with the page
     */
    function closeHelpDialogs() {
        $("a[rel='boxy']").each(function(idx, el) {
            var boxy = Boxy.linkedTo(el);
            
            if ( boxy ) {
                boxy.hide();
            }
        });
    }

    /**
     * Clear the cached address data associated with area of the page.
     * 
     * @param {Object} this DOM element - event trigger
     * 
     * TODO - Should this be part of the validation mechanism?
     */
    function clearResolvedAddress ( ) {
        // Strip the cached 'location' value from the 
        $(this).closest("div.address").removeData(ATTR_LOCATION);
    }
    
    /**
     * Records the given location on the block, clearing any
     *  errors that were previously recorded.
     *  
     * @param {Object} el
     * @param {Object} result
     */
    function recordLocation ( el, result ) {
        clearError(el);

        var location = result.geometry.location;
        
        // single valid address - expected case
        $(el).data(ATTR_LOCATION, location);
    }
    
    /**
     * Resolve the given text as a Google Place name. This service
     *  is used as a fallback for the geocoding service that
     *  recognizes street addresses. (It would be nice to have a
     *  single service that handled both - need to see whether
     *  the Places API handles street addresses as well, and whether
     *  the requet quota is sufficient to handle.)
     * 
     * @param {Object} el The block (div) containing the information.
     * @param {Object} text The text entered by the visitor
     * @param {Object} lock The Deferred object chained from the caller.
     *                      May be null.
     */
    function resolvePlace ( el, text, lock ) {
        var placesService = new google.maps.places.PlacesService(map);
        
        var request = {
            // Resolve the place name within the bounds of the given p
            bounds: map.getBounds(),
            name: text
        }
        
        placesService.search ( request, function ( results, status ) {
            if ( results.length == 1 ) {
                log("Single result returned. Using as is.");
                
                recordLocation ( el, results[0] );
                
            } else if ( results.length ) {
                log("Multiple results returned. Using first result." );
                
                recordLocation ( el, results[0] );
            
            } else {
                displayError ( el, "Unable to find lat/long coordinates for this address. Please reenter.");
                
            }

            // If we were given a deferred lock, resolve it now.            
            if ( lock ) {
                lock.resolve();
            }
        });
    }
    
    /**
     * Resolves the given address using either the Google Geocoding API
     *  or the Google Places API, whichever returns a valid result. The
     *  primary side effect of this method is to set the resolved value
     *  as the ATTR_LOCATION data element on the containing block. When
     *  the call to the services fails, then no value will be set.
     * 
     * @param {Object} addressEl
     * 
     * @return A Deferred promise that will be resolved when the results
     *         from the remote API call are known.
     */
    function resolveAddress ( els, boundSearch ) {
        var lock = $.Deferred();
        
        if ( els.length ) {
            var el = els[0];
            
            if ( $(el).data(ATTR_LOCATION) ) {
                // Skip resolution - cached value remains valid. See the
                //  'change' field for the address for details.
                log("Skipping location retrieval for unchanged text field.");
                
                lock.resolve();
                
            } else {
                var address = $("input", el).val(); // text field containing the address
                
                if ( address ) {
                    var geocodeOpts = {
                        "address": address
                    };

                    // Allow for unbounded search so that the same geocoding method
                    //  may be used for the high and low granularity searches.                    
                    if(boundSearch) {
                        geocodeOpts.bounds = map.getBounds();
                    }
                    
                    // Text found. Resolve the address.
                    geocoder.geocode ( geocodeOpts, function(results, status) {
                        if ( results.length === 1 ) {
                            // Single result found; best case.
                            recordLocation(el, results[0]);
                            
                            lock.resolve();

                        } else if ( results.length ) {
                            // multiple possible addresses. use the first
                            var result = results[0];
                            
                            recordLocation(el, results[0]);
                            
                            lock.resolve();

                        } else {
                            // no valid results found.
                            log ( "Unable to find a street address matching the input. Attempting to match as a Place instead.");
                            
                            // Try to interpret the value as a Place name instead.
                            // Do NOT resolve the lock here - that is up to the places api.
                            resolvePlace ( el, address, lock );
                        }
                    });
                    
                } else {
                    // Simply resolve the lock - no resolution to be done.
                    lock.resolve();
                }
            }
        }
        
        return lock.promise();
    }
    
    function geolocate ( callback ) {
        // Read and cache module-global variable for geolocated value.
        // Note that a 'null' value indicates that we've previously tried
        //  and failed to geolocate through the browser. "undefined" is true
        //  only before we've attempted the first time.
        if ( typeof browserGeolocation === "undefined" ) {
            browserGeolocation = null; // Default to null. This will be the value
                                       // of the shared variable if any part of
                                       // the method does not succeed.
            
            // Ensure the browser supports W3C geolocation...
            if ( navigator.geolocation ) {
                log ( "Browser supports geolocation... attempting to determine.");
                
                var deferred = $.Deferred();
                navigator.geolocation.getCurrentPosition(function(pos){
                    log("Browser supports geolocation; result determined.");
                    browserGeolocation = pos;
                    deferred.resolve();
                    
                }, function(){
                    log("Browser supports geolocation, but we were unable to determine the current location.");
                    deferred.reject();
                }, {
                    "timeout": 5000
                });
                
                if (callback) {
                    $.when(deferred.promise()).then(callback, callback);
                }
                
                // No need for a default branch - if there is no callback, then the
                //  promised method will simply return as it completes.
            }
        } else {
            // Trigger the callback immediately, as the browser geolocation is
            //  already discovered and cached.
            if ( callback ) {
                callback.call();
            }
        }
    }
    
    /**
     * Return the origin that should be used. If the visitor has not
     *  entered a specific origin, we will attempt to use the coords
     *  from the geolocation mechanism.
     */
    function getOrigin() {
	    var result;

        // Use the entered address, if available.
        var requestedOrigin = $("div.address.origin").data(ATTR_LOCATION);
        geolocate();
       
	    if ( requestedOrigin) {
            result = requestedOrigin;

        } else if ( browserGeolocation ) {
            result = new google.maps.LatLng(browserGeolocation.coords.latitude, browserGeolocation.coords.longitude);
        }

        return result;
    }

    /**
     * Returns the destination that should form the other endpoint of
     *  the route. No defaulting is used - the visitor must enter a 
     *  destination.
     */
    function getDestination() {
        var requestedDestination = $("div.address.destination").data(ATTR_LOCATION);

        return requestedDestination;
    }
    
    /**
     * Replaces the current route with a new route between the
     *  given origin and destination.
     *  
     * @param {Object} origin Non-null 
     * @param {Object} destination Non-null
     */
    function replaceRoute ( origin, destination ) {
        var directionsService = new google.maps.DirectionsService();
        var request = {
            "origin": origin,
            "destination": destination,
            "travelMode": google.maps.TravelMode.BICYCLING
        };

        directionsService.route ( request, function ( result, status ) {
            // Keep a module-private variable to the renderer so that
            //  future updates
            if (!renderer) {
                renderer = new google.maps.DirectionsRenderer({
                    draggable: false, // Leave things drag-proof on the iPhone by
                                      // default. There's not enough precision to
                                      // be able to view and adjust.
                                      
                    // Pass the panel so that the direction list
                    //  is available.
                    panel: $('#directions')[0]
                });
                
                renderer.setMap(map);
            }
            
            renderer.setDirections(result);
        });
    }
    
    /**
     * Update the draggable status of the current map
     * 
     * @param {Object} draggable
     */
    function setDraggable ( draggable ) {
        if ( renderer ) {
            renderer.setOptions ( {
                "draggable": draggable,
                "preserveViewport": true /* Don't reset the viewport; just update the route */
            });
            
            // Apparently need to re-render the directions before the
            //  updated draggability option is respected. Force the
            //  refresh by just resetting the same directions. (This
            //  will preserve any updates made, as expected).
            renderer.setDirections(renderer.getDirections());
            
        } else {
            log("Cannot change draggability; no renderer set.");
        }
        
        // Always return false so that default processing is not
        //  performed.
        return false;
    }
    
    /**
     * Lock down the map so that the route may not be modified.
     */
    function lockMap() {
        $('#results').removeClass('unlocked');
        return setDraggable(false);
    }
    
    /**
     * Unlock the map so that the visitor may update the route taken.
     */
    function unlockMap() {
        $('#results').addClass('unlocked');
        return setDraggable(true);
    }
    
    /**
     * Performs a geolocation and updates visible controls.
     */
    function geolocateCenter() {
        var center = null;
        
        geolocate ( function() {
            if ( browserGeolocation ) {
                var inputEls = $("input#region");
                
                var address = browserGeolocation.address;
                if (address) {
                    inputEls.val(address.city + ", " + address.region + " " + address.postalCode);
                
                } else {
                    inputEls.val ( "Automatically detected address");
                    inputEls.addClass ( "automatic" );
                    log("Unable to determine street address from browser geolocation.");
                }
                
                var coords = browserGeolocation.coords || {};
                if ( coords ) {
                    center = new google.maps.LatLng(coords.latitude, coords.longitude);
                    inputEls.data(ATTR_LOCATION, center);
                    
                    updateMap(center, 11);
                
                } else {
                    log ( "Unable to determine coordinates from browser geolocation." );
                }
            
            } else {
                log ( "Unable to geolocate." );
            }
        });
    }
    
    /**
     * Performs a geocoding and updates visible controls.
     * 
     * @see #geolocateCenter
     */
    function geocodeCenter() {
        var els = $("div.address.region");
        
        $.when(resolveAddress(els, false)).then(function() {
            var center = els.data(ATTR_LOCATION);
            
            if ( center ) {
                updateMap(center, 11);
                
            } else {
                log("Unable to resolve center.");
            }
        });
        
        // Always return false to prevent form submission
        return false;
    }
    
    /**
     * Attempt to restore data caches based on cookie values from previous
     *  sessions with the page.
     *  
     * TODO - Umm... this.
     */
    function restoreSession() {
        // Restore the context center.
        
        // Restore the zoom level
        
        // Do not attempt to restore from and to addresses. These are the primary
        //  new information expected to be received on each session.
    }
    
    function updateMap(center, zoomLevel) {
        if ( map ) {
            if (center) {
                map.setCenter(center);
            }
            
            if ( zoomLevel ) {
                map.setZoom ( zoomLevel );
            }
        }
    }

    function initMap ( center, zoomLevel ) {
        var myOptions = {
            "zoom": zoomLevel || 5,
            "center": US_CENTER,
            "mapTypeId": google.maps.MapTypeId.ROADMAP
        };
        var mapCanvas = $("#map-canvas")[0];
    
        map = new google.maps.Map(mapCanvas, myOptions);

        var bikeLayer = new google.maps.BicyclingLayer();
        bikeLayer.setMap(map);
    }
    
    function initialize(){
        var restored = restoreSession();

        initMap ( );
    }
    
    function update() {
        $.when(
                resolveAddress ( $("div.address.origin"), true ),
                resolveAddress ( $("div.address.destination"), true )
        ).then ( function() {
            var origin = getOrigin();
            var destination = getDestination();
            
            if ( origin && destination ) {
                replaceRoute ( origin, destination );

                // If we've added a new route, collapse the control bar.
                toggleControls();
            }
        });
        
        return false; // Disable default form submission
    }
    
    function submitSelf() {
        $(this).closest("form").submit();
    }

    function submitIfModified() {
        if ( $(this).data(ATTR_LOCATION) ) {
            log ( "Skipping update for already-recorded value." );
        
        } else {
            submitSelf.apply(this, arguments);
            
        }
    }
    
    /**
     * Utility function for performing an action an returning false. Used
     *  to register event handlers
     *  
     * @param {Object} fn The method that should be performed.
     */
    function _submit ( fn ) {
        return function() {
            // Apply the given method to the object, passing any additional arguments
            fn.apply ( this, arguments );
            
            // Skip the function result; always return false.
            return false;
        }
    } 
    
    $().ready(function() {
      // PERFORM INITIALIZATION ON THE MAIN PAGE
        initialize();
            
      // SET UP EVENT HANDLERS
        // Register 'submit' handler to update the region selection
        $("form#region-form").submit(_submit(geocodeCenter));
      
        // Register 'submit' handler to update the map.
        $("form#control-form").submit(_submit(update));
        $("form#control-form").validate({
            messages: {
                destination: {
                   required: "Please enter a destination address."
                }
            }
        });
        
        // Register 'change' handlers to clear data caches on text change.
        $("input.address[type^='text']").change(clearResolvedAddress);
        // Register 'click' handler to toggle the controls.
        $('#toggle-controls').click(toggleControls);
        
        // Register 'click' handler to geolocate a new map center.
        $('#detect-region').click(geolocateCenter).click(closeHelpDialogs);
        // Register a 'blur' handler to geocode a new map center if the user manually enters text.
        $('input#region').blur(submitIfModified);
        
        // Usability tweak. Make sure that all text is autoselected when any
        //  input box receives the focus.
        $('input').focus(function(){this.select()});

        $('div#lock-map a').click(lockMap);
        $('div#unlock-map a').click(unlockMap);
        
        // Register dialog triggers
        $("a[rel='boxy']").boxy({
            draggable: true
        });
    })
})();
