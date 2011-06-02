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
               $('#toggle-controls').html('down'); 
            });
            
        } else {
            // Animate the opening.
            controlBody.slideDown(100, function() {
                // On completion of the slide-down, flip the image.
                $('#toggle-controls').html('up');
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

    function clearResolvedAddress ( ) {
        // Strip the cached 'location' value from the 
        $(this).removeData(ATTR_LOCATION);
    }
    
    /**
     * Resolves the given address
     * @param {Object} addressEl
     */
    function resolveAddress ( els ) {
        var lock = $.Deferred();
        
        if ( els.length ) {
            var el = els[0];
            
            if ( $(el).hasData(ATTR_LOCATION) ) {
                // Skip resolution - cached value remains valid. See the
                //  'change' field for the address for details.
                log("Skipping location retrieval for unchanged text field.");
                
                lock.resolve();
                
            } else {
                var address = $("input", el).val(); // text field containing the address
                
                if ( address ) {
                    // Text found. Resolve the address.
                    geocoder.geocode ( {"address": address}, function(results, status) {
                        if ( results.length === 1 ) {
                            clearError(el);
    
                            var result = results[0];
                            var location = result.geometry.location;
                            
                            // single valid address - expected case
                            $(el).data(ATTR_LOCATION, location);
                            $("span.resolution", el).html(result.formatted_address);
                            
                        } else if ( results.length ) {
                            // multiple possible addresses.
                            displayError ( el, "This address matches multiple locations. Please be more specific.");
                            $("span.resolution", el).html("");
                            
                        } else {
                            // no valid results found.
                            displayError ( el, "Unable to find lat/long coordinates for this address. Please reenter.");
                            $("span.resolution", el).html("");
                        }
                        
                        lock.resolve();
                    });
                } else {
                    // Simply resolve the lock - no resolution to be done.
                    lock.resolve();
                }
            }
        }
        
        return lock.promise();
    }
    
    function getBrowserGeolocation() {
        // Read and cache module-global variable for geolocated value.
        // Note that a 'null' value indicates that we've previously tried
        //  and failed to geolocate through the browser. "undefined" is true
        //  only before we've attempted the first time.
        if ( typeof browserGeolocation === "undefined" ) {
            browserGeolocation = null; // Default to null
            
            // Ensure the browser supports W3C geolocation...
            if ( navigator.geolocation ) {
                log ( "Browser supports geolocation... attemting to determine.");
                
                navigator.geolocation.getCurrentPosition(function(pos) {
                    browserGeolocation = pos;
                    
                }, function() {
                    alert ( "Browser supports geolocation, but we were unable to determine the current location.");
                });
            }
        }

        return browserGeolocation;
    }
    
    function getOrigin() {
	    var result;

        // Use the entered address, if available.
        var requestedOrigin = $("div.address.origin").data(ATTR_LOCATION);
        var geolocation = getBrowserGeolocation();
        
	    if ( requestedOrigin) {
            result = requestedOrigin;

        } else if ( geolocation ) {
            result = new google.maps.LatLng(geolocation.coords.latitude, geolocation.coords.longitude);
        }

        return result;
    }

    function getDestination() {
        var requestedDestination = $("div.address.destination").data(ATTR_LOCATION);

        return requestedDestination;
    }

    function updateMap ( origin, destination ) {
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
                renderer = new google.maps.DirectionsRenderer();
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
        
        var geolocation = getBrowserGeolocation();
        if ( geolocation ) {
            var inputEls = $("input#city");
            
            var address = geolocation.address;
            inputEls.val(address.city + ", " + address.region + " " + address.postalCode);

            center = new google.maps.LatLng(geolocation.coords.latitude, geolocation.coords.longitude)
            inputEls.data(ATTR_LOCATION, center);
            
            updateMap(center);
        }
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
            "zoom": zoomLevel || 14,
            "center": center,
            "mapTypeId": google.maps.MapTypeId.ROADMAP
        };
        var mapCanvas = $("#map-canvas")[0];
    
        map = new google.maps.Map(mapCanvas, myOptions);
        updateMap(center, zoomLevel);

        var bikeLayer = new google.maps.BicyclingLayer();
        bikeLayer.setMap(map);
    }
    
    function initialize(){
        var restored = restoreSession();
        var center = initContext();
        initMap ( center );
    }
    
    $_.update = function() {
        $.when(
                resolveAddress ( $("div.address.origin") ),
                resolveAddress ( $("div.address.destination") )
        ).then ( function() {
            var origin = getOrigin();
            var destination = getDestination();
            
            if ( origin && destination ) {
                updateMap ( origin, destination );
            }
        });
    }

  // PERFORM INITIALIZATION ON THE MAIN PAGE
    initialize();
        
  // SET UP EVENT HANDLERS
    // Register 'click' handler to update the map.
    $("input#update").click($_.update);
    // Register 'change' handlers to clear data caches on text change.
    $("input.address[type^='text']").change(clearResolvedAddress);
    // Register 'click' handler to toggle the controls.
    $('#toggle-controls').click(toggleControls);
    // Register 'click' handler to geolocate a new map center.
    $('#detect-city').click(geolocateCenter);
})();
