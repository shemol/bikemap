/* Core Application Code */

/// Create the "public" accessor to hold globally-referencable methods
var $_ = $_ || {};

(function() {
    // Module shared variables.
    //    These variables are global in scope and should be checked for validity
    //    prior to usage.
    var geocoder = new google.maps.Geocoder();
    var browserGeolocation;
    var map;
    var renderer;

  // CONSTANTS
    var US_CENTER = new google.maps.LatLng(37.3002752813443, -93.33984375);
    var SEATTLE = new google.maps.LatLng(47.6063889, -122.3308333);
    var DEFAULT_ORIGIN = SEATTLE;
    var DEFAULT_DESTINATION = new google.maps.LatLng(47.61079236060622, -122.34237670898438);

    // Attribute names
    var ATTR_LOCATION = "location";
    
    // Cookie names and constant values
    var COOKIE_CENTER = "app-center"; // Cookie value provides the text and lat/long of the center of the map
    var COOKIE_ZOOM = "app-zoom"; // Cookie value provides the zoom level.

  // METHOD DEFINITIONS  
    function log ( message ) {
        if(console) { console.log(message); }
    }

    function toggleControls() {
        var controlBodyID = '#controls > .bd';
        var controlBody = $(controlBodyID);
        
        // If the main control area is open, toggle it closed; otherwise,
        //  toggle it open.
        var isVisible = controlBody.filter(':visible').length;
        
        if ( isVisible ) {
            controlBody.slideUp(100, function() {
               // On completion of the slide-up, flip the image
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
     * @param {Object} el
     */
    function clearError ( el ) {
        $(el).removeClass("status-error");
        $(el).addClass("status-ok");
    }

    function displayError ( el, message ) {
        $(".errorMessage", el).html(message);
        $(el).removeClass("status-ok");
        $(el).addClass("status-error");
    }
    
    function closeHelpDialogs() {
        $("a[rel='boxy']").each(function(idx, el) {
            Boxy.linkedTo(el).hide();
        });
    }

    function clearResolvedAddress ( ) {
        // Strip the cached 'location' value from the 
        $(this).closest("div.address").removeData(ATTR_LOCATION);
    }
    
    function recordLocation ( el, result ) {
        clearError(el);

        var location = result.geometry.location;
        
        // single valid address - expected case
        $(el).data(ATTR_LOCATION, location);
    }
    
    function resolvePlace ( el, text, lock ) {
        var placesService = new google.maps.places.PlacesService(map);
        
        var request = {
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
     * Resolves the given address
     * @param {Object} addressEl
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
                    
                    if(boundSearch) {
                        geocodeOpts.bounds = map.getBounds();
                    }
                    
                    // Text found. Resolve the address.
                    geocoder.geocode ( geocodeOpts, function(results, status) {
                        if ( results.length === 1 ) {
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
            browserGeolocation = null; // Default to null
            
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
            }
        } else {
            // Trigger the callback immediately, as the browser geolocation is
            //  already discovered and cached.
            if ( callback ) {
                callback.call();
            }
        }
    }
    
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

    function getDestination() {
        var requestedDestination = $("div.address.destination").data(ATTR_LOCATION);

        return requestedDestination;
    }

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
                    draggable: false, // Have to leave things drag-proof on the iPhone
                                      // for now. There's just not enough precision to
                                      // be able to view
                    panel: $('#directions')[0]
                });
                renderer.setMap(map);
            }
            
            renderer.setDirections(result);
        });
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
                    inputEls.val ( "Automatically detected address")
                    inputEls.addClass ( "automatic" );
                    log("Unable to determine street address from browser geolocation.");
                }
                
                var coords = browserGeolocation.coords || {};
                if ( coords ) {
                    center = new google.maps.LatLng(coords.latitude, coords.longitude)
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
     * Attempt to restore data caches based on cookie values from previous
     *  sessions with the page.
     */
    function restoreSession() {
        // Restore the context center.
        
        // Restore the zoom level
        
        // Do not attempt to restore from and to addresses. These are the primary
        //  new information expected to be received on each session.
    }
    
    function initContext() {
        var result = SEATTLE;
        
        return result;
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
        initContext();
    }
    
    /**
     * Performs a geocoding and updates the map center
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
    
    $_.update = function() {
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
        $("form#control-form").submit(_submit($_.update));
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
        
        // Register dialog triggers
        $("a[rel='boxy']").boxy({
            draggable: true
        });
    })
})();
